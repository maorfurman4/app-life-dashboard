import { describe, it, expect } from "vitest";
import {
  calcShiftBreakdown,
  calcMonthlyPayslip,
  isShiftShabbat,
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
