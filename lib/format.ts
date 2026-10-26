/** Display helpers. Dates are YYYY-MM-DD strings already in the closet's timezone. */

const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const monthName = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" });

const asUtc = (date: string) => new Date(`${date}T00:00:00Z`);

/** "Oct 21" */
export function formatMonthDay(date: string): string {
  return monthDay.format(asUtc(date));
}

/** "October" */
export function formatMonth(date: string): string {
  return monthName.format(asUtc(date));
}

/** "$2.05" */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
