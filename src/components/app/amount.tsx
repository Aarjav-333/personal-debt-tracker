"use client";

import { cn } from "cn";

import { useCurrency } from "@/components/app/currency-provider";
import { formatMinor, type Minor } from "@/lib/money";

interface AmountProps extends React.ComponentProps<"span"> {
  /** The value in integer minor units (paise). */
  minor: Minor;
  alwaysShowDecimals?: boolean;
  hideSymbol?: boolean;
}

/**
 * Renders a money value in the user's currency.
 *
 * Every amount on screen goes through here, so Indian grouping
 * (₹1,25,000) and tabular figures are applied consistently.
 */
export function Amount({ minor, alwaysShowDecimals, hideSymbol, className, ...props }: AmountProps) {
  const currency = useCurrency();

  return (
    <span
      className={cn("amount", className)}
      // Intl grouping is identical on Node and in the browser, but a locale
      // data difference should degrade to a repaint, not a hydration error.
      suppressHydrationWarning
      {...props}
    >
      {formatMinor(minor, { currency, alwaysShowDecimals, hideSymbol })}
    </span>
  );
}
