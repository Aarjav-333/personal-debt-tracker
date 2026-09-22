import { describe, expect, it } from "vitest";

import {
  addMinor,
  formatMinor,
  fromMinor,
  minorToNumericString,
  parseAmountInput,
  repaidPercent,
  sumMinor,
  toMinor,
} from "@/lib/money";

describe("minor-unit conversion", () => {
  it("converts whole and fractional rupees to paise", () => {
    expect(toMinor(5000)).toBe(500_000);
    expect(toMinor(1500.5)).toBe(150_050);
    expect(toMinor("2000.00")).toBe(200_000);
    expect(toMinor(0.01)).toBe(1);
  });

  it("treats missing values as zero rather than NaN", () => {
    expect(toMinor(null)).toBe(0);
    expect(toMinor(undefined)).toBe(0);
    expect(toMinor("")).toBe(0);
  });

  it("rounds half-paise values instead of truncating them", () => {
    // 1.005 * 100 is 100.49999999999999 in binary floating point.
    expect(toMinor(1.005)).toBe(101);
  });

  it("round-trips back to major units", () => {
    expect(fromMinor(500_000)).toBe(5000);
    expect(fromMinor(150_050)).toBe(1500.5);
  });

  it("serialises to a fixed 2dp string for Postgres NUMERIC", () => {
    expect(minorToNumericString(500_000)).toBe("5000.00");
    expect(minorToNumericString(150_050)).toBe("1500.50");
    expect(minorToNumericString(1)).toBe("0.01");
  });
});

describe("summation", () => {
  it("adds repeated fractional repayments without drift", () => {
    // 0.1 + 0.2 !== 0.3 in floats. In paise it is exact, every time.
    const hundredTimes = Array.from({ length: 100 }, () => 0.1);
    expect(sumMinor(hundredTimes)).toBe(1000);
    expect(fromMinor(sumMinor(hundredTimes))).toBe(10);
  });

  it("matches a hand-computed total across many installments", () => {
    const repayments = [2000, 1500, 4000, 2500];
    expect(sumMinor(repayments)).toBe(toMinor(10_000));
  });

  it("adds already-minor values", () => {
    expect(addMinor(200_000, 150_000, 400_000)).toBe(750_000);
  });
});

describe("Indian currency formatting", () => {
  it("groups in the Indian system", () => {
    expect(formatMinor(toMinor(1000))).toBe("₹1,000");
    expect(formatMinor(toMinor(15_500))).toBe("₹15,500");
    expect(formatMinor(toMinor(125_000))).toBe("₹1,25,000");
    expect(formatMinor(toMinor(10_000_000))).toBe("₹1,00,00,000");
  });

  it("shows paise only when there are any", () => {
    expect(formatMinor(toMinor(1500))).toBe("₹1,500");
    expect(formatMinor(toMinor(1500.5))).toBe("₹1,500.50");
    expect(formatMinor(toMinor(1500), { alwaysShowDecimals: true })).toBe("₹1,500.00");
  });

  it("formats other currencies with their own grouping", () => {
    expect(formatMinor(toMinor(125_000), { currency: "USD" })).toBe("$125,000");
  });

  it("can omit the symbol", () => {
    expect(formatMinor(toMinor(125_000), { hideSymbol: true })).toBe("1,25,000");
  });
});

describe("amount input parsing", () => {
  it("accepts plain, grouped and symbol-prefixed input", () => {
    expect(parseAmountInput("5000")).toEqual({ ok: true, minor: 500_000 });
    expect(parseAmountInput("1,250")).toEqual({ ok: true, minor: 125_000 });
    expect(parseAmountInput("₹1,250.50")).toEqual({ ok: true, minor: 125_050 });
    expect(parseAmountInput(" 750 ")).toEqual({ ok: true, minor: 75_000 });
  });

  it("rejects amounts that are not money", () => {
    expect(parseAmountInput("")).toMatchObject({ ok: false });
    expect(parseAmountInput("abc")).toMatchObject({ ok: false });
    expect(parseAmountInput("0")).toMatchObject({ ok: false });
    expect(parseAmountInput("-100")).toMatchObject({ ok: false });
    expect(parseAmountInput("10.005")).toMatchObject({ ok: false });
    expect(parseAmountInput("99999999999")).toMatchObject({ ok: false });
  });
});

describe("repayment progress", () => {
  it("reports the share repaid", () => {
    expect(repaidPercent(toMinor(3500), toMinor(5000))).toBe(70);
    expect(repaidPercent(0, toMinor(5000))).toBe(0);
    expect(repaidPercent(toMinor(5000), toMinor(5000))).toBe(100);
  });

  it("never reports more than 100% or divides by zero", () => {
    expect(repaidPercent(toMinor(6000), toMinor(5000))).toBe(100);
    expect(repaidPercent(toMinor(100), 0)).toBe(0);
  });
});
