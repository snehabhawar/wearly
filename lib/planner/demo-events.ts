/*
 * Hard-coded calendar events for the MVP (docs/backend.md, Planner). Google Calendar comes after MVP.
 * Keyed by weekday so every week of the demo has a plausible calendar.
 */

export type PlanEvent = {
  title: string;
  /** Local start time, for display */
  time: string | null;
  /** Dress code on the garments' formality scale: 1 lounge, 2 casual, 3 smart casual, 4 business, 5 formal */
  dress: 1 | 2 | 3 | 4 | 5;
  /** Garment IDs picked ahead for this event: the planner dresses that day in exactly these */
  outfit?: string[];
};

/** A seeded garment's ID from its seed number (the seed hangs garment n on hanger n) */
const seedGarment = (n: number) => `00000000-0000-0000-0000-0000000002${String(n).padStart(2, "0")}`;

/** Index 0 = Monday */
export const DEMO_WEEK_EVENTS: PlanEvent[][] = [
  [{ title: "Standup", time: "9:00", dress: 3 }],
  [
    { title: "Gym", time: "7:00", dress: 1 },
    { title: "Client call", time: "14:00", dress: 3 },
  ],
  // The cream structured jacket and black tailored trousers (garments 19 and 20)
  [{ title: "Innovation Challenge Final", time: "17:00", dress: 4, outfit: [seedGarment(19), seedGarment(20)] }],
  [{ title: "Dinner out", time: "19:30", dress: 3 }],
  [{ title: "Presentation", time: "10:00", dress: 4 }],
  [{ title: "Party", time: "20:00", dress: 3 }],
  [],
];

/** When a day has no events */
export const DEFAULT_DRESS = 2;
