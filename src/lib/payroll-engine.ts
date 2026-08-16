// Payroll calculation engine — computes monthly payslip from shifts + settings

export interface PayrollSettings {
  base_hourly_rate: number;
  alt_hourly_rate: number;
  /** Hourly rate for the 'achmash' role — a distinct shift type with its own (shifted) hours and pay */
  achmash_hourly_rate: number;
  recovery_per_hour: number;
  excellence_per_hour: number;
  shabbat_hourly_rate: number;
  travel_per_shift: number;
  briefing_per_shift: number;
  national_insurance_pct: number;
  health_insurance_pct: number;
  lunch_deduction: number;
  union_national_deduction: number;
  harel_savings_pct: number;
  harel_study_pct: number;
  harel_travel_pct: number;
  extra_harel_pct: number;
  income_sync_mode: 'net' | 'bank';
  /** When true, hours beyond 8 in a single shift are paid as overtime (125% / 150%) per Israeli law */
  overtime_enabled: boolean;
}

export interface ShiftRow {
  id: string;
  date: string;
  type: string;
  role: string;
  is_shabbat_holiday: boolean;
  has_briefing: boolean;
  hours: number | null;
  notes: string | null;
}

export const SHIFT_HOURS: Record<string, number> = {
  morning: 8,
  afternoon: 8,
  night: 8,
  long_morning: 12,
  long_night: 12,
  briefing: 8,
  manual_hourly: 0,
  vacation_day: 8,
  sick_day: 8,
  vacation: 8,      // alias for vacation_day (legacy)
  sick: 8,          // alias for sick_day (legacy)
};

export const SHIFT_LABELS: Record<string, string> = {
  morning: 'בוקר',
  afternoon: 'צהריים',
  night: 'לילה',
  long_morning: 'ארוכה בוקר',
  long_night: 'ארוכה לילה',
  briefing: 'רענון',
  manual_hourly: 'שעות ידניות',
  vacation_day: 'יום חופשה',
  sick_day: 'יום מחלה',
};

export const SHIFT_TIMES: Record<string, { start: string; end: string }> = {
  morning: { start: '07:00', end: '15:00' },
  afternoon: { start: '15:00', end: '23:00' },
  night: { start: '23:00', end: '07:00' },
  long_morning: { start: '07:00', end: '19:00' },
  long_night: { start: '19:00', end: '07:00' },
  briefing: { start: '06:00', end: '19:00' },
  manual_hourly: { start: '00:00', end: '00:00' },
  vacation_day: { start: '00:00', end: '00:00' },
  sick_day: { start: '00:00', end: '00:00' },
};

/** אחמ"ש shifts run one hour earlier than the equivalent regular shift, same durations */
export const ACHMASH_SHIFT_TIMES: Record<string, { start: string; end: string }> = {
  morning: { start: '06:00', end: '14:00' },
  afternoon: { start: '14:00', end: '22:00' },
  night: { start: '22:00', end: '06:00' },
  long_morning: { start: '06:00', end: '18:00' },
  long_night: { start: '18:00', end: '06:00' },
};

/** Returns the shift's clock times, accounting for the role-specific (אחמ"ש) time shift */
export function getShiftTimes(type: string, role?: string): { start: string; end: string } {
  if (role === 'achmash' && ACHMASH_SHIFT_TIMES[type]) return ACHMASH_SHIFT_TIMES[type];
  return SHIFT_TIMES[type] ?? { start: '—', end: '—' };
}

export interface ShiftBreakdown {
  basePay: number;
  recovery: number;
  excellence: number;
  shabbatPay: number;
  /** Pay for hours 9-10 of the shift, at 125% of the applicable (normal/shabbat) rate */
  overtime125: number;
  /** Pay for hour 11+ of the shift, at 150% of the applicable (normal/shabbat) rate */
  overtime150: number;
  travel: number;
  briefingPay: number;
  totalGross: number;
}

export interface MonthlyPayslip {
  // Earnings
  basePay: number;
  recovery: number;
  excellence: number;
  shabbatPay: number;
  travel: number;
  briefingPay: number;
  totalGross: number;

  // Mandatory deductions
  nationalInsurance: number;
  healthInsurance: number;
  totalMandatory: number;

  // Office deductions
  lunchDeduction: number;
  unionNational: number;
  totalOffice: number;

  // Pension/savings deductions
  harelSavings: number;
  harelStudy: number;
  harelTravel: number;
  extraHarel: number;
  totalPension: number;

  totalDeductions: number;
  netPay: number;
  bankAmount: number;

  // Stats
  totalShifts: number;
  totalHours: number;
  shabbatHours: number;
  overtimeHours: number;
  overtimePay: number;
  briefingCount: number;
  travelCount: number;
}

export const DEFAULT_PAYROLL_SETTINGS: PayrollSettings = {
  base_hourly_rate: 52.80,
  alt_hourly_rate: 56.20,
  achmash_hourly_rate: 52.80,
  recovery_per_hour: 1.51,
  excellence_per_hour: 3.17,
  shabbat_hourly_rate: 79.20,
  travel_per_shift: 22.60,
  briefing_per_shift: 13.58,
  national_insurance_pct: 1.15,
  health_insurance_pct: 0.86,
  lunch_deduction: 0,
  union_national_deduction: 0,
  harel_savings_pct: 7.00,
  harel_study_pct: 2.50,
  harel_travel_pct: 5.00,
  extra_harel_pct: 7.00,
  income_sync_mode: 'net',
  overtime_enabled: true,
};

function getShiftHours(shift: ShiftRow): number {
  if (shift.hours !== null && shift.hours !== undefined && shift.hours > 0) return shift.hours;
  return SHIFT_HOURS[shift.type] || 8;
}

/** Shift types that receive no monetary compensation (tracked only) */
const NON_PAID_TYPES = new Set(["vacation_day", "sick_day", "vacation", "sick"]);

const EMPTY_BREAKDOWN: ShiftBreakdown = {
  basePay: 0, recovery: 0, excellence: 0, shabbatPay: 0,
  overtime125: 0, overtime150: 0, travel: 0, briefingPay: 0, totalGross: 0,
};

/**
 * Auto-detects whether a shift falls on Shabbat, based on its date and type.
 * A manual `is_shabbat_holiday` flag always wins (covers Jewish holidays,
 * which aren't auto-detected here).
 *
 * Rules (Israel, Shabbat = Friday sunset → Saturday nightfall):
 * - Saturday-dated shifts: Shabbat, EXCEPT a "night" shift starting 23:00
 *   Saturday — that's always after Havdalah, so it's a regular weekday shift.
 * - Friday-dated night/long_night shifts (start 19:00-23:00): Shabbat,
 *   since they run well past Shabbat's start in every season.
 */
export function isShiftShabbat(shift: Pick<ShiftRow, "date" | "type" | "is_shabbat_holiday">): boolean {
  if (shift.is_shabbat_holiday) return true;
  const day = new Date(shift.date + 'T12:00:00').getDay(); // 0=Sun..6=Sat
  if (day === 6) return shift.type !== 'night';
  if (day === 5) return shift.type === 'night' || shift.type === 'long_night';
  return false;
}

/** Splits total shift hours into regular / 125% / 150% tiers per Israeli overtime law (§16, חוק שעות עבודה ומנוחה) */
function splitOvertimeHours(hours: number, overtimeEnabled: boolean) {
  if (!overtimeEnabled) return { regular: hours, ot125: 0, ot150: 0 };
  const regular = Math.min(hours, 8);
  const ot125 = Math.min(Math.max(hours - 8, 0), 2);
  const ot150 = Math.max(hours - 10, 0);
  return { regular, ot125, ot150 };
}

export function calcShiftBreakdown(shift: ShiftRow, settings: PayrollSettings): ShiftBreakdown {
  // Vacation/sick days — tracked but no pay calculation
  if (NON_PAID_TYPES.has(shift.type)) return EMPTY_BREAKDOWN;

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const hours = getShiftHours(shift);
  if (!hours) return EMPTY_BREAKDOWN;

  const isShabbat = isShiftShabbat(shift);
  const normalRate = shift.type === "manual_hourly"
    ? settings.base_hourly_rate
    : shift.role === 'achmash' ? settings.achmash_hourly_rate
    : shift.role === 'shift_manager' ? settings.alt_hourly_rate
    : settings.base_hourly_rate;
  const rate = isShabbat ? settings.shabbat_hourly_rate : normalRate;

  const { regular, ot125, ot150 } = splitOvertimeHours(hours, settings.overtime_enabled);

  // BUG-5: Split Shabbat pay into base (normal rate) + premium (extra) so shabbatPay > 0 — applies to the regular-tier hours only
  const basePay = r2(regular * normalRate);
  const shabbatPay = isShabbat ? r2(regular * (settings.shabbat_hourly_rate - normalRate)) : 0;
  const overtime125 = r2(ot125 * rate * 1.25);
  const overtime150 = r2(ot150 * rate * 1.5);

  const recovery = r2(hours * settings.recovery_per_hour);
  const excellence = r2(hours * settings.excellence_per_hour);
  const travel = settings.travel_per_shift;
  const briefingPay = shift.has_briefing ? settings.briefing_per_shift : 0;

  const totalGross = r2(basePay + shabbatPay + overtime125 + overtime150 + recovery + excellence + travel + briefingPay);

  return { basePay, recovery, excellence, shabbatPay, overtime125, overtime150, travel, briefingPay, totalGross };
}

export function calcMonthlyPayslip(shifts: ShiftRow[], settings: PayrollSettings): MonthlyPayslip {
  let basePay = 0;
  let recovery = 0;
  let excellence = 0;
  let shabbatPay = 0;
  let overtime125 = 0;
  let overtime150 = 0;
  let travel = 0;
  let briefingPay = 0;
  let totalHours = 0;
  let shabbatHours = 0;
  let overtimeHours = 0;
  let briefingCount = 0;

  for (const shift of shifts) {
    const bd = calcShiftBreakdown(shift, settings);
    const hours = getShiftHours(shift);

    basePay += bd.basePay;
    recovery += bd.recovery;
    excellence += bd.excellence;
    shabbatPay += bd.shabbatPay;
    overtime125 += bd.overtime125;
    overtime150 += bd.overtime150;
    travel += bd.travel;
    briefingPay += bd.briefingPay;
    // Only count hours/shabbat for paid shifts — vacations/sick days tracked separately
    if (!NON_PAID_TYPES.has(shift.type)) {
      totalHours += hours;
      if (isShiftShabbat(shift)) shabbatHours += hours;
      if (settings.overtime_enabled) overtimeHours += Math.max(hours - 8, 0);
    }
    if (shift.has_briefing) briefingCount++;
  }

  const overtimePay = overtime125 + overtime150;
  const totalGross = basePay + recovery + excellence + shabbatPay + overtimePay + travel + briefingPay;

  // Mandatory deductions (% of gross)
  const nationalInsurance = totalGross * (settings.national_insurance_pct / 100);
  const healthInsurance = totalGross * (settings.health_insurance_pct / 100);
  const totalMandatory = nationalInsurance + healthInsurance;

  // Office deductions (fixed amounts)
  const lunchDeduction = settings.lunch_deduction;
  const unionNational = settings.union_national_deduction;
  const totalOffice = lunchDeduction + unionNational;

  // Pension/savings deductions (% of gross)
  const harelSavings = totalGross * (settings.harel_savings_pct / 100);
  const harelStudy = totalGross * (settings.harel_study_pct / 100);
  const harelTravel = totalGross * (settings.harel_travel_pct / 100);
  const extraHarel = totalGross * (settings.extra_harel_pct / 100);
  const totalPension = harelSavings + harelStudy + harelTravel + extraHarel;

  const totalDeductions = totalMandatory + totalOffice + totalPension;
  const netPay = totalGross - totalDeductions;
  const bankAmount = netPay; // Can be extended later

  const r2 = (n: number) => Math.round(n * 100) / 100;

  return {
    basePay: r2(basePay),
    recovery: r2(recovery),
    excellence: r2(excellence),
    shabbatPay: r2(shabbatPay),
    overtimePay: r2(overtimePay),
    travel: r2(travel),
    briefingPay: r2(briefingPay),
    totalGross: r2(totalGross),
    nationalInsurance: r2(nationalInsurance),
    healthInsurance: r2(healthInsurance),
    totalMandatory: r2(totalMandatory),
    lunchDeduction: r2(lunchDeduction),
    unionNational: r2(unionNational),
    totalOffice: r2(totalOffice),
    harelSavings: r2(harelSavings),
    harelStudy: r2(harelStudy),
    harelTravel: r2(harelTravel),
    extraHarel: r2(extraHarel),
    totalPension: r2(totalPension),
    totalDeductions: r2(totalDeductions),
    netPay: r2(netPay),
    bankAmount: r2(bankAmount),
    totalShifts: shifts.filter(s => !NON_PAID_TYPES.has(s.type)).length,
    totalHours: r2(totalHours),
    shabbatHours: r2(shabbatHours),
    overtimeHours: r2(overtimeHours),
    briefingCount,
    travelCount: shifts.filter(s => !NON_PAID_TYPES.has(s.type) && s.type !== "manual_hourly").length,
  };
}
