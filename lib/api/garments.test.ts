import { describe, expect, test } from "vitest";
import { UpdateGarmentRequest } from "./garments";

describe("garment schemas", () => {
  test("an update needs a name or a category", () => {
    expect(UpdateGarmentRequest.safeParse({}).success).toBe(false);
    expect(UpdateGarmentRequest.safeParse({ category: "top" }).success).toBe(true);
    expect(UpdateGarmentRequest.safeParse({ category: "hat" }).success).toBe(false);
  });

  test("names are trimmed and can't be blank or very long", () => {
    expect(UpdateGarmentRequest.parse({ name: "  Grey hoodie " })).toEqual({ name: "Grey hoodie" });
    expect(UpdateGarmentRequest.safeParse({ name: "   " }).success).toBe(false);
    expect(UpdateGarmentRequest.safeParse({ name: "x".repeat(61) }).success).toBe(false);
  });
});
