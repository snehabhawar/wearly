/** Display helpers. Dates are YYYY-MM-DD strings already in the closet's timezone. */

const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const monthName = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" });
const monthYear = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

const asUtc = (date: string) => new Date(`${date}T00:00:00Z`);

/** "Oct 21" */
export function formatMonthDay(date: string): string {
  return monthDay.format(asUtc(date));
}

/** "October" */
export function formatMonth(date: string): string {
  return monthName.format(asUtc(date));
}

/** Today as YYYY-MM-DD in a timezone, e.g. the closet's */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** "March" for a date in today's year, "May 2025" for an earlier one. For copy like "waiting since March" */
export function formatSince(date: string, today: string): string {
  return date.slice(0, 4) === today.slice(0, 4) ? formatMonth(date) : monthYear.format(asUtc(date));
}

/** "$2.05" */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** The instant a local day starts in a timezone, e.g. midnight in New York as a UTC Date */
export function localMidnight(day: string, timeZone: string): Date {
  const guess = new Date(`${day}T00:00:00Z`);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(guess)
      .map((p) => [p.type, p.value]),
  );
  const shownAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess.getTime() - (shownAsUtc - guess.getTime()));
}

/** The Monday on or before a YYYY-MM-DD date: the start of its plan week */
export function mondayOf(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
