import { describe, it, expect } from "vitest";
import { accruedThroughDay, forecastMonthEnd } from "./finance-utils";

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

describe("forecastMonthEnd", () => {
  const base = { variableExpenses: 1000, fixedMonthly: 2000, debtMonthly: 0, expectedIncome: 6000, savingsGoalPct: 35, daysElapsed: 10, daysInMonth: 30 };

  it("projects variable spending at the current daily pace and adds fixed costs", () => {
    expect(forecastMonthEnd(base).predicted).toBe(5000); // 1000/10×30 + 2000
  });

  it("green when the projection leaves the savings goal", () => {
    expect(forecastMonthEnd({ ...base, variableExpenses: 300 }).status).toBe("green"); // 2900 ≤ 3900
  });

  it("yellow when spending fits income but misses the savings goal", () => {
    expect(forecastMonthEnd(base).status).toBe("yellow"); // 3900 < 5000 ≤ 6000
  });

  it("red when the projection exceeds expected income", () => {
    expect(forecastMonthEnd({ ...base, variableExpenses: 2000 }).status).toBe("red"); // 8000 > 6000
  });

  it("no income means no traffic light", () => {
    expect(forecastMonthEnd({ ...base, expectedIncome: 0 }).status).toBeNull();
  });

  it("day 0 does not divide by zero", () => {
    expect(forecastMonthEnd({ ...base, daysElapsed: 0 }).predicted).toBe(32000); // treated as day 1
  });
});
