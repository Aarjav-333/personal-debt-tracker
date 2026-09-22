import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { isValidTimeZone, startOfTodayInZone } from "@/lib/dates";
import { TIMEZONE_COOKIE } from "@/lib/timezone";

/**
 * "Today", as the user's own calendar sees it.
 *
 * Debt status is derived on the server, but the server runs on UTC while the
 * user lives somewhere else. Between midnight and 05:30 in India the server is
 * still on the previous date, so a debt due yesterday would render as Due Soon
 * rather than Overdue, be missing from the dashboard's overdue total, and get
 * no marker in the activity ledger.
 *
 * The browser writes its IANA zone into a cookie (see TimezoneSync); this reads
 * it back. Falls back to UTC on the very first request, before the cookie
 * exists - TimezoneSync refreshes the route once it has set it.
 */
export const getToday = cache(async (): Promise<Date> => {
  const store = await cookies();
  // The client percent-encodes the value; cookies().get() returns it raw.
  const raw = store.get(TIMEZONE_COOKIE)?.value;
  const zone = raw ? decodeURIComponent(raw) : undefined;
  return startOfTodayInZone(isValidTimeZone(zone) ? zone : "UTC");
});
