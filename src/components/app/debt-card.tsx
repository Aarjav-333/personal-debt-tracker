import { cn } from "cn";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { Amount } from "@/components/app/amount";
import { AddRepaymentDrawer } from "@/components/app/repayment-drawer";
import { RepaymentProgress } from "@/components/app/repayment-progress";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import type { DebtView } from "@/lib/aggregate";
import { formatDayMonth, formatRelativeDueDate } from "@/lib/dates";

/**
 * One borrowing occasion.
 *
 * Leads with the original amount because that is the fact the ledger exists to
 * preserve, then shows what has come back against it.
 */
export function DebtCard({
  debt,
  showBorrower = false,
  className,
}: {
  debt: DebtView;
  showBorrower?: boolean;
  className?: string;
}) {
  const settled = debt.outstandingMinor <= 0;
  const dueLabel = formatRelativeDueDate(debt.expectedReturnDate);

  return (
    <article className={cn("bg-card border-border rounded-xl border p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {showBorrower ? (
            <p className="text-muted-foreground truncate text-sm font-medium">{debt.borrowerName}</p>
          ) : null}
          <Amount minor={debt.originalMinor} className="block text-xl font-semibold" />
          <p className="text-muted-foreground mt-0.5 text-xs">
            Borrowed {formatDayMonth(debt.borrowedDate)}
            {debt.reason ? <> &middot; {debt.reason}</> : null}
          </p>
        </div>
        <StatusBadge status={debt.status} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-muted-foreground text-xs">Repaid</dt>
          <dd className="text-money-positive text-base font-semibold">
            <Amount minor={debt.repaidMinor} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Outstanding</dt>
          <dd
            className={cn(
              "text-base font-semibold",
              settled ? "text-money-positive" : debt.status === "overdue" ? "text-money-danger" : "text-foreground",
            )}
          >
            <Amount minor={debt.outstandingMinor} />
          </dd>
        </div>
      </dl>

      {debt.repaymentCount > 0 || settled ? (
        <RepaymentProgress
          className="mt-4"
          repaidMinor={debt.repaidMinor}
          originalMinor={debt.originalMinor}
          outstandingMinor={debt.outstandingMinor}
          percent={debt.progressPercent}
        />
      ) : null}

      {debt.expectedReturnDate ? (
        <p
          className={cn(
            "mt-3 text-xs",
            debt.status === "overdue"
              ? "text-money-danger font-medium"
              : debt.status === "due_soon"
                ? "text-money-warning font-medium"
                : "text-muted-foreground",
          )}
        >
          {settled ? "Was due " : "Due "}
          {formatDayMonth(debt.expectedReturnDate)}
          {!settled && dueLabel ? <> &middot; {dueLabel}</> : null}
        </p>
      ) : (
        <p className="text-muted-foreground mt-3 text-xs">No return date set</p>
      )}

      <div className="mt-4 flex items-center gap-2">
        {!settled ? (
          <AddRepaymentDrawer
            debt={{
              id: debt.id,
              borrowerName: debt.borrowerName,
              originalMinor: debt.originalMinor,
              repaidMinor: debt.repaidMinor,
              outstandingMinor: debt.outstandingMinor,
            }}
            trigger={
              <Button className="flex-1" size="sm">
                Add repayment
              </Button>
            }
          />
        ) : null}
        <Button asChild variant={settled ? "outline" : "ghost"} size="sm" className={settled ? "flex-1" : undefined}>
          <Link href={`/debts/${debt.id}`}>
            {debt.repaymentCount > 0 ? "View history" : "Details"}
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </article>
  );
}
