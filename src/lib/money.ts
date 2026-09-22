import { CURRENCIES, DEFAULT_CURRENCY, getCurrency, type CurrencyCode } from "@/lib/currency";

/**
 * Money handling.
 *
 * Postgres stores every amount as NUMERIC(14,2) so nothing is ever lost at
 * rest. In JavaScript we immediately convert to integer minor units (paise)
 * and do *all* arithmetic there, because 0.1 + 0.2 !== 0.3 in binary floats
 * and this app adds up financial records.
 *
 * Rule of thumb: the database and the network speak major units, every
 * calculation in the app speaks minor units.
 */

/** A branded integer count of minor units (paise). */
export type Minor = number;

const MINOR = CURRENCIES[DEFAULT_CURRENCY].minorUnits;

/** Largest amount the app accepts, in major units. Keeps us inside NUMERIC(14,2). */
export const MAX_AMOUNT = 999_999_999.99;

/** Convert a major-unit value (from Postgres / a form) into integer minor units. */
export function toMinor(amount: number | string | null | undefined): Minor {
  if (amount === null || amount === undefined || amount === "") return 0;
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return 0;
  // Round through a string to dodge cases like 1.005 * 100 === 100.49999999999999
  return Math.round(Number((value * MINOR).toFixed(4)));
}

/** Convert integer minor units back to a major-unit number. */
export function fromMinor(minor: Minor): number {
  return Math.round(minor) / MINOR;
}

/**
 * Serialise minor units for Postgres NUMERIC. Sent as a string so the value
 * never round-trips through a float on the wire.
 */
export function minorToNumericString(minor: Minor): string {
  return (Math.round(minor) / MINOR).toFixed(2);
}

export function sumMinor(values: Array<number | string | null | undefined>): Minor {
  return values.reduce<number>((total, value) => total + toMinor(value), 0);
}

/** Add already-minor values. Separate from sumMinor so intent stays readable. */
export function addMinor(...values: Minor[]): Minor {
  return values.reduce((total, value) => total + Math.round(value), 0);
}

export interface FormatMoneyOptions {
  currency?: CurrencyCode | string;
  /** Always render two decimal places, even for whole amounts. */
  alwaysShowDecimals?: boolean;
  /** Render without the currency symbol. */
  hideSymbol?: boolean;
}

/**
 * Format minor units for display, using the currency's own grouping.
 * INR renders in the Indian system: 1,000 / 15,500 / 1,25,000.
 */
export function formatMinor(minor: Minor, options: FormatMoneyOptions = {}): string {
  const config = getCurrency(options.currency ?? DEFAULT_CURRENCY);
  const value = Math.round(minor) / config.minorUnits;
  const hasPaise = Math.round(minor) % config.minorUnits !== 0;
  const fractionDigits = options.alwaysShowDecimals || hasPaise ? 2 : 0;

  return new Intl.NumberFormat(config.locale, {
    style: options.hideSymbol ? "decimal" : "currency",
    currency: config.code,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    currencyDisplay: "narrowSymbol",
  }).format(value);
}

/** Convenience wrapper for values that arrive from Postgres in major units. */
export function formatAmount(
  amount: number | string | null | undefined,
  options: FormatMoneyOptions = {},
): string {
  return formatMinor(toMinor(amount), options);
}

/**
 * Parse free-text amount input from a form field.
 * Accepts "1,250", "1250.50", "\u20B91,250" and rejects anything else.
 */
export function parseAmountInput(raw: string): { ok: true; minor: Minor } | { ok: false; error: string } {
  const cleaned = raw.replace(/[\s,\u20B9$\u20AC\u00A3]/g, "").trim();
  if (!cleaned) return { ok: false, error: "Enter an amount" };
  if (!/^\d*\.?\d*$/.test(cleaned)) return { ok: false, error: "Amount can only contain numbers" };

  const value = Number(cleaned);
  if (!Number.isFinite(value)) return { ok: false, error: "Enter a valid amount" };
  if (value <= 0) return { ok: false, error: "Amount must be greater than zero" };
  if (value > MAX_AMOUNT) return { ok: false, error: "That amount is too large" };

  const decimals = cleaned.split(".")[1];
  if (decimals && decimals.length > 2) return { ok: false, error: "Use at most 2 decimal places" };

  return { ok: true, minor: toMinor(value) };
}

/** Percentage of a debt that has been repaid, clamped to 0..100. */
export function repaidPercent(repaidMinor: Minor, originalMinor: Minor): number {
  if (originalMinor <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((repaidMinor / originalMinor) * 100)));
}
