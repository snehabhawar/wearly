import type { SupabaseClient } from "@supabase/supabase-js";
import { GarmentCategory, GarmentStatus, type SwipeDecisionRequest, type SwipeDecisionResponse, type SwipeDeckResponse } from "@/lib/api";
import { ensureLight } from "@/lib/hub";
import { check } from "@/lib/hub/db";
import type { Closet } from "@/lib/supabase/closet";
import type { Database } from "@/lib/supabase/types";
import { buildDeck, buildListing, KEEP_CHALLENGE_DAYS, type DeckStats } from "./deck";

/*
 * Swipe endpoints (docs/api.md, Swipe). Reads and the user's own writes go through `user`
 * (the signed-in session, under RLS); light commands go through `admin`, the only writer of commands.
 */

type Db = SupabaseClient<Database>;

const AMBER = { color: "amber", pattern: "breathe" } as const;
const OFF = { color: "off", pattern: "off" } as const;
const DAY_MS = 86_400_000;

/** GET /api/swipe/deck: the ordered cards. The top card's hanger breathes amber; deck hangers lit before go off. */
export async function getDeck(user: Db, admin: Db, closet: Closet, now: Date): Promise<SwipeDeckResponse> {
  const [garments, stats, keeps, hangers, pendingAmber] = await Promise.all([
    user
      .from("garments")
      .select("id, name, photo_path, category, price_cents, created_at, hanger_assignments(hangers(number))")
      .eq("closet_id", closet.id)
      .eq("status", "active")
      .is("hanger_assignments.ended_at", null),
    user
      .from("garment_stats")
      .select("garment_id, idle_days_in_season, browsed_count, wears_90d, last_worn_on")
      .eq("closet_id", closet.id),
    user.from("swipe_decisions").select("garment_id").eq("decision", "keep").gt("challenge_until", now.toISOString()),
    user
      .from("hangers")
      .select("id, number, led_color, hanger_assignments(garments(status))")
      .eq("closet_id", closet.id)
      .is("hanger_assignments.ended_at", null),
    user
      .from("commands")
      .select("hanger_id")
      .eq("closet_id", closet.id)
      .eq("color", "amber")
      .is("acked_at", null)
      .gt("expires_at", now.toISOString()),
  ]);

  const statsById = new Map<string, DeckStats>();
  for (const s of check(stats)) {
    if (!s.garment_id) continue;
    statsById.set(s.garment_id, {
      idleDaysInSeason: s.idle_days_in_season ?? 0,
      browsedCount: s.browsed_count ?? 0,
      wears90d: s.wears_90d ?? 0,
      lastWornOn: s.last_worn_on,
    });
  }
  const cards = buildDeck({
    garments: check(garments).map((g) => ({
      id: g.id,
      name: g.name,
      photoPath: g.photo_path,
      category: g.category ? GarmentCategory.parse(g.category) : null,
      priceCents: g.price_cents,
      createdAt: g.created_at,
      hangerNumber: g.hanger_assignments[0]?.hangers?.number ?? null,
    })),
    stats: statsById,
    inChallenge: new Set(check(keeps).map((k) => k.garment_id)),
    timeZone: closet.timezone,
  });

  // One amber hanger for the deck at a time; let-go garments keep theirs until they leave
  const top = cards[0]?.hanger_number ?? null;
  const amberPending = new Set(check(pendingAmber).map((c) => c.hanger_id));
  for (const h of check(hangers)) {
    const letGo = h.hanger_assignments[0]?.garments?.status === "let_go";
    const hanger = { id: h.id, ledColor: h.led_color };
    if (h.number === top) {
      await ensureLight(admin, { closetId: closet.id, hanger, light: AMBER, reason: "swipe deck", now });
    } else if (!letGo && (h.led_color === "amber" || amberPending.has(h.id))) {
      await ensureLight(admin, { closetId: closet.id, hanger, light: OFF, reason: "swipe deck moved on", now });
    }
  }

  return { cards, lit_hanger: top };
}

/**
 * POST /api/swipe/decisions. Keep starts a 30-day challenge and turns the hanger off; let go marks
 * the garment and keeps its hanger amber until it leaves (the sweep then rehomes it). Returns null
 * when the garment isn't in the user's closet.
 */
export async function decide(
  user: Db,
  admin: Db,
  closet: Closet,
  request: SwipeDecisionRequest,
  now: Date,
): Promise<SwipeDecisionResponse | null> {
  const garment = check(
    await user
      .from("garments")
      .select("id, name, category, color, price_cents, status, hanger_assignments(hangers(id, led_color))")
      .eq("id", request.garment_id)
      .eq("closet_id", closet.id)
      .is("hanger_assignments.ended_at", null)
      .maybeSingle(),
  );
  if (!garment) return null;

  const h = garment.hanger_assignments[0]?.hangers ?? null;
  const hanger = h && { id: h.id, ledColor: h.led_color };
  const challengeUntil = request.decision === "keep" ? new Date(now.getTime() + KEEP_CHALLENGE_DAYS * DAY_MS) : null;

  check(
    await user.from("swipe_decisions").insert({
      garment_id: garment.id,
      decision: request.decision,
      route: request.decision === "let_go" ? request.route : null,
      challenge_until: challengeUntil?.toISOString() ?? null,
      decided_at: now.toISOString(),
    }),
  );

  let status = GarmentStatus.parse(garment.status);
  if (request.decision === "keep" && hanger) {
    await ensureLight(admin, { closetId: closet.id, hanger, light: OFF, reason: "kept", now });
  }
  if (request.decision === "let_go") {
    check(await user.from("garments").update({ status: "let_go" }).eq("id", garment.id));
    status = "let_go";
    if (hanger) await ensureLight(admin, { closetId: closet.id, hanger, light: AMBER, reason: "let go", now });
  }

  const resell = request.decision === "let_go" && request.route === "resell";
  return {
    garment_status: status,
    challenge_until: challengeUntil?.toISOString() ?? null,
    listing: resell
      ? buildListing({
          name: garment.name,
          category: garment.category ? GarmentCategory.parse(garment.category) : null,
          priceCents: garment.price_cents,
          color: garment.color,
        })
      : null,
  };
}
