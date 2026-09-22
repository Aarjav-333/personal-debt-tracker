/**
 * Currency configuration.
 *
 * The app ships with INR as the default, but every formatting decision goes
 * through this table so additional currencies can be added later without
 * touching call sites.
 */

export type CurrencyCode = "INR" | "USD" | "EUR" | "GBP" | "AED";

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  /** BCP-47 locale that produces the grouping this currency is written with. */
  locale: string;
  /** Number of minor units in one major unit (paise per rupee, cents per dollar). */
  minorUnits: number;
  label: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  INR: {
    code: "INR",
    symbol: "\u20B9",
    locale: "en-IN",
    minorUnits: 100,
    label: "Indian Rupee",
  },
  USD: { code: "USD", symbol: "$", locale: "en-US", minorUnits: 100, label: "US Dollar" },
  EUR: { code: "EUR", symbol: "\u20AC", locale: "de-DE", minorUnits: 100, label: "Euro" },
  GBP: { code: "GBP", symbol: "\u00A3", locale: "en-GB", minorUnits: 100, label: "British Pound" },
  AED: { code: "AED", symbol: "\u062F.\u0625", locale: "en-AE", minorUnits: 100, label: "UAE Dirham" },
};

export const DEFAULT_CURRENCY: CurrencyCode = "INR";

export const CURRENCY_OPTIONS = Object.values(CURRENCIES);

export function getCurrency(code: string | null | undefined): CurrencyConfig {
  if (code && code in CURRENCIES) return CURRENCIES[code as CurrencyCode];
  return CURRENCIES[DEFAULT_CURRENCY];
}
