import { describe, expect, test } from "vitest";
import { SwipeDecisionRequest, SwipeDeckResponse } from "./swipe";

const garmentId = "00000000-0000-0000-0000-000000000218";

describe("swipe schemas", () => {
  test("let_go needs a route; keep and style don't take one", () => {
    expect(SwipeDecisionRequest.safeParse({ garment_id: garmentId, decision: "let_go", route: "donate" }).success).toBe(true);
    expect(SwipeDecisionRequest.safeParse({ garment_id: garmentId, decision: "let_go" }).success).toBe(false);
    expect(SwipeDecisionRequest.parse({ garment_id: garmentId, decision: "keep", route: "donate" })).toEqual({
      garment_id: garmentId,
      decision: "keep",
    });
  });

  test("a card without a photo still has a hanger number", () => {
    const card = {
      garment_id: garmentId,
      hanger_number: 24,
      name: null,
      photo_path: null,
      category: null,
      idle_days_in_season: 427,
      browsed_count: 0,
      wears_90d: 0,
      waiting_since: "2025-08-22",
      price_cents: null,
    };
    expect(SwipeDeckResponse.safeParse({ cards: [card], lit_hanger: 24 }).success).toBe(true);
    expect(SwipeDeckResponse.safeParse({ cards: [], lit_hanger: null }).success).toBe(true);
  });
});
