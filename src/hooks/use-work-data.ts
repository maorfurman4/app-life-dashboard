import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { calcMonthlyPayslip, DEFAULT_PAYROLL_SETTINGS, type PayrollSettings, type ShiftRow } from "@/lib/payroll-engine";
import { useMemo } from "react";
import { toast } from "sonner";

// ─── Auth helper ───
async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

// ─── Work Shifts ───
export function useWorkShifts(year: number, month: number) {
  const { user } = useAuth();
  const userId = user?.id;
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  return useQuery({
    queryKey: ["work-shifts", userId, year, month],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_shifts")
        .select("*")
        .gte("date", startDate)
        .lt("date", endDate)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data || []) as ShiftRow[];
    },
  });
}

export function useAddShift() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (shift: {
      date: string;
      type: string;
      role: string;
      is_shabbat_holiday: boolean;
      has_briefing: boolean;
      hours: number | null;
      notes: string | null;
    }) => {
      const uid = await getUserId();
      const { error } = await supabase.from("work_shifts").insert({
        ...shift,
        user_id: uid,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-shifts", userId] }),
  });
}

export function useUpdateShift() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<ShiftRow>) => {
      const { error } = await supabase.from("work_shifts").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-shifts", userId] }),
  });
}

export function useDeleteShift() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("work_shifts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-shifts", userId] }),
  });
}

// ─── User Settings (payroll-related) ───
export function usePayrollSettings() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: ["payroll-settings", userId],
    enabled: !!userId,
    queryFn: async () => {
      const uid = await getUserId();
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULT_PAYROLL_SETTINGS;
      return {
        base_hourly_rate: data.base_hourly_rate ?? DEFAULT_PAYROLL_SETTINGS.base_hourly_rate,
        alt_hourly_rate: data.alt_hourly_rate ?? DEFAULT_PAYROLL_SETTINGS.alt_hourly_rate,
        recovery_per_hour: data.recovery_per_hour ?? DEFAULT_PAYROLL_SETTINGS.recovery_per_hour,
        excellence_per_hour: data.excellence_per_hour ?? DEFAULT_PAYROLL_SETTINGS.excellence_per_hour,
        shabbat_hourly_rate: data.shabbat_hourly_rate ?? DEFAULT_PAYROLL_SETTINGS.shabbat_hourly_rate,
        travel_per_shift: data.travel_per_shift ?? DEFAULT_PAYROLL_SETTINGS.travel_per_shift,
        briefing_per_shift: data.briefing_per_shift ?? DEFAULT_PAYROLL_SETTINGS.briefing_per_shift,
        national_insurance_pct: data.national_insurance_pct ?? DEFAULT_PAYROLL_SETTINGS.national_insurance_pct,
        health_insurance_pct: data.health_insurance_pct ?? DEFAULT_PAYROLL_SETTINGS.health_insurance_pct,
        lunch_deduction: data.lunch_deduction ?? DEFAULT_PAYROLL_SETTINGS.lunch_deduction,
        union_national_deduction: data.union_national_deduction ?? DEFAULT_PAYROLL_SETTINGS.union_national_deduction,
        harel_savings_pct: data.harel_savings_pct ?? DEFAULT_PAYROLL_SETTINGS.harel_savings_pct,
        harel_study_pct: data.harel_study_pct ?? DEFAULT_PAYROLL_SETTINGS.harel_study_pct,
        harel_travel_pct: data.harel_travel_pct ?? DEFAULT_PAYROLL_SETTINGS.harel_travel_pct,
        extra_harel_pct: data.extra_harel_pct ?? DEFAULT_PAYROLL_SETTINGS.extra_harel_pct,
        income_sync_mode: (data.income_sync_mode as 'net' | 'bank') ?? DEFAULT_PAYROLL_SETTINGS.income_sync_mode,
        overtime_enabled: data.overtime_enabled ?? DEFAULT_PAYROLL_SETTINGS.overtime_enabled,
        achmash_hourly_rate: data.achmash_hourly_rate ?? DEFAULT_PAYROLL_SETTINGS.achmash_hourly_rate,
      } satisfies PayrollSettings;
    },
  });
}

export function useSavePayrollSettings() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Partial<PayrollSettings>) => {
      const uid = await getUserId();
      const { error } = await supabase
        .from("user_settings")
        .upsert({ user_id: uid, ...settings }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-settings", userId] });
      qc.invalidateQueries({ queryKey: ["finance-settings", userId] });
      qc.invalidateQueries({ queryKey: ["user-settings", userId] });
    },
  });
}

// ─── Batch Add Shifts ───
export function useBatchAddShifts() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (shifts: Array<{
      date: string;
      type: string;
      role: string;
      is_shabbat_holiday: boolean;
      has_briefing: boolean;
      hours: number;
      notes?: string;
    }>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("work_shifts")
        .insert(shifts.map(s => ({ ...s, user_id: user.id })));
      if (error) throw error;
    },
    onSuccess: (_, shifts) => {
      qc.invalidateQueries({ queryKey: ["work-shifts", userId] });
      toast.success(`${shifts.length} משמרות נוספו בהצלחה ✅`);
    },
    onError: () => {
      toast.error("שגיאה בהוספת המשמרות");
    },
  });
}

// ─── Work Month History ───
export function useWorkMonthHistory() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: ["work-monthly-history", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await (supabase as any)
        .from("work_monthly_history")
        .select("*")
        .eq("user_id", user.id)
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useArchiveWorkMonth() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      year: number;
      month: number;
      shifts: ShiftRow[];
      totalShifts: number;
      totalHours: number;
      totalGross: number;
      breakdownByType: Record<string, { count: number; hours: number; gross: number }>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await (supabase as any)
        .from("work_monthly_history")
        .upsert({
          user_id: user.id,
          year: args.year,
          month: args.month,
          total_shifts: args.totalShifts,
          total_hours: args.totalHours,
          total_gross_pay: args.totalGross,
          breakdown_by_type: args.breakdownByType,
          shifts_snapshot: args.shifts,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-monthly-history", userId] });
      toast.success("חודש העבודה נשמר בהיסטוריה ✅");
    },
    onError: () => {
      toast.error("שגיאה בשמירת ההיסטוריה");
    },
  });
}

export function useDeleteWorkMonthHistory() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("work_monthly_history")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-monthly-history", userId] });
      toast.success("הרשומה נמחקה");
    },
    onError: () => toast.error("שגיאה במחיקה"),
  });
}

// ─── Monthly Payslip (computed) ───
export function useMonthlyPayslip(year: number, month: number) {
  const { data: shifts, isLoading: shiftsLoading, isError: shiftsIsError, error: shiftsError } = useWorkShifts(year, month);
  const { data: settings, isLoading: settingsLoading, isError: settingsIsError, error: settingsError } = usePayrollSettings();

  const payslip = useMemo(() => {
    if (!shifts || !settings) return null;
    return calcMonthlyPayslip(shifts, settings);
  }, [shifts, settings]);

  return {
    payslip,
    shifts: shifts || [],
    settings: settings || DEFAULT_PAYROLL_SETTINGS,
    isLoading: shiftsLoading || settingsLoading,
    isError: shiftsIsError || settingsIsError,
    error: shiftsError ?? settingsError ?? null,
  };
}
