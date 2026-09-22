"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Light / dark / system theming.
 *
 * `attribute="class"` toggles the `.dark` class the Tailwind tokens key off,
 * and next-themes injects a blocking script so an installed PWA never flashes
 * white before settling into dark mode.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
