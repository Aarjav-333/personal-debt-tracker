"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during server render and the first client render, true afterwards.
 *
 * Lets a component wait for hydration before showing browser-only state (a
 * stored theme, `navigator` values) without the setState-in-an-effect pattern
 * that causes a cascading re-render.
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
