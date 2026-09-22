import { differenceInCalendarDays, format, isValid, parse } from "date-fns";

/**
 * Date handling.
 *
 * `borrowed_date`, `expected_return_date` and `repayment_date` are Postgres
 * DATE columns: calendar days with no timezone. Parsing "2026-09-22" with
 * `new Date()` would treat it as UTC midnight and shift it a day backwards
 * for anyone east of Greenwich, so every conversion goes through here.
 */

export const DATE_ONLY_FORMAT = "yyyy-MM-dd";

/** Parse a `yyyy-MM-dd` string into a Date at local midnight. */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = parse(value.slice(0, 10), DATE_ONLY_FORMAT, new Date());
  return isValid(parsed) ? parsed : null;
}

/** Serialise a Date to `yyyy-MM-dd` using its local calendar day. */
export function toDateOnly(date: Date): string {
  return format(date, DATE_ONLY_FORMAT);
}

/** Today's local calendar day as `yyyy-MM-dd`. */
export function todayDateOnly(): string {
  return toDateOnly(new Date());
}

/** Local midnight for today - the reference point for every status check. */
export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Whole calendar days from today until `value`.
 * Negative = in the past, 0 = today, positive = upcoming.
 */
export function daysUntil(value: string | null | undefined, today = startOfToday()): number | null {
  const date = parseDateOnly(value);
  if (!date) return null;
  return differenceInCalendarDays(date, today);
}

/** "Sep 22", or "Sep 22, 2025" when the date is outside the current year. */
export function formatDayMonth(value: string | null | undefined): string {
  const date = parseDateOnly(value);
  if (!date) return "\u2014";
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return format(date, sameYear ? "d MMM" : "d MMM yyyy");
}

/** Full date for detail views: "22 September 2026". */
export function formatFullDate(value: string | null | undefined): string {
  const date = parseDateOnly(value);
  return date ? format(date, "d MMMM yyyy") : "\u2014";
}

/** Human phrasing for a due date: "Today", "Tomorrow", "In 3 days", "5 days ago". */
export function formatRelativeDueDate(
  value: string | null | undefined,
  today = startOfToday(),
): string | null {
  const days = daysUntil(value, today);
  if (days === null) return null;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1) return `In ${days} days`;
  return `${Math.abs(days)} days ago`;
}

/** Timestamp formatting for the activity ledger. */
export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "\u2014";
  const date = new Date(value);
  return isValid(date) ? format(date, "d MMM yyyy, h:mm a") : "\u2014";
}
