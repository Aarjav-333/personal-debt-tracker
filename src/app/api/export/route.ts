import { NextResponse, type NextRequest } from "next/server";

import { summariseBorrowers, toDebtViews } from "@/lib/aggregate";
import { STATUS_META } from "@/lib/debt-status";
import { csvFilename, toCsv, type CsvValue } from "@/lib/csv";
import { fromMinor, toMinor } from "@/lib/money";
import { getUser } from "@/lib/supabase/server";
import { getAllRepayments, getLedger } from "@/server/queries";

/**
 * CSV export.
 *
 * Four shapes: one file per table, plus a combined chronological ledger that
 * carries the running outstanding balance - the one worth keeping as a backup,
 * because it reconstructs the whole history without needing this app.
 *
 * Amounts are written as plain decimal numbers (no symbols, no grouping) so a
 * spreadsheet reads them as numbers rather than text.
 */

type ExportKind = "borrowers" | "debts" | "repayments" | "ledger";

const KINDS: ExportKind[] = ["borrowers", "debts", "repayments", "ledger"];

function money(minor: number): string {
  return fromMinor(minor).toFixed(2);
}

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const requested = request.nextUrl.searchParams.get("type") ?? "ledger";
  const kind = (KINDS as string[]).includes(requested) ? (requested as ExportKind) : "ledger";

  const { borrowers, debts } = await getLedger();
  const debtViews = toDebtViews(debts);

  let headers: string[];
  let rows: CsvValue[][];

  switch (kind) {
    case "borrowers": {
      const summaries = summariseBorrowers(borrowers, debtViews);
      headers = [
        "Name",
        "Phone",
        "Total Borrowed",
        "Total Repaid",
        "Outstanding",
        "Borrowings",
        "Active Debts",
        "Overdue Debts",
        "Notes",
        "Added On",
      ];
      rows = summaries.map((borrower) => [
        borrower.name,
        borrower.phone,
        money(borrower.totalBorrowedMinor),
        money(borrower.totalRepaidMinor),
        money(borrower.outstandingMinor),
        borrower.debtCount,
        borrower.activeDebtCount,
        borrower.overdueDebtCount,
        borrower.notes,
        borrower.createdAt.slice(0, 10),
      ]);
      break;
    }

    case "debts": {
      headers = [
        "Borrower",
        "Original Amount",
        "Total Repaid",
        "Outstanding",
        "Status",
        "Reason",
        "Borrowed Date",
        "Expected Return Date",
        "Repayments",
        "Notes",
        "Debt ID",
      ];
      rows = debtViews.map((debt) => [
        debt.borrowerName,
        money(debt.originalMinor),
        money(debt.repaidMinor),
        money(debt.outstandingMinor),
        STATUS_META[debt.status].label,
        debt.reason,
        debt.borrowedDate,
        debt.expectedReturnDate,
        debt.repaymentCount,
        debt.notes,
        debt.id,
      ]);
      break;
    }

    case "repayments": {
      const repayments = await getAllRepayments();
      const debtById = new Map(debtViews.map((debt) => [debt.id, debt]));

      headers = [
        "Repayment Date",
        "Borrower",
        "Amount",
        "Method",
        "Notes",
        "Against Debt Of",
        "Debt Borrowed Date",
        "Debt ID",
        "Recorded At",
      ];
      rows = repayments.map((repayment) => {
        const debt = debtById.get(repayment.debt_id);
        return [
          repayment.repayment_date,
          debt?.borrowerName ?? "",
          money(toMinor(repayment.amount)),
          repayment.method,
          repayment.notes,
          debt ? money(debt.originalMinor) : "",
          debt?.borrowedDate ?? "",
          repayment.debt_id,
          repayment.created_at,
        ];
      });
      break;
    }

    default: {
      const repayments = await getAllRepayments();

      const byDebt = new Map<string, typeof repayments>();
      for (const repayment of repayments) {
        const bucket = byDebt.get(repayment.debt_id);
        if (bucket) bucket.push(repayment);
        else byDebt.set(repayment.debt_id, [repayment]);
      }

      interface LedgerRow {
        date: string;
        borrower: string;
        type: string;
        detail: string | null;
        amountMinor: number;
        outstandingMinor: number;
        debtId: string;
        sequence: number;
      }

      const ledger: LedgerRow[] = [];

      for (const debt of debtViews) {
        // Replay each debt forward so every line carries the balance as it
        // stood immediately after that event.
        let running = debt.originalMinor;

        ledger.push({
          date: debt.borrowedDate,
          borrower: debt.borrowerName,
          type: "Borrowed",
          detail: debt.reason,
          amountMinor: debt.originalMinor,
          outstandingMinor: running,
          debtId: debt.id,
          sequence: 0,
        });

        const theirs = [...(byDebt.get(debt.id) ?? [])].sort(
          (a, b) =>
            a.repayment_date.localeCompare(b.repayment_date) ||
            a.created_at.localeCompare(b.created_at),
        );

        theirs.forEach((repayment, index) => {
          running -= toMinor(repayment.amount);
          ledger.push({
            date: repayment.repayment_date,
            borrower: debt.borrowerName,
            type: "Repaid",
            detail: repayment.method ?? repayment.notes,
            amountMinor: toMinor(repayment.amount),
            outstandingMinor: running,
            debtId: debt.id,
            sequence: index + 1,
          });
        });
      }

      ledger.sort(
        (a, b) => a.date.localeCompare(b.date) || a.debtId.localeCompare(b.debtId) || a.sequence - b.sequence,
      );

      headers = ["Date", "Borrower", "Type", "Detail", "Amount", "Debt Outstanding After", "Debt ID"];
      rows = ledger.map((entry) => [
        entry.date,
        entry.borrower,
        entry.type,
        entry.detail,
        money(entry.amountMinor),
        money(entry.outstandingMinor),
        entry.debtId,
      ]);
      break;
    }
  }

  const csv = toCsv(headers, rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename(kind)}"`,
      "Cache-Control": "no-store",
    },
  });
}
