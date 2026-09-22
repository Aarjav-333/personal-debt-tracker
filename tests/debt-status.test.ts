import { describe, expect, it } from "vitest";

import { daysUntil, formatRelativeDueDate, parseDateOnly, toDateOnly } from "@/lib/dates";
import { deriveDebtStatus } from "@/lib/debt-status";
import { toMinor } from "@/lib/money";

/** Fixed reference day so these tests do not drift with the calendar. */
const TODAY = new Date(2026, 8, 22); // 22 September 2026, local midnight.

function status(outstanding: number, expectedReturnDate: string | null) {
  return deriveDebtStatus({ outstandingMinor: toMinor(outstanding), expectedReturnDate }, TODAY);
}

describe("date-only handling", () => {
  it("parses a DATE string at local midnight, not UTC", () => {
    const parsed = parseDateOnly("2026-09-22");
    expect(parsed).not.toBeNull();
    // Parsed as UTC this would slip to the 21st anywhere east of Greenwich.
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(8);
    expect(parsed?.getDate()).toBe(22);
  });

  it("round-trips through serialisation", () => {
    expect(toDateOnly(parseDateOnly("2026-01-05")!)).toBe("2026-01-05");
  });

  it("counts whole calendar days in both directions", () => {
    expect(daysUntil("2026-09-22", TODAY)).toBe(0);
    expect(daysUntil("2026-09-23", TODAY)).toBe(1);
    expect(daysUntil("2026-09-19", TODAY)).toBe(-3);
    expect(daysUntil(null, TODAY)).toBeNull();
  });

  it("phrases due dates the way a person would", () => {
    expect(formatRelativeDueDate("2026-09-22", TODAY)).toBe("Today");
    expect(formatRelativeDueDate("2026-09-23", TODAY)).toBe("Tomorrow");
    expect(formatRelativeDueDate("2026-09-25", TODAY)).toBe("In 3 days");
    expect(formatRelativeDueDate("2026-09-21", TODAY)).toBe("Yesterday");
    expect(formatRelativeDueDate("2026-09-17", TODAY)).toBe("5 days ago");
  });
});

describe("derived debt status", () => {
  it("is Paid once nothing is outstanding, whatever the due date said", () => {
    expect(status(0, "2026-01-01")).toBe("paid");
    expect(status(0, "2027-01-01")).toBe("paid");
    expect(status(0, null)).toBe("paid");
  });

  it("is Overdue only when the date has passed and money is still owed", () => {
    expect(status(2000, "2026-09-21")).toBe("overdue");
    expect(status(2000, "2026-01-01")).toBe("overdue");
    // Paid on time, then the date passes: still Paid, never Overdue.
    expect(status(0, "2026-09-21")).toBe("paid");
  });

  it("is Due Soon within the three-day window, including today", () => {
    expect(status(2000, "2026-09-22")).toBe("due_soon");
    expect(status(2000, "2026-09-23")).toBe("due_soon");
    expect(status(2000, "2026-09-25")).toBe("due_soon");
  });

  it("is Active beyond the window", () => {
    expect(status(2000, "2026-09-26")).toBe("active");
    expect(status(2000, "2026-12-31")).toBe("active");
  });

  it("stays Active forever when no return date was agreed", () => {
    expect(status(8000, null)).toBe("active");
  });

  it("treats a fractional remainder as still outstanding", () => {
    expect(status(0.01, "2026-01-01")).toBe("overdue");
  });
});
