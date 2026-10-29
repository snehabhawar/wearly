"use client";

import { useState } from "react";
import { FindItButton } from "@/components/find-it-button";
import { GarmentThumb } from "@/components/garment-thumb";
import { HangerTile } from "@/components/hanger-tile";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { formatCents, formatMonth, formatMonthDay } from "@/lib/format";
import { heatLevel, isWaiting, type ClosetItem, type ClosetSummary } from "@/lib/queries/closet";
import { cn } from "@/lib/utils";

const FILTERS = {
  all: { label: "All", test: () => true },
  most: { label: "Most worn", test: (i: ClosetItem) => heatLevel(i.wears90d) >= 2 },
  waiting: { label: "Waiting", test: (i: ClosetItem) => isWaiting(i) },
  nophoto: { label: "No photo", test: (i: ClosetItem) => i.photoPath === null },
} as const;
type Filter = keyof typeof FILTERS;

const HEAT_SWATCHES = ["bg-heat-0 border border-line", "bg-heat-1", "bg-heat-2", "bg-heat-3"];

/** Closet screen: stats, the hanger grid, and the selected hanger's details. */
export function ClosetView({ items, summary }: { items: ClosetItem[]; summary: ClosetSummary }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<number>(
    () => items.find(isWaiting)?.hangerNumber ?? items[0]?.hangerNumber ?? 1,
  );

  const visible = items.filter(FILTERS[filter].test);
  const current = items.find((i) => i.hangerNumber === selected) ?? null;
  const browsedTotal = items.reduce((sum, i) => sum + i.browsedCount, 0);
  const wearsTotal = items.reduce((sum, i) => sum + i.wears90d, 0);
  const mysteryCount = summary.hangerCount - summary.photographedCount;

  return (
    <div className="flex flex-col gap-6 px-5 pt-7 pb-12 md:px-10 md:pt-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold md:text-[40px]">Your closet</h1>
        <span className="text-sm text-muted-foreground">
          {summary.hangerCount} hangers · {summary.photographedCount} photographed · {mysteryCount} still mystery
          picks
        </span>
      </header>

      <section aria-label="Closet stats" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          tone="plum"
          label="Worn in the last 90 days"
          value={`${summary.worn90dPct}%`}
          progress={summary.worn90dPct}
        />
        <StatCard label="Wears in 90 days" value={wearsTotal} note={`across ${items.filter((i) => i.wears90d > 0).length} items`} />
        <StatCard label="Picked up, put back" value={browsedTotal} note="maybe a fit or comfort thing" />
        <StatCard tone="peach" label="Rehomed this year" value={summary.rehomedThisYear} />
      </section>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <section
          aria-label="Hanger grid"
          className="flex min-w-0 flex-[3] flex-col gap-4 rounded-3xl border border-line bg-card p-5.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="group" aria-label="Filter" className="flex flex-wrap gap-2">
              {(Object.keys(FILTERS) as Filter[]).map((key) => (
                <Button
                  key={key}
                  variant={filter === key ? "default" : "outline"}
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                  className="h-9 rounded-full px-3.5 text-[13px] font-semibold"
                >
                  {FILTERS[key].label}
                  {key === "all" && ` ${items.length}`}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Worn less</span>
              {HEAT_SWATCHES.map((c) => (
                <span key={c} aria-hidden className={cn("size-3.5 rounded-sm", c)} />
              ))}
              <span>more</span>
              <span aria-hidden className="ml-2.5 size-2 rounded-full bg-amber" />
              <span>Waiting a while</span>
            </div>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2.5">
            {visible.map((item) => (
              <HangerTile
                key={item.hangerNumber}
                item={item}
                selected={item.hangerNumber === selected}
                onSelect={setSelected}
              />
            ))}
          </div>
          {visible.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Nothing here right now.</p>
          )}
        </section>

        {current && <SelectedHanger item={current} />}
      </div>
    </div>
  );
}

function SelectedHanger({ item }: { item: ClosetItem }) {
  const known = item.name !== null || item.category !== null;
  const waiting = isWaiting(item);
  const line = waiting
    ? item.lastWornOn
      ? `This one's been waiting since ${formatMonth(item.lastWornOn)}. It's in season, so it's in your Keep-or-let-go deck.`
      : "This one hasn't been out in a while. It's in your Keep-or-let-go deck."
    : !known
      ? "Wearly tracks this hanger by number. Add a photo whenever it suits you."
      : item.lastWornOn
        ? `A regular. Last out ${formatMonthDay(item.lastWornOn)}.`
        : "Not worn yet this year.";

  return (
    <section
      aria-label="Selected hanger"
      className="flex min-w-0 flex-[2] flex-col gap-4 rounded-3xl bg-card p-5.5 shadow-sm"
    >
      <div className="relative flex h-55 items-center justify-center rounded-2xl bg-dawn">
        {known ? (
          <GarmentThumb garment={item} hangerNumber={item.hangerNumber} sizes="220px" className="size-37.5" />
        ) : (
          <div className="flex flex-col items-center gap-2.5 px-6 text-center">
            <span className="font-heading text-[56px] leading-none font-bold text-plum">{item.hangerNumber}</span>
            <span className="text-[13px] text-muted-strong">No photo yet. Tap the hanger with your phone to add one.</span>
          </div>
        )}
        <span className="absolute top-3 left-3 rounded-full bg-card px-2.5 py-1 text-xs font-bold text-plum">
          Hanger {item.hangerNumber}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[26px] font-semibold">{item.name ?? `Hanger ${item.hangerNumber}`}</h2>
        <p className="text-sm leading-relaxed text-muted-strong">{line}</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <StatCard size="sm" tone="cream" label="Wears this year" value={item.wearsYtd} />
        <StatCard
          size="sm"
          tone="cream"
          label="Last worn"
          value={item.lastWornOn ? formatMonthDay(item.lastWornOn) : "Not yet"}
        />
        <StatCard size="sm" tone="cream" label="Put back unworn" value={`${item.browsedCount}×`} />
        <StatCard
          size="sm"
          tone="cream"
          label="Cost per wear"
          value={item.costPerWearCents !== null ? formatCents(item.costPerWearCents) : "–"}
        />
      </div>
      <div className="flex items-start gap-2.5">
        <FindItButton key={item.hangerNumber} hangerNumber={item.hangerNumber} className="flex-1" />
        {/* Opens Style it once that screen exists */}
        <Button disabled variant="secondary" className="h-11.5 flex-1 rounded-lg font-semibold">
          Style it
        </Button>
      </div>
    </section>
  );
}
