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
};

/** Index 0 = Monday */
export const DEMO_WEEK_EVENTS: PlanEvent[][] = [
  [{ title: "Standup", time: "9:00", dress: 3 }],
  [
    { title: "Gym", time: "7:00", dress: 1 },
    { title: "Client call", time: "14:00", dress: 3 },
  ],
  [{ title: "Lunch with Mai", time: "12:30", dress: 2 }],
  [{ title: "Dinner out", time: "19:30", dress: 3 }],
  [{ title: "Presentation", time: "10:00", dress: 4 }],
  [{ title: "Party", time: "20:00", dress: 3 }],
  [],
];

/** When a day has no events */
export const DEFAULT_DRESS = 2;
