"use client";

import { Cloud, CloudRain, Snowflake, Sun } from "lucide-react";
import { useState } from "react";
import { GarmentThumb } from "@/components/garment-thumb";
import { LedDot } from "@/components/led-dot";
import { Button } from "@/components/ui/button";
import type { ForecastDay } from "@/lib/api";
import { formatHangers, mondayOf } from "@/lib/format";
import { addDays } from "@/lib/planner/plan";
import type { PlanDay } from "@/lib/queries/plan";
import { useCurrentCloset } from "@/lib/queries/use-current-closet";
import { useLightPlanDay, usePlan, useReplan } from "@/lib/queries/use-plan";
import { useToday } from "@/lib/queries/use-today";
import { cn } from "@/lib/utils";

const label = (day: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
const dow = (day: string) => label(day, { weekday: "short" });
const longDay = (day: string) => label(day, { weekday: "long", month: "short", day: "numeric" });
const shortDate = (day: string) => label(day, { month: "short", day: "numeric" });

const WEATHER_ICON: Record<ForecastDay["condition"], typeof Sun> = {
  clear: Sun,
  cloudy: Cloud,
  rain: CloudRain,
  snow: Snowflake,
};

/** The Plan screen: this week's outfits, with "Light up tomorrow" */
export function PlanScreen() {
  const closet = useCurrentCloset();
  const today = useToday(closet.data?.timezone);
  const weekStart = today ? mondayOf(today) : null;
  const plan = usePlan(weekStart);
  const replan = useReplan(weekStart);
  const lights = useLightPlanDay();
  const [selected, setSelected] = useState<string | null>(null);
  const [showReasons, setShowReasons] = useState(true);

  if (!weekStart || plan.isPending) return <PlanSkeleton />;
  if (plan.isError || !plan.data) {
    return (
      <div className="flex flex-col items-start gap-3 px-5 pt-7 md:px-10 md:pt-8">
        <h1 className="text-3xl font-semibold md:text-[40px]">This week</h1>
        <p role="alert" className="text-[15px] text-muted-strong">
          We couldn&apos;t put your week together just now. Your hangers are fine; it&apos;s the connection.
        </p>
        <Button variant="outline" onClick={() => plan.refetch()} className="h-11 rounded-lg px-4.5 font-semibold">
          Try again
        </Button>
      </div>
    );
  }

  const week = plan.data;
  const tomorrow = addDays(today!, 1);
  const tomorrowInWeek = week.days.some((d) => d.day === tomorrow);
  const current = week.days.find((d) => d.day === (selected ?? today)) ?? week.days[0];
  const tomorrowPlan = week.days.find((d) => d.day === tomorrow);
  const lit = lights.data && lights.variables?.day === tomorrow ? lights.data.hangers : null;

  return (
    <div className="flex flex-col gap-6 px-5 pt-7 pb-12 md:px-10 md:pt-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold md:text-[40px]">This week</h1>
          <span className="text-sm text-muted-foreground">
            {shortDate(week.weekStart)} – {shortDate(addDays(week.weekStart, 6))} · uses your forecast, calendar and
            what&apos;s on your hangers
          </span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button
            variant="outline"
            aria-pressed={showReasons}
            onClick={() => setShowReasons((v) => !v)}
            className="h-11 rounded-lg px-4 font-semibold text-plum"
          >
            {showReasons ? "Hide reasons" : "Show reasons"}
          </Button>
          <Button
            variant="outline"
            disabled={replan.isPending}
            onClick={() => replan.mutate()}
            className="h-11 rounded-lg px-4 font-semibold text-plum"
          >
            {replan.isPending ? "Planning…" : "Replan week"}
          </Button>
          <Button
            disabled={!tomorrowInWeek || lights.isPending}
            onClick={() => lights.mutate({ planId: week.id, day: tomorrow })}
            className="h-11 rounded-lg px-4 font-semibold"
          >
            {lights.isPending ? "Lighting…" : "Light up tomorrow"}
          </Button>
        </div>
      </header>

      {/* Phone: a day strip and one day */}
      <div className="flex flex-col gap-4 md:hidden">
        <div role="group" aria-label="Days" className="grid grid-cols-7 gap-1.5">
          {week.days.map((d) => {
            const on = d.day === current.day;
            return (
              <button
                key={d.day}
                type="button"
                aria-pressed={on}
                onClick={() => setSelected(d.day)}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center rounded-xl text-xs font-semibold",
                  on ? "bg-plum text-primary-foreground" : "bg-card text-muted-strong",
                )}
              >
                {dow(d.day)}
                <span className="font-heading text-lg font-bold">{d.day.slice(8).replace(/^0/, "")}</span>
              </button>
            );
          })}
        </div>
        <DayColumn day={current} selected today={today!} showReason={showReasons} />
      </div>

      {/* Desktop: seven columns, scrolling inside their own box when narrow */}
      <div className="hidden overflow-x-auto pb-1.5 md:block">
        <div className="grid min-w-275 grid-cols-7 gap-3">
          {week.days.map((d) => (
            <DayColumn
              key={d.day}
              day={d}
              selected={d.day === current.day}
              today={today!}
              showReason={showReasons}
              onSelect={() => setSelected(d.day)}
            />
          ))}
        </div>
      </div>

      <section aria-label="Lights" className="flex items-center gap-3 rounded-[20px] border border-line bg-card px-5 py-4.5">
        <LedDot
          color="purple"
          className="text-sm leading-snug text-muted-strong"
          label={
            <span role="status">
              {lit ? (
                lit.length > 0 ? (
                  <>
                    <strong className="text-ink">{longDay(tomorrow)}:</strong> {formatHangers(lit).toLowerCase()}{" "}
                    {lit.length > 1 ? "are" : "is"} glowing purple. Open the closet and they&apos;re
                    ready.
                  </>
                ) : (
                  "Nothing is planned on a hanger for tomorrow, so no lights this time."
                )
              ) : lights.isError ? (
                "We couldn't reach the hub just now. Try again in a moment."
              ) : tomorrowPlan ? (
                <>
                  <strong className="text-ink">{longDay(tomorrow)}:</strong> &ldquo;Light up tomorrow&rdquo; makes these{" "}
                  {tomorrowPlan.pieces.length} hangers glow purple, steady.
                </>
              ) : (
                "Tomorrow starts next week's plan."
              )}
            </span>
          }
        />
      </section>
    </div>
  );
}

function DayColumn({
  day: d,
  selected,
  today,
  showReason,
  onSelect,
}: {
  day: PlanDay;
  selected: boolean;
  today: string;
  showReason: boolean;
  onSelect?: () => void;
}) {
  const Icon = d.weather ? WEATHER_ICON[d.weather.condition] : null;
  return (
    <section
      aria-label={longDay(d.day)}
      className={cn(
        "flex flex-col gap-3 rounded-[18px] border-2 p-3.5",
        selected ? "border-plum bg-plum-soft text-plum" : "border-line bg-cream",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={!onSelect}
        aria-pressed={onSelect ? selected : undefined}
        className="flex min-h-11 items-center justify-between text-left"
      >
        <span className="flex flex-col">
          <span className="text-xs font-semibold tracking-wider uppercase">
            {dow(d.day)}
            {d.day === today && " · today"}
          </span>
          <span className="font-heading text-[26px] leading-tight font-bold">{d.day.slice(8).replace(/^0/, "")}</span>
        </span>
        {d.weather && Icon && (
          <span className="flex flex-col items-end gap-0.5 text-[13px] font-semibold">
            <Icon aria-label={d.weather.summary} className="size-5" strokeWidth={1.9} />
            {d.weather.high_c}°
          </span>
        )}
      </button>
      {d.events.length > 0 && (
        <ul className="flex flex-col gap-1">
          {d.events.map((e) => (
            <li
              key={e.title}
              className={cn(
                "rounded-lg px-2 py-1 text-xs font-medium",
                selected ? "bg-card text-plum" : "bg-lilac text-muted-strong",
              )}
            >
              {e.title}
              {e.time && ` ${e.time}`}
            </li>
          ))}
        </ul>
      )}
      <ul className="flex flex-col gap-2">
        {d.pieces.map((p) => (
          <li key={p.slot} className="flex items-center gap-2 rounded-xl border border-lilac bg-card p-1.5 text-ink">
            <span
              className={cn(
                "relative flex size-10 shrink-0 items-center justify-center rounded-[9px]",
                p.mystery ? "border-2 border-dashed border-heat-2 bg-plum-soft" : "bg-lilac",
              )}
            >
              {p.mystery ? (
                <span aria-hidden className="font-heading text-lg font-bold text-plum">
                  ?
                </span>
              ) : (
                <GarmentThumb garment={p} hangerNumber={p.hangerNumber} sizes="40px" />
              )}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[13px] leading-tight font-semibold">{p.name ?? `Hanger ${p.hangerNumber}`}</span>
              <span className="text-[11px] text-muted-foreground">
                {p.mystery ? "Mystery pick" : `H${p.hangerNumber}`}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {showReason && d.reason && (
        <p className="rounded-[10px] bg-peach-soft px-2.5 py-2 text-xs leading-snug text-ink">{d.reason}</p>
      )}
    </section>
  );
}

function PlanSkeleton() {
  return (
    <div aria-busy="true" aria-label="Planning your week" className="flex flex-col gap-6 px-5 pt-7 pb-12 md:px-10 md:pt-8">
      <div className="h-10 w-56 animate-pulse rounded-lg bg-heat-0" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="h-80 animate-pulse rounded-[18px] bg-heat-0" />
        ))}
      </div>
    </div>
  );
}
