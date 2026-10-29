import type { SupabaseClient } from "@supabase/supabase-js";
import { GarmentCategory, type PlanLightsResponse } from "@/lib/api";
import { localMidnight } from "@/lib/format";
import { ensureLight } from "@/lib/hub";
import { check } from "@/lib/hub/db";
import type { Closet } from "@/lib/supabase/closet";
import type { Database } from "@/lib/supabase/types";
import { fetchForecast } from "@/lib/weather/open-meteo";
import { DEMO_WEEK_EVENTS } from "./demo-events";
import { addDays, planWeek, type PlannerStats } from "./plan";

/*
 * Plan endpoints (docs/api.md, Plan). The plan is written through `user` (the signed-in session,
 * under RLS); light commands go through `admin`, the only writer of commands.
 */

type Db = SupabaseClient<Database>;

const PURPLE = { color: "purple", pattern: "steady" } as const;
const OFF = { color: "off", pattern: "off" } as const;

/**
 * POST /api/plans/generate: plans the week starting on `weekStart` (a Monday) from the closet's
 * garments, stats, forecast and demo events. An existing plan is kept unless `replace`.
 */
export async function generatePlan(
  user: Db,
  closet: Closet,
  weekStart: string,
  replace: boolean,
  now: Date,
): Promise<string> {
  const existing = check(
    await user.from("plans").select("id").eq("closet_id", closet.id).eq("week_start", weekStart).maybeSingle(),
  );
  if (existing && !replace) return existing.id;

  const [garments, stats, away, keeps, forecast] = await Promise.all([
    user
      .from("garments")
      .select("id, name, category, seasons, formality, status, hanger_assignments(hangers(id, number))")
      .eq("closet_id", closet.id)
      .is("hanger_assignments.ended_at", null),
    user.from("garment_stats").select("garment_id, idle_days_in_season, wears_90d").eq("closet_id", closet.id),
    user.from("absences").select("garment_id").eq("closet_id", closet.id).is("returned_at", null),
    user.from("swipe_decisions").select("garment_id").eq("decision", "keep").gt("challenge_until", now.toISOString()),
    closet.latitude !== null && closet.longitude !== null
      ? fetchForecast({
          latitude: closet.latitude,
          longitude: closet.longitude,
          timeZone: closet.timezone,
          start: weekStart,
          end: addDays(weekStart, 6),
        })
      : Promise.resolve(null),
  ]);

  const awayIds = new Set(check(away).map((a) => a.garment_id));
  const statsById = new Map<string, PlannerStats>();
  for (const s of check(stats)) {
    if (s.garment_id) statsById.set(s.garment_id, { idleDaysInSeason: s.idle_days_in_season ?? 0, wears90d: s.wears_90d ?? 0 });
  }
  const days = planWeek({
    weekStart,
    forecast,
    events: DEMO_WEEK_EVENTS,
    garments: check(garments).map((g) => {
      const hanger = g.hanger_assignments[0]?.hangers ?? null;
      return {
        id: g.id,
        name: g.name,
        category: g.category ? GarmentCategory.parse(g.category) : null,
        seasons: g.seasons,
        formality: g.formality,
        active: g.status === "active",
        away: awayIds.has(g.id),
        hangerId: hanger?.id ?? null,
        hangerNumber: hanger?.number ?? null,
      };
    }),
    stats: statsById,
    inChallenge: new Set(check(keeps).map((k) => k.garment_id)),
  });

  let planId: string;
  if (existing) {
    planId = existing.id;
    check(await user.from("plans").update({ forecast, generated_at: now.toISOString() }).eq("id", planId));
    check(await user.from("plan_items").delete().eq("plan_id", planId));
  } else {
    planId = check(
      await user
        .from("plans")
        .insert({ closet_id: closet.id, week_start: weekStart, forecast, generated_at: now.toISOString() })
        .select("id")
        .single(),
    ).id;
  }
  const rows = days.flatMap((d) =>
    d.items.map((item) => ({
      plan_id: planId,
      day: d.day,
      slot: item.slot,
      garment_id: item.garmentId,
      hanger_id: item.hangerId,
      reason: d.reason,
    })),
  );
  if (rows.length > 0) check(await user.from("plan_items").insert(rows));
  return planId;
}

/**
 * POST /api/plans/{id}/lights: that day's hangers glow purple until the end of that local day;
 * other purple hangers go off. Returns null when the plan isn't the user's.
 */
export async function lightPlanDay(
  user: Db,
  admin: Db,
  closet: Closet,
  planId: string,
  day: string,
  now: Date,
): Promise<PlanLightsResponse | null> {
  const plan = check(await user.from("plans").select("id").eq("id", planId).eq("closet_id", closet.id).maybeSingle());
  if (!plan) return null;

  const [items, hangers, pendingPurple] = await Promise.all([
    user
      .from("plan_items")
      .select("hanger_id, garments(hanger_assignments(hanger_id, ended_at))")
      .eq("plan_id", planId)
      .eq("day", day),
    user.from("hangers").select("id, number, led_color").eq("closet_id", closet.id),
    user
      .from("commands")
      .select("hanger_id")
      .eq("closet_id", closet.id)
      .eq("color", "purple")
      .is("acked_at", null)
      .gt("expires_at", now.toISOString()),
  ]);

  // Where each planned garment hangs now (it may have moved since planning), else the planned hanger
  const lit = new Set<string>();
  for (const item of check(items)) {
    const current = item.garments?.hanger_assignments.find((a) => a.ended_at === null)?.hanger_id;
    const hangerId = current ?? item.hanger_id;
    if (hangerId) lit.add(hangerId);
  }

  const expiresAt = localMidnight(addDays(day, 1), closet.timezone);
  const purplePending = new Set(check(pendingPurple).map((c) => c.hanger_id));
  const commandIds: number[] = [];
  const numbers: number[] = [];
  for (const h of check(hangers)) {
    const hanger = { id: h.id, ledColor: h.led_color };
    let id: number | null = null;
    if (lit.has(h.id)) {
      numbers.push(h.number);
      id = await ensureLight(admin, { closetId: closet.id, hanger, light: PURPLE, reason: `plan ${day}`, expiresAt, now });
    } else if (h.led_color === "purple" || purplePending.has(h.id)) {
      id = await ensureLight(admin, { closetId: closet.id, hanger, light: OFF, reason: "plan moved on", now });
    }
    if (id !== null) commandIds.push(id);
  }
  return { command_ids: commandIds, hangers: numbers.sort((a, b) => a - b) };
}
