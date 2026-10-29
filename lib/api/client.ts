import type { z } from "zod";
import {
  ErrorBody,
  FindHangerResponse,
  SwipeDecisionResponse,
  SwipeDeckResponse,
  type SwipeDecisionRequest,
} from "./index";

/*
 * Typed fetch helpers for the app's /api/* writes (docs/frontend.md, Data fetching).
 * Responses are checked with the same Zod schemas the route handlers use.
 */

/** A non-2xx answer, with the ErrorBody the route sent */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`API answered ${status} ${code}`);
  }
}

async function call<S extends z.ZodType>(path: string, schema: S, init: RequestInit = {}): Promise<z.infer<S>> {
  const res = await fetch(path, {
    ...init,
    headers: init.body ? { "Content-Type": "application/json", ...init.headers } : init.headers,
  });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, ErrorBody.safeParse(json).data?.error.code ?? "unknown");
  return schema.parse(json);
}

/** POST /api/hangers/{n}/find: the hanger blinks white twice */
export function findHanger(hangerNumber: number) {
  return call(`/api/hangers/${hangerNumber}/find`, FindHangerResponse, { method: "POST" });
}

/** GET /api/swipe/deck: the ordered cards; the top card's hanger starts breathing amber */
export function getSwipeDeck() {
  return call("/api/swipe/deck", SwipeDeckResponse);
}

/** POST /api/swipe/decisions */
export function decideSwipe(decision: SwipeDecisionRequest) {
  return call("/api/swipe/decisions", SwipeDecisionResponse, { method: "POST", body: JSON.stringify(decision) });
}
