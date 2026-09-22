import { daysUntil, startOfToday } from "@/lib/dates";
import type { Minor } from "@/lib/money";

/**
 * Debt status is *derived*, never stored. A stored status would drift the
 * moment a repayment landed or a due date rolled past, so it is computed from
 * the outstanding balance and the expected return date every time it is read.
 *
 * Statuses are computed here, in the client's local timezone, so "overdue"
 * matches the day the user is actually living in.
 */

export type DebtStatus = "paid" | "overdue" | "due_soon" | "active";

/** A debt counts as "due soon" this many days before its expected return date. */
export const DUE_SOON_WINDOW_DAYS = 3;

export interface DebtStatusInput {
  outstandingMinor: Minor;
  expectedReturnDate: string | null;
}

export function deriveDebtStatus(
  { outstandingMinor, expectedReturnDate }: DebtStatusInput,
  today: Date = startOfToday(),
): DebtStatus {
  if (outstandingMinor <= 0) return "paid";

  const days = daysUntil(expectedReturnDate, today);
  // A debt with no expected return date can never be late - it stays active.
  if (days === null) return "active";

  if (days < 0) return "overdue";
  if (days <= DUE_SOON_WINDOW_DAYS) return "due_soon";
  return "active";
}

export interface StatusMeta {
  value: DebtStatus;
  label: string;
  /** Tailwind classes for the status pill. Colour is never the only signal - the label always shows. */
  badgeClass: string;
  dotClass: string;
}

export const STATUS_META: Record<DebtStatus, StatusMeta> = {
  paid: {
    value: "paid",
    label: "Paid",
    badgeClass:
      "border-emerald-600/25 bg-emerald-500/12 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/12 dark:text-emerald-300",
    dotClass: "bg-emerald-600 dark:bg-emerald-400",
  },
  due_soon: {
    value: "due_soon",
    label: "Due Soon",
    badgeClass:
      "border-amber-600/25 bg-amber-500/12 text-amber-700 dark:border-amber-400/25 dark:bg-amber-400/12 dark:text-amber-300",
    dotClass: "bg-amber-600 dark:bg-amber-400",
  },
  overdue: {
    value: "overdue",
    label: "Overdue",
    badgeClass:
      "border-red-600/25 bg-red-500/12 text-red-700 dark:border-red-400/25 dark:bg-red-400/12 dark:text-red-300",
    dotClass: "bg-red-600 dark:bg-red-400",
  },
  active: {
    value: "active",
    label: "Active",
    badgeClass: "border-border bg-muted text-muted-foreground",
    dotClass: "bg-muted-foreground",
  },
};

export const STATUS_ORDER: DebtStatus[] = ["overdue", "due_soon", "active", "paid"];

export type StatusFilter = "all" | DebtStatus;

export const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "due_soon", label: "Due Soon" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
];
