/**
 * The browser's IANA timezone, carried to the server in a cookie.
 *
 * Debt statuses are derived during server rendering, and the server runs on
 * UTC. Without knowing the user's zone it would mark debts overdue on its own
 * schedule rather than theirs.
 *
 * The name, the encoding and both halves of the read/write pair live here so
 * the client component that sets it (components/app/timezone-sync.tsx) and the
 * server helper that reads it (server/today.ts) cannot drift apart.
 */

export const TIMEZONE_COOKIE = "ledger_tz";

/** A year: the zone rarely changes, and a stale value self-corrects on load. */
const MAX_AGE_SECONDS = 31_536_000;

/** Decode a raw cookie value. Exported for the server, which reads it undecoded. */
export function decodeTimezone(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return undefined;
  }
}

/** Read the zone this browser last reported, if any. */
export function readTimezoneCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;

  const match = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${TIMEZONE_COOKIE}=`));

  return decodeTimezone(match?.slice(TIMEZONE_COOKIE.length + 1));
}

/**
 * Record this browser's zone.
 *
 * Lax so it still rides along on top-level navigations into the installed PWA,
 * and Secure everywhere except plain-HTTP local development.
 */
export function writeTimezoneCookie(zone: string): void {
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${TIMEZONE_COOKIE}=${encodeURIComponent(zone)}; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}
