"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const getSnapshot = () => navigator.onLine;

// The server has no network status to report, and assuming "online" keeps the
// markup identical to the first client render.
const getServerSnapshot = () => true;

/**
 * Whether the browser currently has a network connection.
 *
 * Used to block financial writes while offline. `navigator.onLine` only proves
 * there is *a* connection, not that Supabase is reachable, so it is a fast
 * pre-check - the Server Action failing is still the real backstop.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
