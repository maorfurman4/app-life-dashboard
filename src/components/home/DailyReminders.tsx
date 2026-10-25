import { localDateStr } from "@/utils/date";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bell, X, Apple, Dumbbell, Droplets, CheckCircle2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

interface Reminder {
  id: "meal" | "workout" | "water";
  icon: any;
  title: string;
  message: string;
  href: string;
  color: string;
  bg: string;
}

const DISMISS_KEY = "reminders-dismissed-date";

function getTodayStr() {
  return localDateStr();
}

function getDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (parsed.date !== getTodayStr()) return new Set();
    return new Set(parsed.ids);
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DISMISS_KEY, JSON.stringify({
    date: getTodayStr(),
    ids: Array.from(ids),
  }));
}

export function DailyReminders() {
  const today = getTodayStr();
  const [dismissed, setDismissed] = useState<Set<string>>(() => getDismissed());
  const { user } = useAuth();
  const userId = user?.id;

  // Check today's nutrition
  const { data: nutritionToday } = useQuery({
    queryKey: ["reminders-nutrition", userId, today],
    queryFn: async () => {
      const { data } = await supabase
        .from("nutrition_entries")
        .select("id, calories")
        .eq("date", today);
      return data || [];
    },
  });

  // Check today's workout
  const { data: workoutToday } = useQuery({
    queryKey: ["reminders-workout", userId, today],
    queryFn: async () => {
      const { data } = await supabase
        .from("workouts")
        .select("id")
        .eq("date", today);
      return data || [];
    },
  });

  // Check today's water
  const { data: waterToday } = useQuery({
    queryKey: ["reminders-water", userId, today],
    queryFn: async () => {
      const { data } = await supabase
        .from("water_entries")
        .select("glasses")
        .eq("date", today);
      const total = (data || []).reduce((s, w) => s + (w.glasses || 0), 0);
      return total;
    },
  });

  // Get user water goal
  const { data: settings } = useQuery({
    queryKey: ["reminders-settings", userId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("user_settings")
        .select("daily_water_glasses_goal")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
  });

  const now = new Date();
  const hour = now.getHours();
  const reminders: Reminder[] = [];

  // Meal reminder: after 11am if no meals
  if (hour >= 11 && (nutritionToday?.length ?? 0) === 0) {
    reminders.push({
      id: "meal",
      icon: Apple,
      title: "אכלת היום?",
      message: "עוד לא רשמת אף ארוחה. הוסף עכשיו כדי לעקוב אחר הקלוריות והמאקרו.",
      href: "/nutrition",
      color: "text-nutrition",
      bg: "bg-nutrition/10 border-nutrition/30",
    });
  }

  // Workout reminder: after 5pm if no workout
  if (hour >= 17 && (workoutToday?.length ?? 0) === 0) {
    reminders.push({
      id: "workout",
      icon: Dumbbell,
      title: "התאמנת היום?",
      message: "עוד לא רשמת אימון. גם 15 דקות תנועה זה משהו.",
      href: "/sport",
      color: "text-sport",
      bg: "bg-sport/10 border-sport/30",
    });
  }

  // Water reminder: after 2pm if less than half goal
  const waterGoal = settings?.daily_water_glasses_goal ?? 8;
  const waterCurrent = waterToday ?? 0;
  if (hour >= 14 && waterCurrent < waterGoal / 2) {
    reminders.push({
      id: "water",
      icon: Droplets,
      title: "שתית מספיק מים?",
      message: `שתית ${waterCurrent} מתוך ${waterGoal} כוסות היום. שתה כוס עכשיו!`,
      href: "/nutrition",
      color: "text-cyan-400",
      bg: "bg-cyan-400/10 border-cyan-400/30",
    });
  }

  const visibleReminders = reminders.filter((r) => !dismissed.has(r.id));

  const dismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    saveDismissed(next);
  };

  // Show "all done" message if everything is logged + nothing dismissed
  const allDone =
    hour >= 18 &&
    (nutritionToday?.length ?? 0) > 0 &&
    (workoutToday?.length ?? 0) > 0 &&
    waterCurrent >= waterGoal &&
    visibleReminders.length === 0 &&
    !dismissed.has("all_done");

  if (visibleReminders.length === 0 && !allDone) return null;

  return (
    <div className="space-y-2">
      {visibleReminders.map((r) => (
        <div key={r.id} className={`rounded-2xl border p-3 flex items-start gap-3 ${r.bg}`}>
          <div className={`h-9 w-9 rounded-xl bg-card flex items-center justify-center shrink-0`}>
            <r.icon className={`h-4 w-4 ${r.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Bell className={`h-3 w-3 ${r.color}`} />
              <p className={`text-xs font-bold ${r.color}`}>{r.title}</p>
            </div>
            <p className="text-[11px] text-muted-foreground">{r.message}</p>
            <Link
              to={r.href as any}
              className={`inline-block mt-2 text-[11px] font-bold ${r.color} hover:underline`}
            >
              עבור עכשיו ←
            </Link>
          </div>
          <button
            onClick={() => dismiss(r.id)}
            className="p-1 rounded-lg hover:bg-card/50 transition-colors shrink-0 min-h-[32px] min-w-[32px] flex items-center justify-center"
            aria-label="סגור"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      ))}

      {allDone && (
        <div className="rounded-2xl border border-sport/30 bg-sport/10 p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-card flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-4 w-4 text-sport" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-sport">יום מושלם! 🎉</p>
            <p className="text-[11px] text-muted-foreground">אכלת, התאמנת ושתית. מעולה!</p>
          </div>
          <button
            onClick={() => dismiss("all_done")}
            className="p-1 rounded-lg hover:bg-card/50 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  );
}
