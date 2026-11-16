import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/*
 * Photo tagging (docs/backend.md, Photo pipeline): Claude looks at a garment cutout and
 * names it. Plain TS: the caller passes the Anthropic client, so tests can fake it.
 */

/** The project's tagging model (CLAUDE.md): small, fast, and enough to name a garment */
export const TAGGING_MODEL = "claude-haiku-5-5";

/** Colors the app can draw (lib/garment-visuals.ts) */
export const TAG_COLORS = [
  "white", "cream", "beige", "camel", "grey", "black", "navy", "indigo", "blue",
  "green", "olive", "rust", "burgundy", "pink", "red", "multi", "plaid",
] as const;

export const GarmentTags = z.object({
  /** False when the photo shows no single garment (an empty hanger, a person, a blur) */
  is_garment: z.boolean(),
  /** Two to four words, color first: "Burgundy silk blouse" */
  name: z.string(),
  category: z.enum(["top", "bottom", "outer", "one_piece"]),
  color: z.enum(TAG_COLORS),
  seasons: z.array(z.enum(["spring", "summer", "fall", "winter"])),
  /** 1 = lounge, 3 = smart casual, 5 = formal */
  formality: z.number(),
});
export type GarmentTags = z.infer<typeof GarmentTags>;

const PROMPT = `This is a photo of one garment from someone's closet, taken by a camera inside the closet, with the background removed.

Describe it for their wardrobe app:
- is_garment: false if there's no single clear garment (an empty hanger, a person, several items, a blur). Fill the other fields with your best guess anyway.
- name: two to four words, color first, the way a person would say it ("Burgundy silk blouse", "Dark indigo jeans", "Camel wool coat"). No brand names.
- category: top (shirts, tees, sweaters, blouses), bottom (trousers, jeans, skirts, shorts), outer (jackets, coats, blazers, overshirts), one_piece (dresses, jumpsuits).
- color: the closest main color from the allowed list; multi for prints, plaid for checks.
- seasons: when it's comfortable to wear.
- formality: 1 lounge, 2 casual, 3 smart casual, 4 business, 5 formal.`;

/** Claude's tags for a garment photo (JPEG), or null when it's not a garment or Claude declines */
export async function tagGarment(client: Anthropic, jpeg: Buffer): Promise<GarmentTags | null> {
  const response = await client.messages.parse({
    model: TAGGING_MODEL,
    max_tokens: 4000,
    // A quick look is enough to name a garment
    output_config: { effort: "low", format: zodOutputFormat(GarmentTags) },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") } },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  });
  if (response.stop_reason !== "end_turn") return null;
  const tags = response.parsed_output;
  if (!tags?.is_garment) return null;
  return tags;
}

export type TaggableGarment = { name: string | null; category: string | null; tags_source: string | null };

/**
 * What tagging may write: everything when nobody described the garment yet, or when the
 * caller asks to re-identify it; nothing when the user typed its details.
 */
export function tagUpdate(garment: TaggableGarment, tags: GarmentTags, retag: boolean) {
  if (garment.tags_source === "user" && !retag) return null;
  const words = tags.name.trim().split(/\s+/).slice(0, 6).join(" ");
  return {
    name: words.length > 0 ? words.slice(0, 60) : null,
    category: tags.category,
    color: tags.color,
    seasons: [...new Set(tags.seasons)],
    formality: Math.min(5, Math.max(1, Math.round(tags.formality))),
    tags_source: "ai" as const,
  };
}
