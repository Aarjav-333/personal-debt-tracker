"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { readTimezoneCookie, writeTimezoneCookie } from "@/lib/timezone";

/**
 * Tells the server which calendar the user actually lives in.
 *
 * Debt statuses are derived during server rendering, so without this the
 * server would use UTC and mark debts overdue on its own schedule rather than
 * the user's. Refreshes once, only when the zone has actually changed, so a
 * traveller's first load re-renders against the right day.
 */
export function TimezoneSync() {
  const router = useRouter();

  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone || readTimezoneCookie() === zone) return;

    writeTimezoneCookie(zone);
    router.refresh();
  }, [router]);

  return null;
}
