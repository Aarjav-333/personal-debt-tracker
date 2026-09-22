"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { TIMEZONE_COOKIE } from "@/lib/timezone";

/**
 * Tells the server which calendar the user actually lives in.
 *
 * Debt statuses are derived during server rendering, so without this the
 * server would use UTC and mark debts overdue on its own schedule rather than
 * the user's. Writes the browser's IANA zone to a cookie and refreshes once,
 * the first time it changes, so the current page re-renders against it.
 */
export function TimezoneSync() {
  const router = useRouter();

  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone) return;

    const current = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith(`${TIMEZONE_COOKIE}=`))
      ?.slice(TIMEZONE_COOKIE.length + 1);

    if (current === encodeURIComponent(zone)) return;

    // Lax so it still rides along on top-level navigations into the PWA.
    document.cookie = `${TIMEZONE_COOKIE}=${encodeURIComponent(zone)}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  }, [router]);

  return null;
}
