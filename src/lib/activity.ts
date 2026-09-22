import type { DebtView } from "@/lib/aggregate";
import { toMinor, type Minor } from "@/lib/money";
import type { ActivityRow } from "@/lib/types/database";

/**
 * The ledger's event stream.
 *
 * Borrowings and repayments are real rows. "Became overdue" is not - nothing
 * happens in the database when a date passes - so it is derived here from the
 * debts that are overdue right now and folded into the same timeline.
 */

export type TimelineKind = "borrow" | "repayment" | "overdue";

export interface TimelineEntry {
  key: string;
  kind: TimelineKind;
  borrowerId: string;
  borrowerName: string;
  debtId: string;
  amountMinor: Minor;
  /** Calendar day the event belongs to (yyyy-MM-dd). */
  date: string;
  detail: string | null;
}

export function buildTimeline(rows: ActivityRow[], debts: DebtView[]): TimelineEntry[] {
  const entries: TimelineEntry[] = rows.map((row) => ({
    key: `${row.kind}-${row.id}`,
    kind: row.kind,
    borrowerId: row.borrower_id,
    borrowerName: row.borrower_name,
    debtId: row.debt_id,
    amountMinor: toMinor(row.amount),
    date: row.event_date,
    detail: row.detail,
  }));

  for (const debt of debts) {
    if (debt.status !== "overdue" || !debt.expectedReturnDate) continue;
    entries.push({
      key: `overdue-${debt.id}`,
      kind: "overdue",
      borrowerId: debt.borrowerId,
      borrowerName: debt.borrowerName,
      debtId: debt.id,
      amountMinor: debt.outstandingMinor,
      date: debt.expectedReturnDate,
      detail: null,
    });
  }

  return entries.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    // Within a day: money in, then money out, then the passive overdue marker.
    const rank: Record<TimelineKind, number> = { repayment: 0, borrow: 1, overdue: 2 };
    return rank[a.kind] - rank[b.kind];
  });
}

/** Groups timeline entries by calendar day, preserving order. */
export function groupByDate(entries: TimelineEntry[]): Array<{ date: string; entries: TimelineEntry[] }> {
  const groups: Array<{ date: string; entries: TimelineEntry[] }> = [];

  for (const entry of entries) {
    const last = groups.at(-1);
    if (last && last.date === entry.date) last.entries.push(entry);
    else groups.push({ date: entry.date, entries: [entry] });
  }

  return groups;
}
