import { describe, it, expect } from "vitest";
import { accruedThroughDay } from "./finance-utils";

describe("accruedThroughDay", () => {
  const today = new Date(2026, 9, 25); // 25 Oct 2026

  it("past month counts the whole month", () => {
    expect(accruedThroughDay(2026, 9, today)).toBe(30);
  });

  it("current month counts through today", () => {
    expect(accruedThroughDay(2026, 10, today)).toBe(25);
  });

  it("future month counts nothing", () => {
    expect(accruedThroughDay(2026, 11, today)).toBe(0);
  });

  it("previous year december", () => {
    expect(accruedThroughDay(2025, 12, today)).toBe(31);
  });

  it("february of a leap year", () => {
    expect(accruedThroughDay(2028, 2, new Date(2028, 5, 1))).toBe(29);
  });
});
