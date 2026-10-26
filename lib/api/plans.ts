import { z } from "zod";
import { HangerNumber, Id, LocalDate } from "./common";

/*
 * Plan endpoints only trigger work. The UI reads the result from `plans` and
 * `plan_items` with supabase-js, so a plan has one shape: the tables.
 */

/** One day of `plans.forecast` (jsonb). The database can't enforce it, so this schema does. */
export const ForecastDay = z.object({
  day: LocalDate,
  high_c: z.number(),
  low_c: z.number(),
  rain: z.boolean(),
  condition: z.enum(["clear", "cloudy", "rain", "snow"]),
  /** Short label for the UI, e.g. "Rain after 4 pm" */
  summary: z.string(),
});
export type ForecastDay = z.infer<typeof ForecastDay>;

export const Forecast = z.array(ForecastDay);
export type Forecast = z.infer<typeof Forecast>;

const isMonday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay() === 1;

/** POST /api/plans/generate */
export const GeneratePlanRequest = z.object({
  week_start: LocalDate.refine(isMonday, "week_start must be a Monday"),
  /** Regenerate even if the week already has a plan */
  replace: z.boolean().default(false),
});
export type GeneratePlanRequest = z.infer<typeof GeneratePlanRequest>;

export const GeneratePlanResponse = z.object({ plan_id: Id });
export type GeneratePlanResponse = z.infer<typeof GeneratePlanResponse>;

/** POST /api/plans/{id}/lights: purple for that day's hangers, other purple hangers off */
export const PlanLightsRequest = z.object({ day: LocalDate });
export type PlanLightsRequest = z.infer<typeof PlanLightsRequest>;

/** Answered with 202 */
export const PlanLightsResponse = z.object({
  command_ids: z.array(z.int()),
  /** Hangers that will glow purple, so the UI can say which ones */
  hangers: z.array(HangerNumber),
});
export type PlanLightsResponse = z.infer<typeof PlanLightsResponse>;
