"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";

import { RetryButton } from "@/components/app/retry-button";

/**
 * Catches a failed load inside the app shell.
 *
 * A read failing means the figures on screen would be wrong or missing, so it
 * always says so rather than rendering an empty ledger that looks like
 * "nobody owes you anything".
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ledger] failed to load", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <span className="bg-money-danger/12 text-money-danger mb-5 flex size-14 items-center justify-center rounded-full">
        <TriangleAlert className="size-7" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold">Couldn&rsquo;t load your ledger</h1>
      <p className="text-muted-foreground mt-2 max-w-xs text-sm text-balance">
        Nothing has been changed. This is usually a connection problem &mdash; try again in a
        moment.
      </p>
      <RetryButton className="mt-6" onRetry={reset} />
    </div>
  );
}
