/**
 * Wear thresholds: the only place durations live (see CLAUDE.md rules).
 *
 * Each value is the exclusive upper bound of a classification, measured from the
 * moment a garment leaves to the moment it comes back:
 *   < browsedUnder     browsed      considered, not a wear
 *   < triedOnUnder     tried_on     soft signal, not a wear
 *   < wornUnder        worn         one wear
 *   < washedUnder      worn_washed  one wear, resets "wears since wash"
 *   >= washedUnder     missing
 *
 * These are starting guesses; tune them from real hanger data (docs/backend.md).
 */
export type WearProfileName = "real" | "demo";

export type WearProfile = {
  browsedUnder: number;
  triedOnUnder: number;
  wornUnder: number;
  washedUnder: number;
};

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const WEAR_PROFILES: Record<WearProfileName, WearProfile> = {
  real: {
    browsedUnder: 20 * MINUTE,
    triedOnUnder: 3 * HOUR,
    wornUnder: 36 * HOUR,
    washedUnder: 14 * DAY,
  },
  // Seconds, so the live demo can show every classification in under a minute
  demo: {
    browsedUnder: 5 * SECOND,
    triedOnUnder: 12 * SECOND,
    wornUnder: 20 * SECOND,
    washedUnder: 60 * SECOND,
  },
};
