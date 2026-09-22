import { cn } from "cn";
import { ArrowDownLeft, ArrowUpRight, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { Amount } from "@/components/app/amount";
import type { TimelineEntry } from "@/lib/activity";

const PRESENTATION = {
  borrow: {
    icon: ArrowUpRight,
    iconClass: "bg-muted text-muted-foreground",
    verb: "borrowed",
    amountClass: "text-foreground",
  },
  repayment: {
    icon: ArrowDownLeft,
    iconClass: "bg-money-positive/12 text-money-positive",
    verb: "repaid",
    amountClass: "text-money-positive",
  },
  overdue: {
    icon: TriangleAlert,
    iconClass: "bg-money-danger/12 text-money-danger",
    verb: "became overdue",
    amountClass: "text-money-danger",
  },
} as const;

/** One line of the ledger: money out, money back, or a debt going past due. */
export function ActivityItem({ entry }: { entry: TimelineEntry }) {
  const { icon: Icon, iconClass, verb, amountClass } = PRESENTATION[entry.kind];

  return (
    <Link
      href={`/debts/${entry.debtId}`}
      className="tap-transparent hover:bg-muted/40 focus-visible:ring-ring flex items-center gap-3 px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:-outline-offset-2"
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", iconClass)}>
        <Icon className="size-4" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          <span className="font-medium">{entry.borrowerName}</span>
          {entry.kind === "overdue" ? <>&rsquo;s debt {verb}</> : <> {verb}</>}
        </p>
        {entry.detail ? <p className="text-muted-foreground truncate text-xs">{entry.detail}</p> : null}
      </div>

      <Amount
        minor={entry.amountMinor}
        className={cn("shrink-0 text-sm font-semibold", amountClass)}
      />
    </Link>
  );
}
