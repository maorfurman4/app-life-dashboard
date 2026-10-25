// Israeli finance utilities — ILS formatting, VAT, debt projections

import { localDateStr } from "@/utils/date";

export const ILS = (n: number) =>
  n.toLocaleString("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 });

export const ILS_PRECISE = (n: number) =>
  n.toLocaleString("he-IL", { style: "currency", currency: "ILS", minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Israeli VAT rate (2024)
export const VAT_RATE = 0.17;
export const withVAT = (net: number) => net * (1 + VAT_RATE);
export const withoutVAT = (gross: number) => gross / (1 + VAT_RATE);

export interface DebtInput {
  principal: number;        // ₪ original amount
  monthly_payment: number;  // ₪ per month
  annual_interest_rate: number; // % e.g. 4.5
  months_elapsed: number;   // how many payments already made
}

export interface DebtProjection {
  remainingBalance: number;
  monthsLeft: number;
  endDate: string;          // ISO date string
  totalInterestPaid: number;
  totalInterestRemaining: number;
  totalCost: number;        // principal + all interest
  payoffRoadmap: { month: number; balance: number; interest: number; principal: number }[];
}

export function projectDebt(input: DebtInput): DebtProjection {
  const { principal, monthly_payment, annual_interest_rate, months_elapsed } = input;

  // Guard: any NaN/Infinity input returns a safe zero projection
  const safePrincipal = isFinite(principal) && principal > 0 ? principal : 0;
  const safePayment   = isFinite(monthly_payment) && monthly_payment > 0 ? monthly_payment : 0;
  const safeRate      = isFinite(annual_interest_rate) && annual_interest_rate >= 0 ? annual_interest_rate : 0;
  if (safePrincipal === 0 || safePayment === 0) {
    return { remainingBalance: safePrincipal, monthsLeft: 0, endDate: localDateStr(), totalInterestPaid: 0, totalInterestRemaining: 0, totalCost: safePrincipal, payoffRoadmap: [] };
  }

  const monthlyRate = safeRate / 100 / 12;

  // Reconstruct current balance after months_elapsed payments
  let balance = safePrincipal;
  let totalInterestPaid = 0;
  for (let i = 0; i < months_elapsed; i++) {
    const interest = balance * monthlyRate;
    const principalPaid = Math.min(safePayment - interest, balance);
    totalInterestPaid += interest;
    balance = Math.max(0, balance - principalPaid);
    if (balance === 0) break;
  }

  // Project remaining payments
  const roadmap: DebtProjection["payoffRoadmap"] = [];
  let remaining = balance;
  let totalInterestRemaining = 0;
  let months = 0;

  while (remaining > 0.01 && months < 600) {
    const interest = remaining * monthlyRate;
    const principalPaid = Math.min(safePayment - interest, remaining);
    if (principalPaid <= 0) break; // payment too low to cover interest
    totalInterestRemaining += interest;
    remaining = Math.max(0, remaining - principalPaid);
    months++;
    if (months <= 36 || months % 12 === 0) {
      roadmap.push({ month: months, balance: Math.round(remaining), interest: Math.round(interest), principal: Math.round(principalPaid) });
    }
  }

  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + months);

  return {
    remainingBalance: Math.round(balance),
    monthsLeft: months,
    endDate: localDateStr(endDate),
    totalInterestPaid: Math.round(totalInterestPaid),
    totalInterestRemaining: Math.round(totalInterestRemaining),
    totalCost: Math.round(safePrincipal + totalInterestPaid + totalInterestRemaining),
    payoffRoadmap: roadmap,
  };
}

// Israeli grocery price estimates (₪) — stub for transparency XML data
export const GROCERY_PRICE_ESTIMATES: Record<string, { min: number; max: number; unit: string }> = {
  "חלב 1ל": { min: 5.9, max: 7.9, unit: "ל'" },
  "לחם": { min: 6.9, max: 11.9, unit: "כיכר" },
  "ביצים 12": { min: 12.9, max: 18.9, unit: "קרטון" },
  "עוף שלם": { min: 22, max: 38, unit: "ק\"ג" },
  "חזה עוף": { min: 28, max: 45, unit: "ק\"ג" },
  "קוטג'": { min: 5.5, max: 8.5, unit: "250g" },
  "גבינה צהובה": { min: 22, max: 38, unit: "200g" },
  "אורז 1ק": { min: 5.9, max: 10.9, unit: "ק\"ג" },
  "פסטה": { min: 4.5, max: 8.5, unit: "500g" },
  "שמן זית": { min: 22, max: 45, unit: "750מ\"ל" },
  "בננות": { min: 4, max: 8, unit: "ק\"ג" },
  "עגבניות": { min: 5, max: 12, unit: "ק\"ג" },
  "מלפפון": { min: 4, max: 9, unit: "ק\"ג" },
  "תפוחי עץ": { min: 6, max: 14, unit: "ק\"ג" },
  "לימונים": { min: 5, max: 12, unit: "ק\"ג" },
  "תפוחי אדמה": { min: 4, max: 8, unit: "ק\"ג" },
  "גזר": { min: 3, max: 7, unit: "ק\"ג" },
  "בצל": { min: 3, max: 7, unit: "ק\"ג" },
  "שום": { min: 8, max: 18, unit: "250g" },
  "מים מינרלי 6פ": { min: 12, max: 22, unit: "פאק" },
  "נייר טואלט": { min: 18, max: 35, unit: "4יח'" },
  "סבון כלים": { min: 6, max: 14, unit: "בקבוק" },
};

export function estimateItemPrice(name: string): { min: number; max: number; unit: string } | null {
  const lower = name.toLowerCase();
  for (const [key, val] of Object.entries(GROCERY_PRICE_ESTIMATES)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return val;
  }
  return null;
}

/**
 * Calculate monthly payment using standard amortization formula.
 * If annualRate is 0, returns simple division (principal / months).
 */
export function calcMonthlyPayment(principal: number, annualRatePct: number, months: number): number {
  months = Number(months);
  if (!isFinite(months) || months <= 0) return 0;
  if (annualRatePct === 0) return principal / months;
  const r = annualRatePct / 12 / 100;
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

/**
 * Calculate months to payoff using iterative simulation.
 * Returns Infinity if payment is too small to cover interest.
 */
export function calcMonthsToPayoff(principal: number, annualRatePct: number, monthlyPayment: number): number {
  if (principal <= 0) return 0;
  if (monthlyPayment <= 0) return Infinity;
  if (annualRatePct === 0) return Math.ceil(principal / monthlyPayment);
  const r = annualRatePct / 12 / 100;
  const monthlyInterest = principal * r;
  if (monthlyPayment <= monthlyInterest) return Infinity;
  return Math.ceil(Math.log(monthlyPayment / (monthlyPayment - monthlyInterest)) / Math.log(1 + r));
}

/**
 * How many days of the given month (1-12) have elapsed as of `today`:
 * a past month counts in full, the current month through today, a future month not at all.
 * Fixed income/expenses with a day ≤ this value are already credited/charged for that month.
 */
export function accruedThroughDay(year: number, month: number, today: Date): number {
  const viewed = year * 12 + month;
  const current = today.getFullYear() * 12 + today.getMonth() + 1;
  if (viewed < current) return new Date(year, month, 0).getDate();
  if (viewed > current) return 0;
  return today.getDate();
}
