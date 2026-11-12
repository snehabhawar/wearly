import { expect, test } from "vitest";
import { SwipeCard } from "@/lib/api";
import { FIXTURE_DECK } from "./fixtures";

test("the fixture deck matches the deck endpoint's schema", () => {
  for (const card of FIXTURE_DECK) expect(SwipeCard.parse(card)).toEqual(card);
});

test("the fixture deck puts the often-browsed blouse first, then the longest idle", () => {
  expect(FIXTURE_DECK.map((c) => c.hanger_number)).toEqual([18, 22, 23, 24, 8, 12]);
});
