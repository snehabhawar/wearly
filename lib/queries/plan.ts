import { Forecast, GarmentCategory, type ForecastDay } from "@/lib/api";
import { DEMO_WEEK_EVENTS, type PlanEvent } from "@/lib/planner/demo-events";
import { addDays } from "@/lib/planner/plan";

/** A planned piece as the Plan screen shows it */
export type PlanPiece = {
  slot: GarmentCategory;
  name: string | null;
  category: GarmentCategory | null;
  color: string | null;
  photoPath: string | null;
  hangerNumber: number | null;
  mystery: boolean;
};

export type PlanDay = {
  day: string;
  weather: ForecastDay | null;
  events: PlanEvent[];
  pieces: PlanPiece[];
  reason: string | null;
};

export type WeekPlan = { id: string; weekStart: string; days: PlanDay[] };

/** A plans row with its items, as read under RLS */
export type PlanRow = {
  id: string;
  week_start: string;
  forecast: unknown;
  plan_items: {
    day: string;
    slot: string;
    reason: string | null;
    garments: { name: string | null; category: string | null; color: string | null; photo_path: string | null } | null;
    hangers: { number: number } | null;
  }[];
};

/** Dresses come first, then top, bottom and the layer, the way you'd put them on */
const SLOT_ORDER: GarmentCategory[] = ["one_piece", "top", "bottom", "outer"];

/** The week's seven days from a plan row: forecast (when stored), demo events and the pieces in slot order */
export function toWeekPlan(row: PlanRow): WeekPlan {
  const forecast = Forecast.safeParse(row.forecast);
  const days: PlanDay[] = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(row.week_start, i);
    const items = row.plan_items
      .filter((it) => it.day === day)
      .sort((a, b) => SLOT_ORDER.indexOf(GarmentCategory.parse(a.slot)) - SLOT_ORDER.indexOf(GarmentCategory.parse(b.slot)));
    return {
      day,
      weather: forecast.success ? (forecast.data.find((f) => f.day === day) ?? null) : null,
      events: DEMO_WEEK_EVENTS[i] ?? [],
      reason: items[0]?.reason ?? null,
      pieces: items.map((it) => {
        const category = it.garments?.category ? GarmentCategory.parse(it.garments.category) : null;
        return {
          slot: GarmentCategory.parse(it.slot),
          name: it.garments?.name ?? null,
          category,
          color: it.garments?.color ?? null,
          photoPath: it.garments?.photo_path ?? null,
          hangerNumber: it.hangers?.number ?? null,
          mystery: category === null,
        };
      }),
    };
  });
  return { id: row.id, weekStart: row.week_start, days };
}
