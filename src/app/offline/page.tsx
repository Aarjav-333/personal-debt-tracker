import { WifiOff } from "lucide-react";
import type { Metadata } from "next";

import { RetryButton } from "@/components/app/retry-button";

export const metadata: Metadata = { title: "Offline" };

/**
 * Served by the service worker when a screen is requested with no connection
 * and nothing cached for it.
 */
export default function OfflinePage() {
  return (
    <div className="pt-safe pb-safe flex flex-1 flex-col items-center justify-center px-6 text-center">
      <span className="bg-muted text-muted-foreground mb-5 flex size-14 items-center justify-center rounded-full">
        <WifiOff className="size-7" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold">You&rsquo;re offline</h1>
      <p className="text-muted-foreground mt-2 max-w-xs text-sm text-balance">
        Screens you have already opened still work. Anything new &mdash; and any change to your
        records &mdash; needs a connection.
      </p>
      <RetryButton className="mt-6" />
    </div>
  );
}
