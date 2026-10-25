import { describe, it, expect } from "vitest";
import {
  calcShiftBreakdown,
  calcMonthlyPayslip,
  isShiftShabbat,
  hasCoupon,
  DEFAULT_PAYROLL_SETTINGS,
  type PayrollSettings,
  type ShiftRow,
} from "./payroll-engine";

const settings: PayrollSettings = { ...DEFAULT_PAYROLL_SETTINGS, overtime_enabled: false };

function shift(overrides: Partial<ShiftRow>): ShiftRow {
  return {
    id: "s1",
    date: "2026-10-20", // Tuesday
    type: "morning",
    role: "guard",
    is_shabbat_holiday: false,
    has_briefing: false,
    hours: null,
    notes: null,
    ...overrides,
  };
}

describe("payroll engine baseline", () => {
  it("morning shift on a weekday pays base rate", () => {
    const bd = calcShiftBreakdown(shift({}), settings);
    expect(bd.basePay).toBe(422.4);
    expect(bd.shabbatPay).toBe(0);
  });

  it("saturday morning is auto-detected as shabbat", () => {
    expect(isShiftShabbat({ date: "2026-10-24", type: "morning", is_shabbat_holiday: false })).toBe(true);
  });

  it("saturday 23:00 night shift is not shabbat", () => {
    expect(isShiftShabbat({ date: "2026-10-24", type: "night", is_shabbat_holiday: false })).toBe(false);
  });

  it("friday night is shabbat", () => {
    expect(isShiftShabbat({ date: "2026-10-23", type: "night", is_shabbat_holiday: false })).toBe(true);
  });

  it("vacation and sick days pay nothing", () => {
    expect(calcShiftBreakdown(shift({ type: "vacation_day" }), settings).totalGross).toBe(0);
    expect(calcShiftBreakdown(shift({ type: "sick_day" }), settings).totalGross).toBe(0);
  });

  it("12h shift with overtime splits 8/2/2", () => {
    const bd = calcShiftBreakdown(shift({ type: "long_morning" }), { ...settings, overtime_enabled: true });
    expect(bd.basePay).toBe(422.4); // 8 regular hours
    expect(bd.overtime125).toBe(132); // 2h × 52.80 × 1.25
    expect(bd.overtime150).toBe(158.4); // 2h × 52.80 × 1.5
  });

  it("monthly net equals gross minus deductions", () => {
    const p = calcMonthlyPayslip([shift({}), shift({ id: "s2", date: "2026-10-21" })], settings);
    expect(p.netPay).toBeCloseTo(p.totalGross - p.totalDeductions, 2);
  });
});

describe("meal vouchers (separate from salary)", () => {
  it("coupon total counts meal and travel notes", () => {
    const p = calcMonthlyPayslip([
      shift({ id: "a", notes: "ארוחה +68₪" }),
      shift({ id: "b", date: "2026-10-21", notes: "ארוחה +68₪" }),
      shift({ id: "c", date: "2026-10-22", notes: "נסיעות +68₪" }),
    ], settings);
    expect(p.couponCount).toBe(3);
    expect(p.couponTotal).toBe(204);
  });

  it("coupons are not part of gross or net", () => {
    const withCoupons = calcMonthlyPayslip([shift({ notes: "ארוחה +68₪" })], settings);
    const without = calcMonthlyPayslip([shift({})], settings);
    expect(withCoupons.totalGross).toBe(without.totalGross);
    expect(withCoupons.netPay).toBe(without.netPay);
  });

  it("month with no shifts has zero coupons and zero net", () => {
    const p = calcMonthlyPayslip([], { ...settings, lunch_deduction: 4 });
    expect(p.couponTotal).toBe(0);
    expect(p.netPay).toBe(0);
  });

  it("vacation day with a coupon note gets no coupon", () => {
    const p = calcMonthlyPayslip([shift({ type: "vacation_day", notes: "ארוחה +68₪" })], settings);
    expect(p.couponCount).toBe(0);
  });

  it("hasCoupon reads the shift notes", () => {
    expect(hasCoupon({ notes: "ארוחה +68₪" })).toBe(true);
    expect(hasCoupon({ notes: null })).toBe(false);
  });
});
