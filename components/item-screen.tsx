"use client";

import { ChevronLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import { FindItButton } from "@/components/find-it-button";
import { GarmentThumb } from "@/components/garment-thumb";
import { LedDot } from "@/components/led-dot";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import type { Light } from "@/lib/api";
import { formatCents, formatMonthDay, formatSince } from "@/lib/format";
import { WAITING_IDLE_DAYS } from "@/lib/queries/closet";
import type { ActivityEntry, ItemDetail } from "@/lib/queries/item";
import { useCurrentCloset } from "@/lib/queries/use-current-closet";
import { useItem } from "@/lib/queries/use-item";
import { useToday } from "@/lib/queries/use-today";
import { cn } from "@/lib/utils";

const LIGHT_CHIP: Record<Exclude<Light["color"], "off">, string> = {
  purple: "Glowing purple",
  amber: "Breathing amber",
  white: "Blinking white",
};

const ACTIVITY: Record<ActivityEntry["kind"], { label: string; tone: string }> = {
  out: { label: "Out", tone: "bg-plum-soft text-plum" },
  browsed: { label: "Browsed", tone: "bg-lilac text-muted-strong" },
  tried_on: { label: "Tried on", tone: "bg-peach-soft text-amber-ink" },
  worn: { label: "Worn", tone: "bg-plum text-primary-foreground" },
  worn_washed: { label: "Worn + washed", tone: "bg-ink text-primary-foreground" },
  missing: { label: "Missing", tone: "bg-peach text-ink" },
};

/** One warm sentence about where the garment stands */
function note(item: ItemDetail, today: string | null): string {
  const subject = item.name ? "This one" : `Hanger ${item.hanger?.number ?? ""}`.trim();
  if (item.status === "rehomed") return "This one found a new home. Its history stays here.";
  if (item.status === "let_go") return "Marked to let go. Its hanger breathes amber until it leaves the closet.";
  if (item.status === "missing") return "It's been out a long while. Packed, lent, or gone?";
  if (item.hanger?.away) return "Out of the closet right now.";
  if (item.idleDaysInSeason >= WAITING_IDLE_DAYS) {
    return item.lastWornOn && today
      ? `${subject} has been waiting since ${formatSince(item.lastWornOn, today)}. It's in your Keep-or-let-go deck.`
      : `${subject} hasn't been out yet. It's in your Keep-or-let-go deck.`;
  }
  if (item.lastWornOn) return `Last out on ${formatMonthDay(item.lastWornOn)}.`;
  return "Wearly will learn how this one gets worn.";
}

/** /closet/[garmentId]: one garment's tags, stats, recent activity, Find it and Style it */
export function ItemScreen({ garmentId }: { garmentId: string }) {
  const item = useItem(garmentId);
  const today = useToday(useCurrentCloset().data?.timezone);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 pt-4 pb-12 md:pt-8">
      <Link href="/closet" className="flex min-h-11 items-center gap-1 self-start pr-2 text-[15px] font-semibold text-plum">
        <ChevronLeft aria-hidden className="size-5" />
        Closet
      </Link>

      {item.isPending ? (
        <div aria-busy="true" aria-label="Loading this garment" className="flex flex-col gap-4">
          <div className="h-56 animate-pulse rounded-3xl bg-heat-0" />
          <div className="h-8 w-60 animate-pulse rounded-lg bg-heat-0" />
          <div className="h-40 animate-pulse rounded-3xl bg-heat-0" />
        </div>
      ) : item.isError ? (
        <p role="alert" className="text-[15px] text-muted-strong">
          We couldn&apos;t load this one just now. Your hangers are fine; it&apos;s the connection.
        </p>
      ) : !item.data ? (
        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] font-semibold">Not in your closet</h1>
          <p className="text-[15px] text-muted-strong">This garment isn&apos;t in your closet, or it was removed.</p>
        </div>
      ) : (
        <ItemBody item={item.data} today={today} />
      )}
    </div>
  );
}

function ItemBody({ item, today }: { item: ItemDetail; today: string | null }) {
  const light = item.hanger?.light.color;
  return (
    <>
      <div className="relative flex h-56 items-center justify-center overflow-hidden rounded-3xl bg-linear-160 from-plum-soft to-peach-soft md:h-72">
        {item.name !== null || item.category !== null ? (
          <GarmentThumb
            garment={item}
            hangerNumber={item.hanger?.number ?? null}
            sizes="208px"
            className="size-40 md:size-52"
          />
        ) : (
          <div className="flex flex-col items-center gap-2.5 px-6 text-center">
            <span className="font-heading text-[64px] leading-none font-bold text-plum">{item.hanger?.number ?? "?"}</span>
            <span className="text-[13px] text-muted-strong">No photo yet. Wearly knows it by its hanger number.</span>
          </div>
        )}
        {item.hanger && (
          <span className="absolute top-3.5 left-3.5 rounded-full bg-card px-2.5 py-1.5 text-xs font-bold text-plum">
            Hanger {item.hanger.number}
          </span>
        )}
        {light && light !== "off" && (
          <LedDot
            color={light}
            label={LIGHT_CHIP[light]}
            className="absolute top-3.5 right-3.5 rounded-full bg-card px-2.5 py-1.5 text-xs font-semibold text-amber-ink"
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold">{item.name ?? `Hanger ${item.hanger?.number ?? ""}`}</h1>
        {item.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {item.tags.map((t) => (
              <li
                key={t}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium",
                  t.startsWith("Tagged") ? "border border-dashed border-line-strong text-muted-foreground" : "bg-plum-soft text-plum",
                )}
              >
                {t}
              </li>
            ))}
          </ul>
        )}
        <p className="text-[15px] leading-snug text-muted-strong">{note(item, today)}</p>
      </div>

      <section aria-label="Wear stats" className="grid grid-cols-2 gap-2.5">
        <StatCard size="sm" tone="cream" label="Wears this year" value={item.wearsYtd} />
        <StatCard
          size="sm"
          tone="cream"
          label="Last worn"
          value={item.lastWornOn ? formatMonthDay(item.lastWornOn) : "Not yet"}
        />
        <StatCard size="sm" tone="cream" label="Picked up, put back" value={`${item.browsedCount}×`} />
        <StatCard
          size="sm"
          tone="cream"
          label="Cost per wear"
          value={item.costPerWearCents !== null ? formatCents(item.costPerWearCents) : "–"}
        />
      </section>

      <section aria-labelledby="activity-head" className="flex flex-col gap-1.5">
        <h2 id="activity-head" className="font-sans text-[13px] font-bold tracking-wide text-muted-foreground uppercase">
          Recent activity
        </h2>
        {item.activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet. Lifts and wears show up here.</p>
        ) : (
          <ul className="flex flex-col">
            {item.activity.map((a, i) => (
              <li key={`${a.day}-${i}`} className="flex min-h-8 items-center gap-2.5 text-sm">
                <span className="w-14 shrink-0 text-[13px] text-muted-foreground">{formatMonthDay(a.day)}</span>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", ACTIVITY[a.kind].tone)}>
                  {ACTIVITY[a.kind].label}
                </span>
                <span className="text-[13px] text-muted-strong">{a.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {item.hanger && (
        <div className="flex items-start gap-2.5">
          <FindItButton hangerNumber={item.hanger.number} className="flex-1" />
          {/* Opens Style it once that screen exists */}
          <Button disabled variant="secondary" className="h-11.5 flex-1 gap-2 rounded-lg font-semibold">
            <Sparkles aria-hidden className="size-4" />
            Style it
          </Button>
        </div>
      )}
    </>
  );
}
