"use client";

import { cn } from "cn";

import { Amount } from "@/components/app/amount";
import type { Minor } from "@/lib/money";

interface RepaymentProgressProps {
  repaidMinor: Minor;
  originalMinor: Minor;
  outstandingMinor: Minor;
  percent: number;
  className?: string;
  /** Hides the "x of y repaid" caption for tight layouts. */
  compact?: boolean;
}

/**
 * How much of a debt has come back.
 *
 * Deliberately a thin bar with the numbers written out beside it - the figures
 * are the point, the bar is only there to make progress scannable.
 */
export function RepaymentProgress({
  repaidMinor,
  originalMinor,
  outstandingMinor,
  percent,
  className,
  compact = false,
}: RepaymentProgressProps) {
  const settled = outstandingMinor <= 0;

  return (
    <div className={cn("space-y-1.5", className)}>
      {!compact ? (
        <div className="text-muted-foreground flex items-baseline justify-between gap-2 text-xs">
          <span>
            <Amount minor={repaidMinor} className="text-foreground font-medium" /> of{" "}
            <Amount minor={originalMinor} /> repaid
          </span>
          <span className="font-medium tabular-nums">{percent}%</span>
        </div>
      ) : null}

      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Repayment progress"
        className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            settled ? "bg-money-positive" : "bg-primary",
          )}
          style={{ width: `${Math.max(percent, percent > 0 ? 2 : 0)}%` }}
        />
      </div>

      {!compact ? (
        <p className="text-muted-foreground text-xs">
          {settled ? (
            "Fully repaid"
          ) : (
            <>
              Remaining <Amount minor={outstandingMinor} className="text-foreground font-medium" />
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}
