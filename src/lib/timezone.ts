/**
 * Name of the cookie carrying the browser's IANA timezone.
 *
 * Lives in its own module so the client component that writes it and the
 * server helper that reads it can share the constant without the client
 * pulling in a `server-only` import.
 */
export const TIMEZONE_COOKIE = "ledger_tz";
