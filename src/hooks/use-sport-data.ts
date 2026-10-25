import { localDateStr } from "@/utils/date";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

// ─── Local-date helpers (avoids UTC-offset bugs for Israeli users UTC+2/+3) ───
function _localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** Israeli week starts on Sunday (day 0). Returns the Sunday of the given date's week. */
function _israeliWeekStart(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // back to Sunday
  d.setHours(0, 0, 0, 0);
  return _localDateStr(d);
}

// ─── Auth helper ───
async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

// ─── Workouts ───
export function useWorkouts(limit = 20) {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: ["workouts", userId, limit],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workouts")
        .select("*, workout_exercises(*), workout_runs(*)")
        .order("date", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useWeekWorkouts() {
  const { user } = useAuth();
  const userId = user?.id;
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  // Use local date formatting to avoid UTC offset shifting the week start for Israeli users.
  // DST edge case: on the clock-change night (last Friday of March / last Sunday of October in Israel),
  // setDate() still produces the correct calendar date because it works in local wall-clock time,
  // but if this function runs within the ambiguous hour (e.g. 01:30 local that gets repeated),
  // "now" could resolve to a slightly wrong instant. This is unlikely to matter for a weekly
  // query boundary, but a robust fix would use a dedicated date-fns/date-fns-tz startOfWeek()
  // with the "Asia/Jerusalem" timezone — deferred to avoid adding a new dependency.
  const startDate = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, "0")}-${String(startOfWeek.getDate()).padStart(2, "0")}`;

  return useQuery({
    queryKey: ["workouts-week", userId, startDate],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workouts")
        .select("*")
        .gte("date", startDate)
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAddWorkout() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (workout: {
      category: string;
      duration_minutes?: number;
      calories_burned?: number;
      notes?: string;
      date?: string;
      template_id?: string;
      exercises?: { name: string; sets: number; reps: number; weight_kg?: number; sets_data?: { reps: number; weight_kg: number }[] }[];
      run?: { distance_km?: number; duration_minutes?: number; pace_per_km?: number };
    }) => {
      const userId = await getUserId();
      const { data: workoutRow, error: wErr } = await supabase
        .from("workouts")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert({
          user_id: userId,
          category: workout.category,
          duration_minutes: workout.duration_minutes || null,
          calories_burned: workout.calories_burned || null,
          notes: workout.notes || null,
          date: workout.date || localDateStr(),
          template_id: workout.template_id || null,
        } as any)
        .select("id")
        .single();
      if (wErr) throw wErr;

      // Insert exercises
      if (workout.exercises?.length) {
        const exerciseRows = workout.exercises.map((ex) => ({
          workout_id: workoutRow.id,
          user_id: userId,
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          weight_kg: ex.weight_kg || null,
          sets_data: ex.sets_data && ex.sets_data.length > 0 ? ex.sets_data : null,
        }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: exErr } = await supabase.from("workout_exercises").insert(exerciseRows as any);
        if (exErr) throw exErr;
      }

      // Insert run data
      if (workout.run) {
        const { error: runErr } = await supabase.from("workout_runs").insert({
          workout_id: workoutRow.id,
          user_id: userId,
          distance_km: workout.run.distance_km || null,
          duration_minutes: workout.run.duration_minutes || null,
          pace_per_km: workout.run.pace_per_km || null,
        });
        if (runErr) throw runErr;
      }

      return workoutRow;
    },
    onSuccess: () => invalidateWorkoutQueries(qc, userId),
  });
}

// Every view derived from the workouts table — history, streak and volume included — must refresh together
function invalidateWorkoutQueries(qc: ReturnType<typeof useQueryClient>, userId: string | undefined) {
  for (const key of ["workouts", "workouts-week", "workout-history", "workout-streak", "weekly-volume", "run-history"]) {
    qc.invalidateQueries({ queryKey: [key, userId] });
  }
}

export function useDeleteWorkout() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workouts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateWorkoutQueries(qc, userId),
  });
}

export function useUpdateWorkout() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes, duration_minutes }: { id: string; notes?: string; duration_minutes?: number }) => {
      const { error } = await supabase
        .from("workouts")
        .update({ notes, duration_minutes })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateWorkoutQueries(qc, userId),
  });
}

// ─── Workout Templates ───
export function useWorkoutTemplates() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: ["workout-templates", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_templates")
        .select("*")
        // system templates first, then newest user templates
        .order("is_system",    { ascending: false })
        .order("created_at",   { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

// ─── Workout Streak ───
export function useWorkoutStreak() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: ["workout-streak", userId],
    enabled: !!userId,
    queryFn: async () => {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const { data, error } = await supabase
        .from("workouts")
        .select("date")
        .gte("date", localDateStr(ninetyDaysAgo))
        .order("date", { ascending: false });
      if (error) throw error;

      const dates = new Set((data || []).map((w: { date: string }) => w.date));
      const today = _localDateStr(); // Bug fix: was .toISOString() which gives UTC, not Israeli local time

      // Start counting from today; if no workout today, start from yesterday
      let cursor = new Date();
      if (!dates.has(today)) cursor.setDate(cursor.getDate() - 1);

      let streak = 0;
      for (let i = 0; i < 90; i++) {
        const ds = _localDateStr(cursor); // Bug fix: was .toISOString() — same UTC issue
        if (dates.has(ds)) {
          streak++;
          cursor.setDate(cursor.getDate() - 1);
        } else {
          break;
        }
      }
      return streak;
    },
  });
}

export function useWorkoutHistory() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: ["workout-history", userId],
    enabled: !!userId,
    queryFn: async () => {
      const uid = await getUserId();
      const { data, error } = await supabase
        .from("workouts")
        .select("id, date, category, duration_minutes, calories_burned, notes, template_id, workout_exercises(id, name, sets, reps, weight_kg)")
        .eq("user_id", uid)
        .order("date", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddWorkoutTemplate() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (template: {
      name: string;
      category: string;
      exercises: { name: string; sets: number; reps: number; weight_kg?: number }[];
      estimated_duration_minutes?: number;
      estimated_calories?: number;
      notes?: string;
    }) => {
      const userId = await getUserId();
      const { error } = await supabase.from("workout_templates").insert({
        user_id: userId,
        name: template.name,
        category: template.category,
        exercises: template.exercises as any,
        estimated_duration_minutes: template.estimated_duration_minutes || null,
        estimated_calories: template.estimated_calories || null,
        notes: template.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workout-templates", userId] }),
  });
}

export function useDeleteWorkoutTemplate() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workout_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workout-templates", userId] }),
  });
}

export function useUpdateWorkoutTemplate() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, exercises, name, category, estimated_duration_minutes }: {
      id: string;
      exercises: { name: string; sets: number; reps: number; weight_kg: number; youtube_link?: string }[];
      name?: string;
      category?: string;
      estimated_duration_minutes?: number;
    }) => {
      const { error } = await supabase
        .from("workout_templates")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({
          exercises: exercises as any,
          ...(name !== undefined && { name }),
          ...(category !== undefined && { category }),
          ...(estimated_duration_minutes !== undefined && { estimated_duration_minutes }),
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workout-templates", userId] }),
  });
}

// ─── Weight Entries ───
export function useWeightEntries(limit = 30) {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: ["weight-entries", userId, limit],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weight_entries")
        .select("*")
        .order("date", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAddWeight() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: { weight_kg: number; date?: string; notes?: string }) => {
      const uid = await getUserId();
      const date = entry.date || localDateStr();
      // upsert: if entry exists for this date, update weight instead of failing
      const { error } = await supabase.from("weight_entries").upsert(
        { user_id: uid, weight_kg: entry.weight_kg, date, notes: entry.notes || null },
        { onConflict: "user_id,date" }
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weight-entries", userId] }),
  });
}

export function useDeleteWeight() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("weight_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weight-entries", userId] }),
  });
}

export function useUpdateWeight() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, weight_kg }: { id: string; weight_kg: number }) => {
      const { error } = await supabase.from("weight_entries").update({ weight_kg }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weight-entries", userId] }),
  });
}

// ─── Running History ───
export function useRunHistory(limit = 20) {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: ["run-history", userId, limit],
    enabled: !!userId,
    queryFn: async () => {
      const uid = await getUserId();
      const { data, error } = await supabase
        .from("workouts")
        .select("*, workout_runs(*)")
        .eq("user_id", uid)
        .eq("category", "running")
        .order("date", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []).map((w: any) => ({
        id:               w.id,
        date:             w.date,
        notes:            w.notes,
        duration_minutes: w.duration_minutes,
        calories_burned:  w.calories_burned,
        run:              (w.workout_runs as any[])?.[0] ?? null,
      }));
    },
  });
}

// ─── Body Progress ───
export function useBodyProgress() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: ["body-progress", userId],
    enabled: !!userId,
    queryFn: async () => {
      const uid = await getUserId();
      const { data, error } = await supabase
        .from("body_progress")
        .select("*")
        .eq("user_id", uid)
        .order("date", { ascending: false })
        .limit(60);
      if (error) throw error;
      // Generate 24h signed URLs for the private bucket.
      // Promise.allSettled ensures one failed URL signing doesn't break the entire list.
      const results = await Promise.allSettled(
        (data || []).map(async (p: any) => {
          if (!p.photo_url) return { ...p, signedUrl: "" };
          const { data: s } = await supabase.storage
            .from("body-progress")
            .createSignedUrl(p.photo_url, 86400);
          return { ...p, signedUrl: s?.signedUrl ?? "" };
        })
      );
      const photos = results.map((result, i) =>
        result.status === "fulfilled" ? result.value : { ...(data || [])[i], signedUrl: "" }
      );
      return photos;
    },
  });
}

export function useAddBodyProgress() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      angle,
      notes,
      date,
    }: {
      file: File;
      angle: string;
      notes?: string;
      date?: string;
    }) => {
      const userId = await getUserId();
      const ext  = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${userId}/${Date.now()}_${angle}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("body-progress")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { error: dbErr } = await (supabase as any).from("body_progress").insert({
        user_id:   userId,
        photo_url: path,
        angle,
        notes:     notes || null,
        date:      date || localDateStr(),
      });
      if (dbErr) {
        await supabase.storage.from("body-progress").remove([path]);
        throw dbErr;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["body-progress", userId] }),
    onError:   (e: Error) => toast.error("שגיאה בהעלאת תמונה: " + e.message),
  });
}

export function useDeleteBodyProgress() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, photoPath }: { id: string; photoPath?: string }) => {
      if (photoPath) {
        await supabase.storage.from("body-progress").remove([photoPath]);
      }
      const { error } = await supabase.from("body_progress").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["body-progress", userId] }),
    onError:   (e: Error) => toast.error("שגיאה במחיקה: " + e.message),
  });
}

// ─── Local date helper (alias — kept for backward compat with callers below) ───
const toLocalDateStr = _localDateStr;

// ─── Nutrition Entries ───
export function useNutritionEntries(date?: string) {
  const { user } = useAuth();
  const userId = user?.id;
  const targetDate = date || toLocalDateStr();
  return useQuery({
    queryKey: ["nutrition-entries", userId, targetDate],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nutrition_entries")
        .select("*")
        .eq("date", targetDate)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAddNutrition() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: {
      name: string;
      meal_type: string;
      calories?: number;
      protein_g?: number;
      carbs_g?: number;
      fat_g?: number;
      notes?: string;
      date?: string;
    }) => {
      const userId = await getUserId();
      const { error } = await supabase.from("nutrition_entries").insert({
        user_id: userId,
        name: entry.name,
        meal_type: entry.meal_type,
        calories: entry.calories || null,
        protein_g: entry.protein_g || null,
        carbs_g: entry.carbs_g || null,
        fat_g: entry.fat_g || null,
        notes: entry.notes || null,
        date: entry.date || toLocalDateStr(),
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nutrition-entries", userId] }),
  });
}

export function useDeleteNutrition() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("nutrition_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nutrition-entries", userId] }),
  });
}

// ─── Water Entries ───
export function useWaterEntry(date?: string) {
  const { user } = useAuth();
  const userId = user?.id;
  const targetDate = date || toLocalDateStr();
  return useQuery({
    queryKey: ["water-entry", userId, targetDate],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("water_entries")
        .select("*")
        .eq("date", targetDate)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertWater() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ glasses, date }: { glasses: number; date?: string }) => {
      const uid = await getUserId();
      const targetDate = date || toLocalDateStr();
      const { data: existing } = await supabase
        .from("water_entries")
        .select("id")
        .eq("user_id", uid)
        .eq("date", targetDate)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase.from("water_entries").update({ glasses }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("water_entries").insert({
          user_id: uid,
          glasses,
          date: targetDate,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water-entry", userId] }),
  });
}

// ─── Water ml quick-add (stores ml directly in the glasses column) ───────────
// New UI uses ml amounts (+500, +750, +1500) instead of glass counts.
// The `glasses` column is repurposed as total_ml_consumed for the day.
export function useAddWaterMl() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ addMl, currentMl, date }: { addMl: number; currentMl: number; date?: string }) => {
      const uid = await getUserId();
      const targetDate = date || toLocalDateStr();
      const newMl = Math.max(0, currentMl + addMl);

      const { data: existing } = await supabase
        .from("water_entries")
        .select("id")
        .eq("user_id", uid)
        .eq("date", targetDate)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("water_entries")
          .update({ glasses: newMl })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("water_entries")
          .insert({ user_id: uid, glasses: newMl, date: targetDate });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water-entry", userId] }),
  });
}

// ─── Stock Holdings ───
export function useStockHoldings() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: ["stock-holdings", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_holdings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAddStockHolding() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (holding: {
      symbol: string;
      name?: string;
      shares: number;
      avg_price: number;
      currency?: string;
    }) => {
      const userId = await getUserId();
      const { error } = await supabase.from("stock_holdings").insert({
        user_id: userId,
        symbol: holding.symbol.toUpperCase(),
        name: holding.name || null,
        shares: holding.shares,
        avg_price: holding.avg_price,
        currency: holding.currency || "USD",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock-holdings", userId] }),
  });
}

export function useDeleteStockHolding() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stock_holdings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock-holdings", userId] }),
  });
}

// ─── Personal Records ───
export function usePersonalRecords() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: ["personal-records", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personal_records")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAddPersonalRecord() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pr: {
      exercise_name: string;
      value: number;
      unit?: string;
      category?: string;
      date?: string;
      notes?: string;
    }) => {
      const userId = await getUserId();
      const { error } = await supabase.from("personal_records").insert({
        user_id: userId,
        exercise_name: pr.exercise_name,
        value: pr.value,
        unit: pr.unit || "reps",
        category: pr.category || "calisthenics",
        date: pr.date || localDateStr(),
        notes: pr.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["personal-records", userId] }),
  });
}

export function useUpdatePersonalRecord() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, value }: { id: string; value: number }) => {
      const { error } = await supabase.from("personal_records").update({ value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["personal-records", userId] }),
  });
}

export function useDeletePersonalRecord() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("personal_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["personal-records", userId] }),
  });
}

// ─── Weekly Training Volume ───
// Bug fix: was using ISO Monday start — now uses Israeli Sunday start to match useWeekWorkouts
const _isoWeekStart = _israeliWeekStart;

export function useWeeklyVolume(weeksBack = 8) {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: ["weekly-volume", userId, weeksBack],
    enabled: !!userId,
    queryFn: async () => {
      const uid = await getUserId();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - weeksBack * 7);

      const { data, error } = await supabase
        .from("workouts")
        .select("date, workout_exercises(weight_kg, reps, sets)")
        .eq("user_id", uid)
        .gte("date", localDateStr(cutoff))
        .order("date", { ascending: true });
      if (error) throw error;

      // Pre-fill all week slots with 0 (ensures empty weeks still render)
      const weeks: Record<string, number> = {};
      for (let i = weeksBack - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i * 7);
        weeks[_isoWeekStart(d)] = 0;
      }

      // Accumulate volume: kg × reps × sets
      for (const w of (data || [])) {
        const ws = _isoWeekStart(new Date(w.date + "T12:00:00")); // noon avoids TZ shifts
        if (!(ws in weeks)) continue;
        for (const ex of ((w as any).workout_exercises || [])) {
          const wkg = Number(ex.weight_kg) || 0;
          if (wkg <= 0) continue;
          weeks[ws] += wkg * (Number(ex.reps) || 1) * (Number(ex.sets) || 1);
        }
      }

      return Object.entries(weeks)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([week, volume]) => ({
          week,
          label: new Date(week + "T12:00:00").toLocaleDateString("he-IL", {
            day: "numeric", month: "numeric",
          }),
          volume: Math.round(volume),
        }));
    },
  });
}

// ─── Favorite Meals ───
export function useFavoriteMeals() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: ["favorite-meals", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favorite_meals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAddFavoriteMeal() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (meal: {
      name: string;
      calories?: number;
      protein_g?: number;
      carbs_g?: number;
      fat_g?: number;
    }) => {
      const userId = await getUserId();
      const { error } = await supabase.from("favorite_meals").insert({
        user_id: userId,
        name: meal.name,
        calories: meal.calories || null,
        protein_g: meal.protein_g || null,
        carbs_g: meal.carbs_g || null,
        fat_g: meal.fat_g || null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorite-meals", userId] }),
  });
}

export function useDeleteFavoriteMeal() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("favorite_meals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorite-meals", userId] }),
  });
}

// ─── User Settings ───
export function useUserSettings() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: ["user-settings", userId],
    enabled: !!userId,
    queryFn: async () => {
      const uid = await getUserId();
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// Alias for generic settings updates (used by settings components)
export function useUpdateUserSettings() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Record<string, unknown>) => {
      const uid = await getUserId();
      const { error } = await (supabase as any)
        .from("user_settings")
        .upsert({ user_id: uid, ...settings }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-settings", userId] });
    },
    onError: (e: Error) => {
      toast.error("שגיאה בשמירת ההגדרות: " + e.message);
    },
  });
}

export function useSaveUserSettings() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Partial<{
      full_name: string | null;
      date_of_birth: string | null;
      height_cm: number | null;
      weight_kg: number | null;
      daily_calories_goal: number | null;
      daily_protein_goal: number | null;
      daily_carbs_goal: number | null;
      daily_fat_goal: number | null;
      daily_water_glasses_goal: number | null;
      weekly_workouts_goal: number | null;
      weekly_minutes_goal: number | null;
      weekly_calories_burn_goal: number | null;
      shoulder_sensitivity: boolean | null;
      training_day_calories: number | null;
      training_day_protein: number | null;
      daily_water_ml: number | null;
      savings_goal_pct: number | null;
      income_sync_mode: string | null;
    }>) => {
      const userId = await getUserId();
      const { error } = await supabase
        .from("user_settings")
        .upsert({ user_id: userId, ...settings }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-settings", userId] });
      qc.invalidateQueries({ queryKey: ["payroll-settings", userId] });
      qc.invalidateQueries({ queryKey: ["finance-settings", userId] });
    },
  });
}
