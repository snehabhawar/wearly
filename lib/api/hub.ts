import { z } from "zod";
import { HangerNumber, Light } from "./common";

/*
 * Hub contract (firmware). Shared with the ESP32 hub: change only together with
 * docs/api.md and the firmware team. /api/sim/events uses the same bodies.
 */

/** One hanger's full current state (both sensors), not a diff */
export const HubEvent = z.object({
  hanger: HangerNumber,
  on_rail: z.boolean(),
  garment_on: z.boolean(),
  /** How long ago it happened; the server sets occurred_at = now() - age_ms */
  age_ms: z.int().min(0).default(0),
  /** Per-hanger counter, used to drop duplicates after retries */
  seq: z.int().optional(),
});
export type HubEvent = z.infer<typeof HubEvent>;

/** POST /api/hub/events and POST /api/sim/events */
export const HubEventsRequest = z.object({
  /** Oldest first */
  events: z.array(HubEvent).min(1).max(100),
});
export type HubEventsRequest = z.infer<typeof HubEventsRequest>;

export const HubEventsResponse = z.object({
  accepted: z.int().min(0),
  duplicates: z.int().min(0),
  /** Reported, not rejected, so the app can offer to register them */
  unknown_hangers: z.array(HangerNumber),
});
export type HubEventsResponse = z.infer<typeof HubEventsResponse>;

/** GET /api/hub/commands: at most one pending command per hanger */
export const HubCommand = z.intersection(
  z.object({ id: z.int(), hanger: HangerNumber }),
  Light,
);
export type HubCommand = z.infer<typeof HubCommand>;

export const HubCommandsResponse = z.object({ commands: z.array(HubCommand) });
export type HubCommandsResponse = z.infer<typeof HubCommandsResponse>;

/** POST /api/hub/commands/ack, answered with 204 */
export const HubAckRequest = z.object({ ids: z.array(z.int()).min(1) });
export type HubAckRequest = z.infer<typeof HubAckRequest>;
