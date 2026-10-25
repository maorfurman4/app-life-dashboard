import { localDateStr } from "@/utils/date";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMonthlyPayslip } from "@/hooks/use-work-data";
import { useAuth } from "@/hooks/use-auth";
import { useMemo } from "react";
import { toast } from "sonner";

// ─── Auth helper ───
async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ─── Default expense categories ───
export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "שכירות", icon: "🏠" },
  { name: "מנויים", icon: "🔄" },
  { name: "מזון", icon: "🛒" },
  { name: "דלק", icon: "⛽" },
  { name: "ביגוד", icon: "👕" },
  { name: "בית", icon: "🏡" },
  { name: "בילויים", icon: "🎉" },
  { name: "בריאות", icon: "💊" },
  { name: "טיולים", icon: "✈️" },
  { name: "אחר", icon: "📦" },
];

export function useActiveExpenseCategories() {
  const { data: dbCats } = useExpenseCategories();
  return useMemo(() => {
    if (dbCats && dbCats.length > 0) {
      return dbCats.map((c: any) => ({ name: c.name, icon: c.icon || "📦" }));
    }
    return DEFAULT_EXPENSE_CATEGORIES;
  }, [dbCats]);
}

export const INCOME_CATEGORIES = [
  { value: "salary", label: "משכורת" },
  { value: "private_lessons", label: "שיעורים פרטיים" },
  { value: "freelance", label: "פרילנס" },
  { value: "other", label: "אחר" },
];

// ─── Expense Entries ───
export function useExpenseEntries(year: number, month: number) {
  const { user } = useAuth();
  const userId = user?.id;
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  return useQuery({
    queryKey: ["expense-entries", userId, year, month],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_entries")
        .select("*")
        .gte("date", startDate)
        .lt("date", endDate)
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAddExpense() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (expense: {
      amount: number;
      category: string;
      description?: string;
      date: string;
      expense_type: string;
      is_recurring: boolean;
      needs_review: boolean;
      currency?: string;
      exchange_rate?: number;
      original_amount?: number;
    }) => {
      const uid = await getUserId();
      const { error } = await supabase.from("expense_entries").insert({
        ...expense,
        user_id: uid,
      });
      if (error) throw error;
    },
    onMutate: async (newExpense) => {
      // Derive year/month from the expense date (format: "YYYY-MM-DD")
      const [expYear, expMonth] = newExpense.date.split("-").map(Number);
      const queryKey = ["expense-entries", userId, expYear, expMonth];
      await qc.cancelQueries({ queryKey: ["expense-entries", userId] });
      const previousExpenses = qc.getQueryData(queryKey);
      qc.setQueryData(queryKey, (old: any[]) => [
        ...(old ?? []),
        { ...newExpense, id: "optimistic-" + Date.now(), created_at: new Date().toISOString() },
      ]);
      return { previousExpenses, queryKey };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousExpenses !== undefined) {
        qc.setQueryData(context.queryKey, context.previousExpenses);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["expense-entries", userId] });
    },
  });
}

export function useDeleteExpense() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expense_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (expenseId) => {
      await qc.cancelQueries({ queryKey: ["expense-entries", userId] });
      // Snapshot all matching queries (any year/month combination) and optimistically remove
      const previousSnapshots: Array<{ queryKey: readonly unknown[]; data: unknown }> = [];
      qc.setQueriesData(
        { queryKey: ["expense-entries", userId] },
        (old: any) => {
          if (!Array.isArray(old)) return old;
          previousSnapshots.push({ queryKey: ["expense-entries", userId], data: old });
          return old.filter((e: any) => e.id !== expenseId);
        }
      );
      return { previousSnapshots };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousSnapshots) {
        for (const { queryKey, data } of context.previousSnapshots) {
          qc.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["expense-entries", userId] });
    },
  });
}

export function useUpdateExpense() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: {
      id: string;
      amount: number;
      category: string;
      description: string | null;
      date: string;
      is_recurring: boolean;
      currency: string;
      exchange_rate: number;
      original_amount: number | null;
    }) => {
      const { error } = await supabase.from("expense_entries").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense-entries", userId] });
      qc.invalidateQueries({ queryKey: ["expense-history", userId] });
    },
  });
}

// ─── Income Entries ───
export function useIncomeEntries(year: number, month: number) {
  const { user } = useAuth();
  const userId = user?.id;
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  return useQuery({
    queryKey: ["income-entries", userId, year, month],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("income_entries")
        .select("*")
        .gte("date", startDate)
        .lt("date", endDate)
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAddIncome() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (income: {
      amount: number;
      category: string;
      description?: string;
      date: string;
      source?: string;
    }) => {
      const uid = await getUserId();
      const { error } = await supabase.from("income_entries").insert({
        ...income,
        source: income.source || "manual",
        user_id: uid,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["income-entries", userId] }),
  });
}

export function useDeleteIncome() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("income_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["income-entries", userId] }),
  });
}

export function useUpdateIncome() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: {
      id: string;
      amount: number;
      category: string;
      description: string | null;
      date: string;
    }) => {
      const { error } = await supabase.from("income_entries").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["income-entries", userId] });
      qc.invalidateQueries({ queryKey: ["income-history", userId] });
    },
  });
}

// ─── Fixed Expenses ───
export function useFixedExpenses() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: ["fixed-expenses", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fixed_expenses")
        .select("*")
        .order("charge_day", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAddFixedExpense() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (expense: {
      name: string;
      amount: number;
      category: string;
      charge_day: number;
      is_active?: boolean;
      is_recurring?: boolean;
      notes?: string | null;
    }) => {
      const uid = await getUserId();
      const { error } = await supabase.from("fixed_expenses").insert({
        ...expense,
        user_id: uid,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fixed-expenses", userId] }),
  });
}

export function useUpdateFixedExpense() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; amount?: number; category?: string; charge_day?: number; is_active?: boolean; is_recurring?: boolean; notes?: string }) => {
      const { error } = await supabase.from("fixed_expenses").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fixed-expenses", userId] }),
  });
}

export function useDeleteFixedExpense() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fixed_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fixed-expenses", userId] }),
  });
}

// ─── Finance Settings ───
export function useFinanceSettings() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: ["finance-settings", userId],
    enabled: !!userId,
    queryFn: async () => {
      const userId = await getUserId();
      const { data, error } = await db
        .from("user_settings")
        .select("savings_goal_pct, income_sync_mode, savings_goal_amount")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      const row = data as { savings_goal_pct?: number; income_sync_mode?: string; savings_goal_amount?: number | null } | null;
      return {
        savings_goal_pct: row?.savings_goal_pct ?? 35,
        income_sync_mode: (row?.income_sync_mode as "net" | "bank") ?? "net",
        savings_goal_amount: (row?.savings_goal_amount ?? null) as number | null,
      };
    },
  });
}

export function useSaveFinanceSettings() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: { savings_goal_pct?: number; income_sync_mode?: "net" | "bank"; savings_goal_amount?: number | null }) => {
      const uid = await getUserId();
      const { error } = await db
        .from("user_settings")
        .upsert({ user_id: uid, ...updates }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-settings", userId] });
      qc.invalidateQueries({ queryKey: ["payroll-settings", userId] });
      qc.invalidateQueries({ queryKey: ["user-settings", userId] });
    },
  });
}

// ─── Expense Categories (CRUD) ───
export function useExpenseCategories() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: ["expense-categories", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useUpsertCategory() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cat: { id?: string; name: string; icon?: string; budget_limit?: number | null; sort_order?: number }) => {
      const uid = await getUserId();
      if (cat.id) {
        const { error } = await supabase
          .from("expense_categories")
          .update({ name: cat.name, icon: cat.icon, budget_limit: cat.budget_limit, sort_order: cat.sort_order ?? 0 })
          .eq("id", cat.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("expense_categories").insert({
          user_id: uid,
          name: cat.name,
          icon: cat.icon,
          budget_limit: cat.budget_limit,
          sort_order: cat.sort_order ?? 0,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expense-categories", userId] }),
  });
}

export function useDeleteCategory() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expense_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expense-categories", userId] }),
  });
}

// ─── Monthly Finance Summary (computed) ───
export function useMonthlyFinance(year: number, month: number) {
  const { data: expenses } = useExpenseEntries(year, month);
  const { data: incomes } = useIncomeEntries(year, month);
  const { data: fixedExpenses } = useFixedExpenses();
  const { data: fixedIncome } = useFixedIncome();
  const { data: debts } = useDebts();
  const { data: financeSettings } = useFinanceSettings();
  const { payslip, settings: workSettings } = useMonthlyPayslip(year, month);

  return useMemo(() => {
    const savingsGoal = financeSettings?.savings_goal_pct ?? 35;
    const savingsGoalAmount = financeSettings?.savings_goal_amount ?? null;
    const syncMode = financeSettings?.income_sync_mode ?? "net";

    // Work income
    const workIncome = payslip
      ? syncMode === "bank" ? payslip.bankAmount : payslip.netPay
      : 0;
    const grossFromWork = payslip?.totalGross ?? 0;
    const netFromWork = payslip?.netPay ?? 0;

    // Manual income entries
    const manualIncome = (incomes || [])
      .filter((i: any) => (i.source ?? "manual") === "manual")
      .reduce((sum: number, e: any) => sum + Number(e.amount), 0);

    // Fixed income (active, already credited this month)
    const today = new Date();
    const currentDay = today.getDate();
    const activeFixedIncome = (fixedIncome || []).filter((f: any) => f.is_active);
    const totalFixedIncomeMonthly = activeFixedIncome.reduce((sum: number, f: any) => sum + Number(f.amount), 0);
    const fixedIncomeAlreadyCredited = activeFixedIncome
      .filter((f: any) => f.day_of_month <= currentDay)
      .reduce((sum: number, f: any) => sum + Number(f.amount), 0);

    const totalIncome = workIncome + manualIncome + fixedIncomeAlreadyCredited;

    // Variable expenses
    const variableExpenses = (expenses || []).reduce((sum: number, e: any) => sum + Number(e.amount), 0);

    // Fixed expenses (active)
    const activeFixed = (fixedExpenses || []).filter((f: any) => f.is_active);
    const totalFixedMonthly = activeFixed.reduce((sum: number, f: any) => sum + Number(f.amount), 0);
    const fixedAlreadyCharged = activeFixed
      .filter((f: any) => f.charge_day <= currentDay)
      .reduce((sum: number, f: any) => sum + Number(f.amount), 0);
    const fixedRemaining = totalFixedMonthly - fixedAlreadyCharged;

    // Debt monthly payments (auto-deducted)
    const activeDebts = (debts || []).filter((d: any) => d.is_active !== false);
    const totalDebtMonthly = activeDebts.reduce((sum: number, d: any) => sum + Number(d.monthly_payment), 0);

    const totalExpenses = variableExpenses + fixedAlreadyCharged + totalDebtMonthly;
    const balance = totalIncome - totalExpenses;

    // Savings
    const savings = totalIncome > 0 ? balance : 0;
    const savingsPct = totalIncome > 0 ? (savings / totalIncome) * 100 : 0;
    const savingsTarget = savingsGoalAmount ?? (totalIncome * (savingsGoal / 100));
    const savingsGap = savingsTarget - savings;

    // Forecast (full month)
    const forecastExpenses = variableExpenses + totalFixedMonthly + totalDebtMonthly;
    const forecastIncome = workIncome + manualIncome + totalFixedIncomeMonthly;
    const forecastBalance = forecastIncome - forecastExpenses;
    const forecastSavingsPct = forecastIncome > 0 ? (forecastBalance / forecastIncome) * 100 : 0;

    // Status
    let savingsStatus: "on_target" | "close" | "far" = "far";
    if (savingsPct >= savingsGoal) savingsStatus = "on_target";
    else if (savingsPct >= savingsGoal - 10) savingsStatus = "close";

    // Category breakdown
    const categoryBreakdown = (expenses || []).reduce((acc: Record<string, number>, e: any) => {
      const cat = e.category;
      if (!cat) return acc; // skip null/undefined categories to prevent phantom "null" entries
      acc[cat] = (acc[cat] || 0) + Number(e.amount);
      return acc;
    }, {} as Record<string, number>);

    const daysInMonth = new Date(year, month, 0).getDate();
    // For current month use elapsed days; for past months use full month length
    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;
    const daysElapsed = isCurrentMonth ? Math.max(currentDay, 1) : daysInMonth;
    const avgDailyExpense = totalExpenses / daysElapsed;
    const avgDailyIncome = totalIncome / daysElapsed;

    return {
      workIncome,
      grossFromWork,
      netFromWork,
      manualIncome,
      totalIncome,
      variableExpenses,
      totalFixedMonthly,
      fixedAlreadyCharged,
      fixedRemaining,
      totalDebtMonthly,
      totalFixedIncomeMonthly,
      fixedIncomeAlreadyCredited,
      totalExpenses,
      balance,
      savings: Math.max(savings, 0),
      savingsPct: Math.max(savingsPct, 0),
      savingsGoal,
      savingsGoalAmount,
      savingsTarget,
      savingsGap,
      savingsStatus,
      forecastExpenses,
      forecastBalance,
      forecastSavingsPct,
      categoryBreakdown,
      avgDailyExpense,
      avgDailyIncome,
      daysInMonth,
      expenses: expenses || [],
      incomes: incomes || [],
      fixedExpenses: activeFixed,
      fixedIncome: activeFixedIncome,
      debts: activeDebts,
    };
  }, [expenses, incomes, fixedExpenses, fixedIncome, debts, payslip, financeSettings, workSettings, year, month]);
}

// ─── Historical data for trends (6 months) ───
export function useExpenseHistory(months: number = 6) {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: ["expense-history", userId, months],
    enabled: !!userId,
    queryFn: async () => {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
      const { data, error } = await supabase
        .from("expense_entries")
        .select("amount, category, date")
        .gte("date", localDateStr(startDate))
        .order("date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useIncomeHistory(months: number = 6) {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: ["income-history", userId, months],
    enabled: !!userId,
    queryFn: async () => {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
      const { data, error } = await supabase
        .from("income_entries")
        .select("amount, date")
        .gte("date", localDateStr(startDate))
        .order("date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

// ─── Fixed Income ───

export function useFixedIncome() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: ["fixed-income", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await db
        .from("fixed_income")
        .select("*")
        .order("day_of_month", { ascending: true });
      if (error) throw error;
      return (data || []) as Record<string, unknown>[];
    },
  });
}

export function useAddFixedIncome() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (income: {
      name: string;
      amount: number;
      category: string;
      day_of_month: number;
      is_active?: boolean;
      notes?: string | null;
    }) => {
      const uid = await getUserId();
      const { error } = await db.from("fixed_income").insert({ ...income, user_id: uid });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fixed-income", userId] }),
  });
}

export function useUpdateFixedIncome() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; amount?: number; category?: string; day_of_month?: number; is_active?: boolean; notes?: string }) => {
      const { error } = await db.from("fixed_income").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fixed-income", userId] }),
  });
}

export function useDeleteFixedIncome() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("fixed_income").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fixed-income", userId] }),
  });
}

// ─── Debts (Supabase) ───
export function useDebts() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: ["debts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await db
        .from("debts")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Record<string, unknown>[];
    },
  });
}

export function useAddDebt() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (debt: {
      name: string;
      type: string;
      principal: number;
      monthly_payment: number;
      annual_interest_rate: number;
      months_elapsed: number;
    }) => {
      const uid = await getUserId();
      const { error } = await db.from("debts").insert({ ...debt, user_id: uid });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["debts", userId] }),
  });
}

export function useDeleteDebt() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("debts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["debts", userId] }),
  });
}

export const INCOME_CATEGORIES_FIXED = [
  { name: "משכורת",   icon: "💼" },
  { name: "פרילנס",   icon: "💻" },
  { name: "שיעורים",  icon: "📚" },
  { name: "שכ״ד",    icon: "🏠" },
  { name: "קצבה",    icon: "📋" },
  { name: "אחר",     icon: "💰" },
];

export function useMonthlySnapshots() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: ["monthly-snapshots", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) return [];
      const { data, error } = await (supabase as any)
        .from("monthly_snapshots")
        .select("*")
        .eq("user_id", u.id)
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCloseMonth() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (snapshotData: {
      year: number;
      month: number;
      total_income: number;
      total_expenses: number;
      balance: number;
      savings_pct: number;
      category_breakdown?: Record<string, number>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await (supabase as any)
        .from("monthly_snapshots")
        .upsert({
          user_id: user.id,
          ...snapshotData,
          snapshot_data: snapshotData,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monthly-snapshots", userId] });
      toast.success("החודש נסגר ונשמר בהיסטוריה ✅");
    },
    onError: () => {
      toast.error("שגיאה בסגירת החודש");
    },
  });
}
