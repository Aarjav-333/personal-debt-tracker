import { cn } from "cn";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { Amount } from "@/components/app/amount";
import type { DebtView } from "@/lib/aggregate";
import { formatDayMonth, formatRelativeDays } from "@/lib/dates";

/**
 * Compact row for the dashboard's "Due soon" and "Overdue" lists: who, how
 * much is still pending, and when it was or is due.
 */
export function DueDebtRow({ debt }: { debt: DebtView }) {
  const relative = formatRelativeDays(debt.daysUntilDue);
  const overdue = debt.status === "overdue";

  return (
    <Link
      href={`/debts/${debt.id}`}
      className="tap-transparent hover:bg-muted/40 focus-visible:ring-ring flex items-center gap-3 px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:-outline-offset-2"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{debt.borrowerName}</p>
        <p className="text-muted-foreground text-sm">
          <Amount minor={debt.outstandingMinor} className="text-foreground font-medium" /> pending
          {debt.reason ? <> &middot; {debt.reason}</> : null}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className={cn("text-sm font-medium", overdue ? "text-money-danger" : "text-money-warning")}>
          {relative ?? formatDayMonth(debt.expectedReturnDate)}
        </p>
        <p className="text-muted-foreground text-xs">{formatDayMonth(debt.expectedReturnDate)}</p>
      </div>

      <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
    </Link>
  );
}
