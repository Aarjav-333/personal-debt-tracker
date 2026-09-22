"use client";

import { createContext, use } from "react";

import { DEFAULT_CURRENCY, type CurrencyCode } from "@/lib/currency";

const CurrencyContext = createContext<CurrencyCode>(DEFAULT_CURRENCY);

/**
 * Carries the user's chosen currency down the tree.
 *
 * Set once from the profile in the app layout, which lets Server Components
 * render `<Amount>` without threading a currency prop through every list,
 * card and dialog between here and the number on screen.
 */
export function CurrencyProvider({
  currency,
  children,
}: {
  currency: CurrencyCode;
  children: React.ReactNode;
}) {
  return <CurrencyContext value={currency}>{children}</CurrencyContext>;
}

export function useCurrency(): CurrencyCode {
  return use(CurrencyContext);
}
