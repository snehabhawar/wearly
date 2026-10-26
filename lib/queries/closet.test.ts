import { expect, test } from "vitest";
import { heatLevel, isWaiting } from "./closet";
import { FIXTURE_CLOSET } from "./fixtures";

test("heat levels", () => {
  expect([0, 1, 4, 5, 12, 13, 40].map(heatLevel)).toEqual([0, 1, 1, 2, 2, 3, 3]);
});

test("the fixture's waiting garments are the seed's forgotten hangers plus the old mystery ones", () => {
  const waiting = FIXTURE_CLOSET.filter(isWaiting).map((i) => i.hangerNumber);
  expect(waiting).toEqual([8, 12, 18, 22, 23, 24]);
});
