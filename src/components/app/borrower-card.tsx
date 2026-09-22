import { cn } from "cn";
import { ChevronRight, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { Amount } from "@/components/app/amount";
import type { BorrowerSummary } from "@/lib/aggregate";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function pluralise(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

/** A borrower's whole position at a glance: lent, returned, still pending. */
export function BorrowerCard({ borrower, className }: { borrower: BorrowerSummary; className?: string }) {
  const settled = borrower.outstandingMinor <= 0;

  return (
    <Link
      href={`/borrowers/${borrower.id}`}
      className={cn(
        "bg-card border-border tap-transparent focus-visible:ring-ring block rounded-xl border p-4 transition-colors",
        "hover:bg-muted/40 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.995]",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="bg-muted text-muted-foreground mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
        >
          {initials(borrower.name)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-semibold">{borrower.name}</p>
            <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
          </div>

          <dl className="mt-3 grid grid-cols-3 gap-2">
            <div>
              <dt className="text-muted-foreground text-[0.6875rem]">Borrowed</dt>
              <dd className="text-sm font-medium">
                <Amount minor={borrower.totalBorrowedMinor} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-[0.6875rem]">Returned</dt>
              <dd className="text-money-positive text-sm font-medium">
                <Amount minor={borrower.totalRepaidMinor} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-[0.6875rem]">Pending</dt>
              <dd
                className={cn(
                  "text-sm font-semibold",
                  settled ? "text-money-positive" : borrower.overdueDebtCount > 0 ? "text-money-danger" : "text-foreground",
                )}
              >
                <Amount minor={borrower.outstandingMinor} />
              </dd>
            </div>
          </dl>

          <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {borrower.debtCount === 0 ? (
              <span>No borrowings yet</span>
            ) : settled ? (
              <span className="text-money-positive font-medium">All settled</span>
            ) : (
              <span>{pluralise(borrower.activeDebtCount, "active debt")}</span>
            )}

            {borrower.overdueDebtCount > 0 ? (
              <span className="text-money-danger inline-flex items-center gap-1 font-medium">
                <TriangleAlert className="size-3" aria-hidden />
                {borrower.overdueDebtCount} overdue
              </span>
            ) : null}

            {borrower.overdueDebtCount === 0 && borrower.dueSoonDebtCount > 0 ? (
              <span className="text-money-warning font-medium">{borrower.dueSoonDebtCount} due soon</span>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}
