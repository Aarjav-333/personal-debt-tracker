"use client";

import { WifiOff } from "lucide-react";

import { useOnlineStatus } from "@/hooks/use-online-status";

/**
 * A persistent bar shown whenever the device drops offline.
 *
 * Cached pages still render, so without this the app would look perfectly
 * normal right up until a repayment failed to save.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pt-safe bg-money-warning/15 text-money-warning border-money-warning/30 sticky top-0 z-50 border-b"
    >
      <p className="flex items-center justify-center gap-2 px-4 py-2 text-center text-sm font-medium">
        <WifiOff className="size-4 shrink-0" aria-hidden />
        You&rsquo;re offline &mdash; changes can&rsquo;t be saved right now
      </p>
    </div>
  );
}
