import { describe, expect, it } from "vitest";

import { CURRENCY_OPTIONS } from "@/lib/currency";
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

describe("decimal separators in free-text input", () => {
  it("reads a comma as the decimal point when that is what it must be", () => {
    // How a EUR user writes 1250.50. Stripping the comma would make it 125,050.
    expect(parseAmountInput("1250,50")).toEqual({ ok: true, minor: 125_050 });
    expect(parseAmountInput("0,75")).toEqual({ ok: true, minor: 75 });
  });

  it("still reads a comma as grouping when it is grouping", () => {
    expect(parseAmountInput("1,250")).toEqual({ ok: true, minor: 125_000 });
    expect(parseAmountInput("1,25,000")).toEqual({ ok: true, minor: 12_500_000 });
    expect(parseAmountInput("10,000")).toEqual({ ok: true, minor: 1_000_000 });
  });

  it("takes the rightmost separator as the decimal point when both appear", () => {
    expect(parseAmountInput("1,250.50")).toEqual({ ok: true, minor: 125_050 });
    expect(parseAmountInput("1.250,50")).toEqual({ ok: true, minor: 125_050 });
  });

  it("round-trips its own formatted output in every currency offered", () => {
    // Iterates the real currency table rather than a hand-written list: AED has
    // no single-glyph symbol, so Intl renders the letters "AED" and a symbol
    // blacklist silently missed it.
    for (const { code } of CURRENCY_OPTIONS) {
      const formatted = formatMinor(125_050, { currency: code, alwaysShowDecimals: true });
      const reparsed = parseAmountInput(formatted);
      expect(reparsed, `${code} -> ${formatted}`).toEqual({ ok: true, minor: 125_050 });

    }
  });
});

describe("ambiguous input is refused, never guessed", () => {
  it("refuses a bare grouped thousand rather than pick a reading", () => {
    /*
     * "5.000" is 5000 to a German reader and an over-precise 5.00 to everyone
     * else - a 1000x gap. The app never has to reparse its own grouped output
     * (prefills use a canonical "5000"), so refusing is free and guessing is not.
     */
    expect(parseAmountInput("5.000")).toMatchObject({ ok: false });
    expect(parseAmountInput("5,000")).toEqual({ ok: true, minor: 500_000 });
  });

  it("does not reinterpret an over-precise decimal as grouping", () => {
    // "10.005" would be 10,005 to a German reader. Guessing either way could
    // be a 1000x error, so it is rejected and the user retypes it.
    expect(parseAmountInput("10.005")).toMatchObject({ ok: false });
    expect(parseAmountInput("1.250")).toMatchObject({ ok: false });
  });

  it("keeps a dot as the decimal point", () => {
    expect(parseAmountInput("10.5")).toEqual({ ok: true, minor: 1050 });
    expect(parseAmountInput("10.50")).toEqual({ ok: true, minor: 1050 });
  });
});
