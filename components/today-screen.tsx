"use client";

import { ArrowRight, CalendarDays, Cloud, CloudRain, Snowflake, Sun } from "lucide-react";
import Link from "next/link";
import { GarmentThumb } from "@/components/garment-thumb";
import { LedDot } from "@/components/led-dot";
import { Logo } from "@/components/logo";
import { SignOutButton } from "@/components/sign-out-button";
import { SwipeScreen } from "@/components/swipe-screen";
import { Button } from "@/components/ui/button";
import type { ForecastDay } from "@/lib/api";
import { formatHangers, formatSince, mondayOf } from "@/lib/format";
import { isWaiting, type ClosetItem } from "@/lib/queries/closet";
import type { PlanDay } from "@/lib/queries/plan";
import { useCloset } from "@/lib/queries/use-closet";
import { useCurrentCloset } from "@/lib/queries/use-current-closet";
import { useLightPlanDay, usePlan } from "@/lib/queries/use-plan";
import { useToday } from "@/lib/queries/use-today";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

const WEATHER_ICON: Record<ForecastDay["condition"], typeof Sun> = {
  clear: Sun,
  cloudy: Cloud,
  rain: CloudRain,
  snow: Snowflake,
};

const longDate = (day: string) =>
  new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );

function greeting(timeZone: string): string {
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(new Date()));
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** The deck's order (browsed most, worn least, waiting longest), so this card matches the top of Swipe */
function longestWaiting(items: ClosetItem[]): ClosetItem | null {
  return (
    items
      .filter(isWaiting)
      .sort(
        (a, b) =>
          b.browsedCount - a.browsedCount || a.wears90d - b.wears90d || b.idleDaysInSeason - a.idleDaysInSeason,
      )[0] ?? null
  );
}

/**
 * Today: the planned outfit with its weather and a way to light its hangers, plus what's been
 * waiting. Desktop shows the swipe deck beside it (docs/frontend.md); phones link to Swipe instead,
 * so opening Today on a phone doesn't light a hanger amber.
 */
export function TodayScreen() {
  const closet = useCurrentCloset();
  const timeZone = closet.data?.timezone;
  const today = useToday(timeZone);
  const plan = usePlan(today ? mondayOf(today) : null);
  const items = useCloset().data?.items;
  const lights = useLightPlanDay();
  const desktop = useMediaQuery(DESKTOP_QUERY);

  const day = plan.data?.days.find((d) => d.day === today) ?? null;
  const waiting = items ? longestWaiting(items) : null;

  return (
    <div className="flex flex-col gap-6 pb-12">
      <header className="flex flex-col gap-3.5 bg-linear-160 from-plum-soft to-peach-soft px-5 pt-7 pb-5.5 md:flex-row md:items-end md:justify-between md:bg-none md:px-10 md:pt-8 md:pb-0">
        <div className="flex items-center justify-between md:hidden">
          <Logo className="text-[22px]" />
          <SignOutButton iconOnly className="size-11 justify-center rounded-full bg-card px-0 text-plum" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-muted-strong">{today ? longDate(today) : " "}</span>
          <h1 className="text-[32px] leading-tight font-semibold md:text-[40px]">
            {timeZone ? greeting(timeZone) : "Hello"}
          </h1>
        </div>
        {day?.weather && <WeatherChip weather={day.weather} />}
      </header>

      <div className="flex flex-col gap-6 px-4 md:flex-row md:items-start md:px-10">
        <div className="flex min-w-0 flex-col gap-5 md:flex-[3]">
          <section
            aria-labelledby="today-outfit"
            className="flex flex-col gap-4 rounded-3xl bg-card p-5 shadow-[0_1px_2px_color-mix(in_oklab,var(--ink)_6%,transparent),0_8px_28px_color-mix(in_oklab,var(--ink)_7%,transparent)] md:p-6"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="today-outfit" className="text-[22px] font-semibold md:text-[26px]">
                Today&apos;s outfit
              </h2>
              {day && day.events.length > 0 && (
                <span className="text-[13px] text-muted-foreground">
                  {day.events.map((e) => `${e.title}${e.time ? ` at ${e.time}` : ""}`).join(" · ")}
                </span>
              )}
            </div>
            {plan.isPending || !today ? (
              <div aria-busy="true" aria-label="Loading today's outfit" className="h-40 animate-pulse rounded-2xl bg-heat-0" />
            ) : plan.isError || !day ? (
              <p role="alert" className="text-[15px] text-muted-strong">
                We couldn&apos;t put today&apos;s outfit together just now. Your hangers are fine; it&apos;s the connection.
              </p>
            ) : (
              <OutfitPieces day={day} />
            )}
            {day && day.pieces.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-line pt-4">
                <LedDot
                  color="purple"
                  className="text-[13px] leading-snug text-muted-strong"
                  label={
                    <span role="status">
                      {lights.data && lights.variables?.day === day.day
                        ? `${formatHangers(lights.data.hangers)} ${lights.data.hangers.length > 1 ? "are" : "is"} glowing purple, steady.`
                        : lights.isError
                          ? "We couldn't reach the hub just now. Try again in a moment."
                          : "These hangers glow purple when you open the closet."}
                    </span>
                  }
                />
                <div className="flex flex-wrap gap-2.5">
                  <Button
                    disabled={lights.isPending || !plan.data}
                    onClick={() => plan.data && lights.mutate({ planId: plan.data.id, day: day.day })}
                    className="h-11.5 flex-1 rounded-xl font-semibold"
                  >
                    {lights.isPending ? "Lighting…" : "Light them up now"}
                  </Button>
                  <Link
                    href="/plan"
                    className="flex h-11.5 flex-1 items-center justify-center gap-2 rounded-xl bg-plum-soft text-sm font-semibold text-plum"
                  >
                    <CalendarDays aria-hidden className="size-4" />
                    See the week
                  </Link>
                </div>
              </div>
            )}
          </section>

          {!desktop && waiting && today && <WaitingCard item={waiting} today={today} />}
        </div>

        {desktop && (
          <section
            aria-label="Keep or let go"
            className="flex min-w-0 flex-col rounded-3xl bg-card p-6 shadow-[0_1px_2px_color-mix(in_oklab,var(--ink)_6%,transparent),0_8px_28px_color-mix(in_oklab,var(--ink)_7%,transparent)] md:flex-[2]"
          >
            <SwipeScreen embedded />
          </section>
        )}
      </div>
    </div>
  );
}

function WeatherChip({ weather }: { weather: ForecastDay }) {
  const Icon = WEATHER_ICON[weather.condition];
  return (
    <span className="flex items-center gap-2 self-start rounded-full bg-card/70 px-3 py-2 text-[13px] font-medium md:self-auto md:bg-linear-120 md:from-plum-soft md:to-peach-soft md:px-4 md:py-2.5 md:text-sm">
      <Icon aria-hidden className="size-4.5 text-plum" strokeWidth={1.8} />
      {weather.high_c}° high · {weather.summary.toLowerCase()}
    </span>
  );
}

function OutfitPieces({ day }: { day: PlanDay }) {
  if (day.pieces.length === 0) {
    return <p className="text-[15px] text-muted-strong">Nothing planned on a hanger today. Wear what feels right.</p>;
  }
  return (
    <>
      <ul className="grid grid-cols-3 gap-2.5 md:flex md:flex-col">
        {day.pieces.map((p) => (
          <li key={p.slot} className="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-3.5 md:rounded-2xl md:border md:border-lilac md:p-2">
            <span
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-2xl md:size-15 md:shrink-0 md:rounded-xl",
                p.mystery ? "flex-col gap-0.5 border-2 border-dashed border-heat-2 bg-plum-soft" : "bg-lilac",
              )}
            >
              {p.mystery ? (
                <>
                  <span aria-hidden className="font-heading text-[28px] font-bold text-plum md:text-2xl">
                    ?
                  </span>
                  <span className="text-[10px] font-semibold tracking-wide text-plum uppercase md:hidden">Mystery pick</span>
                </>
              ) : (
                <GarmentThumb garment={p} hangerNumber={p.hangerNumber} sizes="(min-width: 768px) 60px, 30vw" />
              )}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[13px] leading-tight font-semibold md:text-[15px]">
                {p.name ?? `Hanger ${p.hangerNumber}`}
              </span>
              <span className="text-[11px] text-muted-foreground md:text-[13px]">
                {p.mystery ? "No photo yet" : `Hanger ${p.hangerNumber}`}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {day.reason && <p className="rounded-xl bg-peach-soft px-3 py-2.5 text-[13px] leading-snug text-ink">{day.reason}</p>}
    </>
  );
}

/** The longest-waiting garment, on phones, as a way into the deck */
function WaitingCard({ item, today }: { item: ClosetItem; today: string }) {
  const subject = item.name ? `The ${item.name.toLowerCase()}` : `Hanger ${item.hangerNumber}`;
  const since = item.lastWornOn ? `since ${formatSince(item.lastWornOn, today)}` : "a while";
  return (
    <Link href="/swipe" className="flex items-center gap-3.5 rounded-[18px] bg-peach-soft px-4 py-3.5 text-ink">
      <span className="relative flex size-13 shrink-0 items-center justify-center rounded-[14px] bg-card">
        <GarmentThumb garment={item} hangerNumber={item.hangerNumber} sizes="52px" />
      </span>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-[11px] font-bold tracking-wider text-amber-ink uppercase">Waiting for you</span>
        <span className="text-sm leading-snug font-medium">
          {subject} has been waiting {since}. Keep it or let it go?
        </span>
      </span>
      <ArrowRight aria-hidden className="size-5 shrink-0 text-amber-ink" />
    </Link>
  );
}
