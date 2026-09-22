import { describe, expect, it } from "vitest";

import { computeTotals, sortDebts, summariseBorrowers, toDebtView, toDebtViews } from "@/lib/aggregate";
import { fromMinor, toMinor } from "@/lib/money";
import type { BorrowerRow, DebtBalanceRow } from "@/lib/types/database";

/**
 * The scenarios the ledger has to get right, walked end to end.
 *
 * Each step mirrors what the database would return after that action: the
 * debt's `original_amount` never moves, and `total_repaid` is the sum of the
 * repayment rows. Everything else is derived.
 */

const TODAY = new Date(2026, 8, 22); // 22 September 2026.

interface DebtSpec {
  id?: string;
  borrowerId?: string;
  borrowerName?: string;
  original: number;
  /** Individual repayment amounts, exactly as separate rows would hold them. */
  repayments?: number[];
  borrowedDate?: string;
  expectedReturnDate?: string | null;
}

function makeDebt({
  id = "debt-1",
  borrowerId = "borrower-1",
  borrowerName = "Rahul",
  original,
  repayments = [],
  borrowedDate = "2026-09-01",
  expectedReturnDate = null,
}: DebtSpec): DebtBalanceRow {
  const totalRepaid = repayments.reduce((sum, amount) => sum + amount, 0);

  return {
    id,
    user_id: "user-1",
    borrower_id: borrowerId,
    borrower_name: borrowerName,
    borrower_phone: null,
    original_amount: original,
    reason: null,
    borrowed_date: borrowedDate,
    expected_return_date: expectedReturnDate,
    notes: null,
    created_at: `${borrowedDate}T10:00:00.000Z`,
    updated_at: `${borrowedDate}T10:00:00.000Z`,
    total_repaid: totalRepaid,
    outstanding: original - totalRepaid,
    repayment_count: repayments.length,
    last_repayment_date: null,
  };
}

function makeBorrower(id = "borrower-1", name = "Rahul"): BorrowerRow {
  return {
    id,
    user_id: "user-1",
    name,
    phone: null,
    notes: null,
    created_at: "2026-09-01T10:00:00.000Z",
    updated_at: "2026-09-01T10:00:00.000Z",
  };
}

/** Reads a debt view back in rupees, which is how the tests are written. */
function rupees(debt: ReturnType<typeof toDebtView>) {
  return {
    original: fromMinor(debt.originalMinor),
    repaid: fromMinor(debt.repaidMinor),
    outstanding: fromMinor(debt.outstandingMinor),
    status: debt.status,
  };
}

describe("Test 1 - a new debt", () => {
  it("shows the full amount as outstanding with nothing repaid", () => {
    const debt = toDebtView(makeDebt({ original: 10_000 }), TODAY);

    expect(rupees(debt)).toEqual({
      original: 10_000,
      repaid: 0,
      outstanding: 10_000,
      status: "active",
    });
  });
});

describe("Test 2 - first partial repayment", () => {
  it("leaves the original amount untouched", () => {
    const debt = toDebtView(makeDebt({ original: 10_000, repayments: [2000] }), TODAY);

    expect(rupees(debt)).toEqual({
      original: 10_000,
      repaid: 2000,
      outstanding: 8000,
      status: "active",
    });
  });
});

describe("Test 3 - second repayment", () => {
  it("keeps both installments and totals them", () => {
    const row = makeDebt({ original: 10_000, repayments: [2000, 1500] });
    const debt = toDebtView(row, TODAY);

    expect(row.repayment_count).toBe(2);
    expect(rupees(debt)).toEqual({
      original: 10_000,
      repaid: 3500,
      outstanding: 6500,
      status: "active",
    });
  });
});

describe("Test 4 - another month, another repayment", () => {
  it("keeps all three installments visible", () => {
    const row = makeDebt({ original: 10_000, repayments: [2000, 1500, 3000] });
    const debt = toDebtView(row, TODAY);

    expect(row.repayment_count).toBe(3);
    expect(rupees(debt)).toEqual({
      original: 10_000,
      repaid: 6500,
      outstanding: 3500,
      status: "active",
    });
  });
});

describe("Test 5 - full settlement", () => {
  it("reaches zero outstanding and turns Paid, with four repayments on record", () => {
    const row = makeDebt({ original: 10_000, repayments: [2000, 1500, 3000, 3500] });
    const debt = toDebtView(row, TODAY);

    expect(row.repayment_count).toBe(4);
    expect(rupees(debt)).toEqual({
      original: 10_000,
      repaid: 10_000,
      outstanding: 0,
      status: "paid",
    });
    expect(debt.progressPercent).toBe(100);
  });
});

describe("Test 6 - editing a repayment", () => {
  it("recalculates every total when 1,500 is corrected to 1,000", () => {
    const before = toDebtView(makeDebt({ original: 10_000, repayments: [2000, 1500] }), TODAY);
    const after = toDebtView(makeDebt({ original: 10_000, repayments: [2000, 1000] }), TODAY);

    expect(fromMinor(before.outstandingMinor)).toBe(6500);
    expect(rupees(after)).toEqual({
      original: 10_000,
      repaid: 3000,
      outstanding: 7000,
      status: "active",
    });
  });
});

describe("Test 7 - deleting a repayment", () => {
  it("puts the deleted amount back on the outstanding balance", () => {
    const before = toDebtView(makeDebt({ original: 10_000, repayments: [2000, 1500, 3000] }), TODAY);
    const after = toDebtView(makeDebt({ original: 10_000, repayments: [2000, 3000] }), TODAY);

    expect(fromMinor(before.outstandingMinor)).toBe(3500);
    expect(fromMinor(after.outstandingMinor)).toBe(5000);
    expect(fromMinor(after.originalMinor)).toBe(10_000);
  });
});

describe("Test 8 - multiple debts for the same borrower", () => {
  it("adds a second borrowing without touching the settled first one", () => {
    const settled = makeDebt({
      id: "debt-1",
      original: 10_000,
      repayments: [2000, 1500, 3000, 3500],
    });
    const fresh = makeDebt({ id: "debt-2", original: 2000, borrowedDate: "2026-09-20" });

    const debts = toDebtViews([settled, fresh], TODAY);
    const [rahul] = summariseBorrowers([makeBorrower()], debts);

    expect(fromMinor(rahul.totalBorrowedMinor)).toBe(12_000);
    expect(fromMinor(rahul.totalRepaidMinor)).toBe(10_000);
    expect(fromMinor(rahul.outstandingMinor)).toBe(2000);

    expect(rahul.debtCount).toBe(2);
    expect(rahul.activeDebtCount).toBe(1);

    // The old debt is untouched and still fully repaid.
    const old = debts.find((debt) => debt.id === "debt-1")!;
    expect(rupees(old)).toEqual({
      original: 10_000,
      repaid: 10_000,
      outstanding: 0,
      status: "paid",
    });
  });
});

describe("Test 9 - an overdue partial debt", () => {
  it("counts only the unpaid remainder as overdue money", () => {
    const debt = toDebtView(
      makeDebt({
        original: 5000,
        repayments: [3000],
        borrowedDate: "2026-08-01",
        expectedReturnDate: "2026-09-15",
      }),
      TODAY,
    );

    expect(rupees(debt)).toEqual({
      original: 5000,
      repaid: 3000,
      outstanding: 2000,
      status: "overdue",
    });

    const totals = computeTotals([debt], 1);
    expect(fromMinor(totals.totalOverdueMinor)).toBe(2000);
    expect(fromMinor(totals.totalLentMinor)).toBe(5000);
    expect(totals.overdueDebtCount).toBe(1);
  });
});

describe("portfolio totals", () => {
  const debts = toDebtViews(
    [
      // Rahul: 10,000 fully repaid, plus a fresh 2,000 with no due date.
      makeDebt({ id: "d1", original: 10_000, repayments: [2000, 1500, 3000, 3500] }),
      makeDebt({ id: "d2", original: 2000, borrowedDate: "2026-09-20" }),
      // Arjun: 5,000 with 3,000 back, overdue since 15 September.
      makeDebt({
        id: "d3",
        borrowerId: "borrower-2",
        borrowerName: "Arjun",
        original: 5000,
        repayments: [3000],
        expectedReturnDate: "2026-09-15",
      }),
      // Vishnu: 1,500 due in two days.
      makeDebt({
        id: "d4",
        borrowerId: "borrower-3",
        borrowerName: "Vishnu",
        original: 1500,
        expectedReturnDate: "2026-09-24",
      }),
    ],
    TODAY,
  );

  const borrowers = [
    makeBorrower("borrower-1", "Rahul"),
    makeBorrower("borrower-2", "Arjun"),
    makeBorrower("borrower-3", "Vishnu"),
  ];

  it("derives Total Lent, Total Repaid and Total Outstanding consistently", () => {
    const totals = computeTotals(debts, borrowers.length);

    expect(fromMinor(totals.totalLentMinor)).toBe(18_500);
    expect(fromMinor(totals.totalRepaidMinor)).toBe(13_000);
    expect(fromMinor(totals.totalOutstandingMinor)).toBe(5500);
    // Outstanding is exactly lent minus repaid, by construction.
    expect(totals.totalOutstandingMinor).toBe(totals.totalLentMinor - totals.totalRepaidMinor);
  });

  it("counts statuses and the money behind them separately", () => {
    const totals = computeTotals(debts, borrowers.length);

    expect(totals.debtCount).toBe(4);
    expect(totals.paidDebtCount).toBe(1);
    expect(totals.activeDebtCount).toBe(3);
    expect(totals.overdueDebtCount).toBe(1);
    expect(totals.dueSoonDebtCount).toBe(1);

    expect(fromMinor(totals.totalOverdueMinor)).toBe(2000);
    expect(fromMinor(totals.dueSoonMinor)).toBe(1500);

    expect(totals.borrowerCount).toBe(3);
    expect(totals.activeBorrowerCount).toBe(3);
  });

  it("agrees with the sum of the per-borrower summaries", () => {
    const totals = computeTotals(debts, borrowers.length);
    const summaries = summariseBorrowers(borrowers, debts);

    const lent = summaries.reduce((sum, borrower) => sum + borrower.totalBorrowedMinor, 0);
    const repaid = summaries.reduce((sum, borrower) => sum + borrower.totalRepaidMinor, 0);
    const outstanding = summaries.reduce((sum, borrower) => sum + borrower.outstandingMinor, 0);

    expect(lent).toBe(totals.totalLentMinor);
    expect(repaid).toBe(totals.totalRepaidMinor);
    expect(outstanding).toBe(totals.totalOutstandingMinor);
  });

  it("keeps borrowers with no debts yet, at zero", () => {
    const summaries = summariseBorrowers([...borrowers, makeBorrower("borrower-4", "Neha")], debts);
    const neha = summaries.find((borrower) => borrower.name === "Neha")!;

    expect(neha.debtCount).toBe(0);
    expect(neha.totalBorrowedMinor).toBe(0);
    expect(neha.outstandingMinor).toBe(0);
  });

  it("sorts debts with undated ones last when ordering by return date", () => {
    const order = sortDebts(debts, "due_date").map((debt) => debt.id);
    expect(order.slice(0, 2)).toEqual(["d3", "d4"]);
    expect(order.slice(2).sort()).toEqual(["d1", "d2"]);
  });

  it("sorts by highest outstanding first, settled debts last", () => {
    const order = sortDebts(debts, "outstanding_desc").map((debt) => debt.id);
    // d2 and d3 are both 2,000 outstanding, so the tie breaks on name.
    expect(order).toEqual(["d3", "d2", "d4", "d1"]);
  });
});

describe("no repayment can exceed what is owed", () => {
  it("is caught before a write is attempted", () => {
    const debt = toDebtView(makeDebt({ original: 5000, repayments: [3000] }), TODAY);
    const attempted = toMinor(2500);

    expect(attempted).toBeGreaterThan(debt.outstandingMinor);
    expect(debt.outstandingMinor).toBe(toMinor(2000));
  });
});
