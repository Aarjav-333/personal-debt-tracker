import { deriveDebtStatus, type DebtStatus } from "@/lib/debt-status";
import { daysUntil, startOfToday } from "@/lib/dates";
import { repaidPercent, toMinor, type Minor } from "@/lib/money";
import type { BorrowerRow, DebtBalanceRow } from "@/lib/types/database";

/**
 * The single place where raw database rows become the numbers shown on screen.
 *
 * Every screen - dashboard, borrowers list, borrower detail, debt detail,
 * exports - derives its totals from these functions, so the figure on the
 * dashboard can never disagree with the figure on a borrower's page.
 */

export interface DebtView {
  id: string;
  borrowerId: string;
  borrowerName: string;
  borrowerPhone: string | null;
  /** The amount originally handed over. Never changes when money comes back. */
  originalMinor: Minor;
  repaidMinor: Minor;
  outstandingMinor: Minor;
  reason: string | null;
  borrowedDate: string;
  expectedReturnDate: string | null;
  notes: string | null;
  repaymentCount: number;
  lastRepaymentDate: string | null;
  createdAt: string;
  updatedAt: string;
  status: DebtStatus;
  /** 0-100, how much of the debt has been returned. */
  progressPercent: number;
  /** Calendar days until the expected return date. Negative when overdue. */
  daysUntilDue: number | null;
}

export interface BorrowerSummary {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  createdAt: string;
  totalBorrowedMinor: Minor;
  totalRepaidMinor: Minor;
  outstandingMinor: Minor;
  debtCount: number;
  activeDebtCount: number;
  overdueDebtCount: number;
  dueSoonDebtCount: number;
  /** Soonest expected return date among debts that still owe money. */
  nextDueDate: string | null;
  /** Newest borrowed_date, used for "recently added" sorting. */
  latestBorrowedDate: string | null;
}

export interface PortfolioTotals {
  totalLentMinor: Minor;
  totalRepaidMinor: Minor;
  totalOutstandingMinor: Minor;
  /** Outstanding balance of overdue debts only - not their original amounts. */
  totalOverdueMinor: Minor;
  /** Outstanding balance of debts due within the next few days. */
  dueSoonMinor: Minor;
  borrowerCount: number;
  activeBorrowerCount: number;
  debtCount: number;
  activeDebtCount: number;
  overdueDebtCount: number;
  dueSoonDebtCount: number;
  paidDebtCount: number;
}

export function toDebtView(row: DebtBalanceRow, today: Date = startOfToday()): DebtView {
  const originalMinor = toMinor(row.original_amount);
  const repaidMinor = toMinor(row.total_repaid);
  // Recomputed rather than trusting the view's own subtraction, so the app and
  // the database can never disagree by a rounding step.
  const outstandingMinor = originalMinor - repaidMinor;

  return {
    id: row.id,
    borrowerId: row.borrower_id,
    borrowerName: row.borrower_name,
    borrowerPhone: row.borrower_phone,
    originalMinor,
    repaidMinor,
    outstandingMinor,
    reason: row.reason,
    borrowedDate: row.borrowed_date,
    expectedReturnDate: row.expected_return_date,
    notes: row.notes,
    repaymentCount: row.repayment_count,
    lastRepaymentDate: row.last_repayment_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: deriveDebtStatus({ outstandingMinor, expectedReturnDate: row.expected_return_date }, today),
    progressPercent: repaidPercent(repaidMinor, originalMinor),
    daysUntilDue: daysUntil(row.expected_return_date, today),
  };
}

export function toDebtViews(rows: DebtBalanceRow[], today: Date = startOfToday()): DebtView[] {
  return rows.map((row) => toDebtView(row, today));
}

/**
 * Roll debts up per borrower. Borrowers with no debts yet are still returned,
 * with zeroed totals, so they remain visible and editable.
 */
export function summariseBorrowers(borrowers: BorrowerRow[], debts: DebtView[]): BorrowerSummary[] {
  const byBorrower = new Map<string, DebtView[]>();
  for (const debt of debts) {
    const bucket = byBorrower.get(debt.borrowerId);
    if (bucket) bucket.push(debt);
    else byBorrower.set(debt.borrowerId, [debt]);
  }

  return borrowers.map((borrower) => {
    const theirDebts = byBorrower.get(borrower.id) ?? [];

    let totalBorrowedMinor = 0;
    let totalRepaidMinor = 0;
    let activeDebtCount = 0;
    let overdueDebtCount = 0;
    let dueSoonDebtCount = 0;
    let nextDueDate: string | null = null;
    let latestBorrowedDate: string | null = null;

    for (const debt of theirDebts) {
      totalBorrowedMinor += debt.originalMinor;
      totalRepaidMinor += debt.repaidMinor;

      if (debt.status !== "paid") {
        activeDebtCount += 1;
        if (debt.status === "overdue") overdueDebtCount += 1;
        if (debt.status === "due_soon") dueSoonDebtCount += 1;
        if (debt.expectedReturnDate && (!nextDueDate || debt.expectedReturnDate < nextDueDate)) {
          nextDueDate = debt.expectedReturnDate;
        }
      }

      if (!latestBorrowedDate || debt.borrowedDate > latestBorrowedDate) {
        latestBorrowedDate = debt.borrowedDate;
      }
    }

    return {
      id: borrower.id,
      name: borrower.name,
      phone: borrower.phone,
      notes: borrower.notes,
      createdAt: borrower.created_at,
      totalBorrowedMinor,
      totalRepaidMinor,
      outstandingMinor: totalBorrowedMinor - totalRepaidMinor,
      debtCount: theirDebts.length,
      activeDebtCount,
      overdueDebtCount,
      dueSoonDebtCount,
      nextDueDate,
      latestBorrowedDate,
    };
  });
}

export function computeTotals(debts: DebtView[], borrowerCount: number): PortfolioTotals {
  const totals: PortfolioTotals = {
    totalLentMinor: 0,
    totalRepaidMinor: 0,
    totalOutstandingMinor: 0,
    totalOverdueMinor: 0,
    dueSoonMinor: 0,
    borrowerCount,
    activeBorrowerCount: 0,
    debtCount: debts.length,
    activeDebtCount: 0,
    overdueDebtCount: 0,
    dueSoonDebtCount: 0,
    paidDebtCount: 0,
  };

  const borrowersWithBalance = new Set<string>();

  for (const debt of debts) {
    totals.totalLentMinor += debt.originalMinor;
    totals.totalRepaidMinor += debt.repaidMinor;

    switch (debt.status) {
      case "paid":
        totals.paidDebtCount += 1;
        break;
      case "overdue":
        // Only the unpaid remainder is overdue money, never the original amount.
        totals.totalOverdueMinor += debt.outstandingMinor;
        totals.overdueDebtCount += 1;
        totals.activeDebtCount += 1;
        borrowersWithBalance.add(debt.borrowerId);
        break;
      case "due_soon":
        totals.dueSoonMinor += debt.outstandingMinor;
        totals.dueSoonDebtCount += 1;
        totals.activeDebtCount += 1;
        borrowersWithBalance.add(debt.borrowerId);
        break;
      default:
        totals.activeDebtCount += 1;
        borrowersWithBalance.add(debt.borrowerId);
    }
  }

  totals.totalOutstandingMinor = totals.totalLentMinor - totals.totalRepaidMinor;
  totals.activeBorrowerCount = borrowersWithBalance.size;

  return totals;
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

export type SortKey =
  | "outstanding_desc"
  | "outstanding_asc"
  | "recent"
  | "oldest"
  | "name"
  | "due_date";

export const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "outstanding_desc", label: "Highest outstanding" },
  { value: "outstanding_asc", label: "Lowest outstanding" },
  { value: "recent", label: "Recently added" },
  { value: "oldest", label: "Oldest" },
  { value: "name", label: "Name (A-Z)" },
  { value: "due_date", label: "Expected return date" },
];

const compareText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

/** Ascending by date. Rows with no date sort last, never first. */
const compareDateAsc = (a: string | null, b: string | null) => {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? -1 : 1;
};

/** Descending by date. Rows with no date still sort last. */
const compareDateDesc = (a: string | null, b: string | null) => {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? 1 : -1;
};

export function sortDebts(debts: DebtView[], key: SortKey): DebtView[] {
  const sorted = [...debts];
  switch (key) {
    case "outstanding_desc":
      return sorted.sort(
        (a, b) => b.outstandingMinor - a.outstandingMinor || compareText(a.borrowerName, b.borrowerName),
      );
    case "outstanding_asc":
      return sorted.sort(
        (a, b) => a.outstandingMinor - b.outstandingMinor || compareText(a.borrowerName, b.borrowerName),
      );
    case "recent":
      return sorted.sort((a, b) => b.borrowedDate.localeCompare(a.borrowedDate) || b.createdAt.localeCompare(a.createdAt));
    case "oldest":
      return sorted.sort((a, b) => a.borrowedDate.localeCompare(b.borrowedDate) || a.createdAt.localeCompare(b.createdAt));
    case "name":
      return sorted.sort((a, b) => compareText(a.borrowerName, b.borrowerName) || b.outstandingMinor - a.outstandingMinor);
    case "due_date":
      return sorted.sort(
        (a, b) => compareDateAsc(a.expectedReturnDate, b.expectedReturnDate) || b.outstandingMinor - a.outstandingMinor,
      );
    default:
      return sorted;
  }
}

export function sortBorrowers(borrowers: BorrowerSummary[], key: SortKey): BorrowerSummary[] {
  const sorted = [...borrowers];
  switch (key) {
    case "outstanding_desc":
      return sorted.sort((a, b) => b.outstandingMinor - a.outstandingMinor || compareText(a.name, b.name));
    case "outstanding_asc":
      return sorted.sort((a, b) => a.outstandingMinor - b.outstandingMinor || compareText(a.name, b.name));
    case "recent":
      return sorted.sort(
        (a, b) => compareDateDesc(a.latestBorrowedDate, b.latestBorrowedDate) || b.createdAt.localeCompare(a.createdAt),
      );
    case "oldest":
      return sorted.sort(
        (a, b) => compareDateAsc(a.latestBorrowedDate, b.latestBorrowedDate) || a.createdAt.localeCompare(b.createdAt),
      );
    case "name":
      return sorted.sort((a, b) => compareText(a.name, b.name));
    case "due_date":
      return sorted.sort((a, b) => compareDateAsc(a.nextDueDate, b.nextDueDate) || b.outstandingMinor - a.outstandingMinor);
    default:
      return sorted;
  }
}
