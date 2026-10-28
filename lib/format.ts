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

/** "March" for a date in today's year, "May 2025" for an earlier one. For copy like "waiting since March" */
export function formatSince(date: string, today: string): string {
  return date.slice(0, 4) === today.slice(0, 4) ? formatMonth(date) : monthYear.format(asUtc(date));
}

/** "$2.05" */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
