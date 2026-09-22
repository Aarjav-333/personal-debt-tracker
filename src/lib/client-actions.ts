"use client";

import { toast } from "sonner";

import type { ActionResult } from "@/server/action-result";

/** The wording requirement: financial writes are never attempted offline. */
export const OFFLINE_MESSAGE = "You're offline. Connect to the internet to save changes.";

/**
 * Blocks a write when the device has no connection.
 *
 * The app caches pages for offline reading but deliberately does not queue
 * financial writes: a repayment that silently syncs hours later, possibly out
 * of order, is worse than one that was never recorded.
 */
export function guardOnline(): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    toast.error(OFFLINE_MESSAGE);
    return false;
  }
  return true;
}

/**
 * Runs a Server Action, surfacing whatever comes back.
 *
 * A thrown error means the request never completed - almost always a dropped
 * connection - so it is reported as such rather than as a silent no-op.
 */
export async function runAction<T>(
  action: () => Promise<ActionResult<T>>,
  options: { success?: string; onSuccess?: (data: T) => void } = {},
): Promise<ActionResult<T> | null> {
  if (!guardOnline()) return null;

  try {
    const result = await action();

    if (result.ok) {
      if (options.success) toast.success(options.success);
      options.onSuccess?.(result.data);
    } else {
      toast.error(result.error);
    }

    return result;
  } catch {
    toast.error("Could not reach the server. Check your connection and try again.");
    return null;
  }
}
