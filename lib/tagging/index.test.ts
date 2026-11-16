import { describe, expect, it } from "vitest";
import { tagUpdate, type GarmentTags } from "./index";

const tags: GarmentTags = {
  is_garment: true,
  name: "  Burgundy silk blouse ",
  category: "top",
  color: "burgundy",
  seasons: ["spring", "fall", "fall"],
  formality: 4.4,
};

describe("tagUpdate", () => {
  it("fills in a garment nobody described yet", () => {
    expect(tagUpdate({ name: null, category: null, tags_source: null }, tags, false)).toEqual({
      name: "Burgundy silk blouse",
      category: "top",
      color: "burgundy",
      seasons: ["spring", "fall"],
      formality: 4,
      tags_source: "ai",
    });
  });

  it("replaces earlier AI tags", () => {
    expect(tagUpdate({ name: "Red top", category: "top", tags_source: "ai" }, tags, false)?.name).toBe("Burgundy silk blouse");
  });

  it("leaves what the user typed, unless asked to re-identify", () => {
    const typed = { name: "My blouse", category: "top", tags_source: "user" };
    expect(tagUpdate(typed, tags, false)).toBeNull();
    expect(tagUpdate(typed, tags, true)?.tags_source).toBe("ai");
  });

  it("keeps formality on the 1-5 scale", () => {
    expect(tagUpdate({ name: null, category: null, tags_source: null }, { ...tags, formality: 9 }, false)?.formality).toBe(5);
  });
});
