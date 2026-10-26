import { z } from "zod";

/** POST /api/hangers/{number}/find: queues white/blink2 on that hanger, answered with 202 */
export const FindHangerResponse = z.object({ command_id: z.int() });
export type FindHangerResponse = z.infer<typeof FindHangerResponse>;
