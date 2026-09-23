"use client";

import { useEffect, useRef } from "react";

/**
 * How long vaul takes to slide a drawer out (see components/ui/drawer.tsx).
 *
 * State is re-seeded only after the animation finishes, so the user never
 * watches the fields flip back to their old values on the way out.
 */
export const DRAWER_CLOSE_MS = 250;

/**
 * Re-seeds a drawer's form state from its props once it has closed.
 *
 * Drawers stay mounted while shut, so their `useState` initialisers run only
 * once. Without this, a saved edit leaves the old value in the fields: reopen
 * the drawer and it disagrees with the page behind it, and saving again
 * silently reverts the correction.
 *
 * `reset` is called through a ref so it always sees the latest props, which
 * means callers can pass an inline closure without memoising it and without
 * listing every field in a dependency array.
 */
export function useResetOnClose(open: boolean, reset: () => void) {
  const latest = useRef(reset);

  // Updated in an effect rather than during render: effects run in declaration
  // order, so the ref is current before the timer below is ever scheduled.
  useEffect(() => {
    latest.current = reset;
  });

  useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => latest.current(), DRAWER_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [open]);
}
