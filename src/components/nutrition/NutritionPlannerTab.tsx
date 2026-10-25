import { localDateStr } from "@/utils/date";
import { useEffect, useMemo, useState } from "react";
import { Sparkles, Save, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateText, parseAIJson } from "@/lib/ai-service";
import {
  calcTDEE,
  ACTIVITY_LABELS, ACTIVITY_MULTIPLIER, GOAL_LABELS,
  WORK_STYLE_LABELS, MACRO_PRESET_LABELS, DEFICIT_LABELS,
  type ActivityLevel, type Goal, type Sex,
  type DeficitLevel, type WorkStyle, type MacroPreset,
} from "@/lib/tdee";
import { useAuth } from "@/hooks/use-auth";

async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

function GlassField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl bg-white/8 border border-white/15 text-white px-3 py-2.5 text-sm min-h-[44px] " +
  "focus:outline-none focus:border-emerald-500/60 placeholder:text-white/25 backdrop-blur-sm";

const selectCls =
  "w-full rounded-xl bg-white/8 border border-white/15 text-white px-3 py-2.5 text-sm min-h-[44px] " +
  "focus:outline-none focus:border-emerald-500/60 backdrop-blur-sm appearance-none";

function ToggleChips<T extends string>({
  options, value, onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {options.map(({ key, label }) => (
        <button key={key} onClick={() => onChange(key)}
          className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
            value === key
              ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-300"
              : "border-white/10 bg-white/5 text-white/50"
          }`}>
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export function NutritionPlannerTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  // ── Core TDEE state ──
  const [sex,      setSex]      = useState<Sex>(() => (localStorage.getItem("tdee_sex") as Sex) ?? "male");
  const [age,      setAge]      = useState(() => parseInt(localStorage.getItem("tdee_age") ?? "28", 10));
  const [height,   setHeight]   = useState(175);
  const [weight,   setWeight]   = useState(75);
  const [activity, setActivity] = useState<ActivityLevel>(() => (localStorage.getItem("tdee_activity") as ActivityLevel) ?? "moderate");
  const [goal,     setGoal]     = useState<Goal>(() => (localStorage.getItem("tdee_goal") as Goal) ?? "maintain");

  // ── New inputs ──
  const [deficitLevel, setDeficitLevel] = useState<DeficitLevel>(() => (localStorage.getItem("tdee_deficit") as DeficitLevel) ?? "moderate");
  const [workStyle,    setWorkStyle]    = useState<WorkStyle>(() => (localStorage.getItem("tdee_work") as WorkStyle) ?? "desk");
  const [steps,        setSteps]        = useState(() => parseInt(localStorage.getItem("tdee_steps") ?? "0", 10));
  const [macroPreset,  setMacroPreset]  = useState<MacroPreset>(() => (localStorage.getItem("tdee_macro") as MacroPreset) ?? "auto");

  const [targetWeight, setTargetWeight] = useState("");
  const [targetDate,   setTargetDate]   = useState("");

  const [healthOpen,       setHealthOpen]       = useState(false);
  const [healthConditions, setHealthConditions] = useState("");
  const [healthAdjustment, setHealthAdjustment] = useState(0);
  const [healthNote,       setHealthNote]       = useState("");
  const [analyzing,        setAnalyzing]        = useState(false);

  // ── Load settings from DB ──
  const { data: settings } = useQuery({
    queryKey: ["user-settings-tdee", userId],
    queryFn: async () => {
      const userId = await getUserId();
      const { data } = await supabase
        .from("user_settings")
        .select("date_of_birth,height_cm,weight_kg")
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!settings) return;
    if (settings.height_cm) setHeight(Number(settings.height_cm));
    if (settings.weight_kg) setWeight(Number(settings.weight_kg));
    if (settings.date_of_birth) {
      const dob = new Date(settings.date_of_birth);
      const today = new Date();
      let computed = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) computed--;
      if (computed > 0 && computed < 120) setAge(computed);
    }
  }, [settings]);

  // ── Persist to localStorage ──
  useEffect(() => { localStorage.setItem("tdee_sex",     sex);           }, [sex]);
  useEffect(() => { localStorage.setItem("tdee_age",     String(age));   }, [age]);
  useEffect(() => { localStorage.setItem("tdee_activity", activity);     }, [activity]);
  useEffect(() => { localStorage.setItem("tdee_goal",    goal);          }, [goal]);
  useEffect(() => { localStorage.setItem("tdee_deficit", deficitLevel);  }, [deficitLevel]);
  useEffect(() => { localStorage.setItem("tdee_work",    workStyle);     }, [workStyle]);
  useEffect(() => { localStorage.setItem("tdee_steps",   String(steps)); }, [steps]);
  useEffect(() => { localStorage.setItem("tdee_macro",   macroPreset);   }, [macroPreset]);

  // ── TDEE result (live) ──
  const result = useMemo(() => calcTDEE({
    sex, age, heightCm: height, weightKg: weight,
    activityLevel: activity, goal,
    deficitLevel,
    workStyle,
    averageSteps: steps,
    targetWeightKg: targetWeight && !isNaN(parseFloat(targetWeight)) ? parseFloat(targetWeight) : undefined,
    targetDate: targetDate || undefined,
    macroPreset,
    healthAdjustment,
  }), [sex, age, height, weight, activity, goal, deficitLevel, workStyle, steps,
       targetWeight, targetDate, macroPreset, healthAdjustment]);

  // ── Load history ──
  const { data: history = [] } = useQuery({
    queryKey: ["tdee-history", userId],
    queryFn: async () => {
      const uid = await getUserId();
      const { data } = await supabase
        .from("tdee_history")
        .select("created_at,target_calories,weight_kg,tdee")
        .eq("user_id", uid)
        .order("created_at", { ascending: true })
        .limit(30);
      return (data ?? []).map((r: any) => ({
        date: new Date(r.created_at).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" }),
        rawDate: r.created_at as string,
        calories: r.target_calories,
        weight: r.weight_kg,
      }));
    },
  });

  // ── Save to DB ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      const userId = await getUserId();
      const updates = {
        daily_calories_goal:   result.targetCalories,
        training_day_calories: result.trainingCalories,
        daily_protein_goal:    result.protein,
        training_day_protein:  result.trainingProtein,
        daily_carbs_goal:      result.carbs,
        daily_fat_goal:        result.fat,
        daily_water_ml:        result.waterMl,
        height_cm: height,
        weight_kg: weight,
      };
      const { data: existing } = await supabase.from("user_settings").select("id").eq("user_id", userId).maybeSingle();
      if (existing) {
        const { error } = await supabase.from("user_settings").update(updates).eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_settings").insert({ user_id: userId, ...updates });
        if (error) throw error;
      }
      await supabase.from("tdee_history").insert({
        user_id:         userId,
        weight_kg:       weight,
        tdee:            result.tdee,
        target_calories: result.targetCalories,
        protein:         result.protein,
        carbs:           result.carbs,
        fat:             result.fat,
        deficit_kcal:    result.deficitKcal,
      });
    },
    onSuccess: () => {
      toast.success("יעדים עודכנו בהצלחה!");
      qc.invalidateQueries({ queryKey: ["user-settings-tdee", userId] });
      qc.invalidateQueries({ queryKey: ["nutrition-goals"] });
      qc.invalidateQueries({ queryKey: ["tdee-history", userId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "שגיאה בשמירה"),
  });

  // ── AI health analysis (#15) ──
  const analyzeHealth = async () => {
    if (!healthConditions.trim()) return;
    setAnalyzing(true);
    try {
      const raw = await generateText(`
User TDEE: ${result.tdee} kcal/day. Health conditions: "${healthConditions}".
Based on established clinical nutrition guidelines, should their daily caloric target be adjusted?
Respond ONLY as valid JSON (no markdown): { "adjustment_kcal": <integer from -300 to 300>, "note": "<Hebrew explanation, max 25 words>" }
If conditions are not nutrition-relevant or you are unsure, return adjustment_kcal: 0.
`);
      const parsed = parseAIJson<{ adjustment_kcal: number; note: string }>(raw);
      setHealthAdjustment(parsed?.adjustment_kcal ?? 0);
      setHealthNote(parsed?.note ?? "");
      toast.success("ניתוח הושלם");
    } catch {
      toast.error("לא ניתן לנתח — נסה שוב");
    } finally {
      setAnalyzing(false);
    }
  };

  // ─── Process timeline helpers ─────────────────────────────────────────────
  const processStart   = history.length > 0 ? new Date((history[0] as any).rawDate as string) : null;
  const processEnd     = targetDate ? new Date(targetDate) : null;
  const daysElapsed    = processStart ? Math.max(0, Math.floor((Date.now() - processStart.getTime()) / 86_400_000)) : 0;
  const totalDays      = processStart && processEnd ? Math.max(1, Math.round((processEnd.getTime() - processStart.getTime()) / 86_400_000)) : null;
  const progressPct    = totalDays ? Math.min(100, Math.max(0, Math.round((daysElapsed / totalDays) * 100))) : null;
  const daysLeft       = totalDays ? Math.max(0, totalDays - daysElapsed) : null;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="px-4 pt-4 space-y-5 pb-4">

      {/* ══ PROCESS TIMELINE ══════════════════════════════════════════════════ */}
      {processStart && (
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🛤️</span>
            <div>
              <p className="text-sm font-black text-white">מסלול התהליך</p>
              <p className="text-[10px] text-white/40">
                {processEnd ? `${totalDays} ימים סה״כ · ${progressPct}% הושלם` : "קבע תאריך יעד לסרגל מלא"}
              </p>
            </div>
          </div>

          {/* Progress bar track */}
          <div className="space-y-2.5">
            <div className="relative h-4 rounded-full bg-white/10 overflow-visible">
              {/* Filled portion */}
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-700"
                style={{ width: processEnd ? `${progressPct}%` : "100%" }}
              />
              {/* "Now" dot */}
              <div
                className="absolute top-1/2 w-5 h-5 rounded-full bg-white border-2 border-emerald-400 shadow-lg shadow-emerald-500/60 z-10"
                style={{
                  left: processEnd ? `${progressPct}%` : "100%",
                  transform: "translateX(-50%) translateY(-50%)",
                }}
              >
                <div className="absolute inset-0.5 rounded-full bg-emerald-400" />
              </div>
            </div>

            {/* Date labels */}
            <div className="flex justify-between items-start text-[10px]">
              <div>
                <p className="text-white/50 font-bold">התחלה</p>
                <p className="text-white/30">
                  {processStart.toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "2-digit" })}
                </p>
              </div>
              <div className="text-center">
                <p className="text-emerald-300 font-black text-xs">עכשיו</p>
                <p className="text-emerald-400/70">יום {daysElapsed + 1}</p>
              </div>
              {processEnd ? (
                <div className="text-start">
                  <p className="text-white/50 font-bold">סיום</p>
                  <p className="text-white/30">
                    {processEnd.toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "2-digit" })}
                  </p>
                </div>
              ) : (
                <div className="text-start opacity-40">
                  <p className="text-white/40">יעד?</p>
                </div>
              )}
            </div>
          </div>

          {/* Stats chips */}
          <div className={`grid gap-2 text-center ${totalDays ? "grid-cols-3" : "grid-cols-2"}`}>
            <div className="rounded-xl bg-white/5 border border-white/8 p-2.5">
              <p className="text-sm font-black text-white">{daysElapsed + 1}</p>
              <p className="text-[9px] text-white/40">ימים בתהליך</p>
            </div>
            {totalDays && progressPct !== null && (
              <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-2.5">
                <p className="text-sm font-black text-emerald-300">{progressPct}%</p>
                <p className="text-[9px] text-white/40">הושלם</p>
              </div>
            )}
            {daysLeft !== null ? (
              <div className="rounded-xl bg-white/5 border border-white/8 p-2.5">
                <p className="text-sm font-black text-white">{daysLeft}</p>
                <p className="text-[9px] text-white/40">ימים נותרו</p>
              </div>
            ) : (
              <div className="rounded-xl bg-white/5 border border-white/8 p-2.5">
                <p className="text-sm font-black text-white">{history.length}</p>
                <p className="text-[9px] text-white/40">עדכוני יעדים</p>
              </div>
            )}
          </div>

          {/* Target date picker inline in timeline */}
          <div className="space-y-2 pt-1 border-t border-white/8">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">תאריך יעד</label>
              {targetDate && (
                <button onClick={() => setTargetDate("")}
                  className="text-[10px] text-white/30 hover:text-white/60 transition-colors px-1.5 py-0.5 rounded-lg hover:bg-white/5">
                  ✕ נקה
                </button>
              )}
            </div>
            <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
              className={inputCls} dir="ltr" />

            {/* Scenario suggestions — tap to apply */}
            {result.scenarios.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-white/30">
                  {targetDate ? "תאריכים חלופיים מומלצים:" : "תאריכים מומלצים — לחץ להגדרה:"}
                </p>
                <div className="flex gap-1.5">
                  {result.scenarios.map((s) => {
                    const isoDate = localDateStr(new Date(Date.now() + s.weeks * 7 * 86_400_000));
                    const isActive = targetDate === isoDate ||
                      (!targetDate && (
                        (s.delta === 250 && deficitLevel === "mild") ||
                        (s.delta === 500 && deficitLevel === "moderate") ||
                        (s.delta === 750 && deficitLevel === "aggressive")
                      ));
                    return (
                      <button key={s.label} onClick={() => setTargetDate(isoDate)}
                        className={`flex-1 rounded-xl py-2 px-1 text-center border transition-all ${
                          isActive
                            ? "border-emerald-500/60 bg-emerald-500/15"
                            : "border-white/10 bg-white/5 hover:border-white/20"
                        }`}>
                        <p className="text-[9px] text-white/50 mb-0.5">{s.label}</p>
                        <p className={`text-xs font-black ${isActive ? "text-emerald-300" : "text-white/70"}`}>
                          {s.weeks} שב׳
                        </p>
                        <p className="text-[8px] text-white/30 mt-0.5 leading-tight">{s.targetDate}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Prompt to set target weight if no scenarios available */}
            {result.scenarios.length === 0 && goal !== "maintain" && (
              <p className="text-[10px] text-white/30 text-center py-1">
                הגדר משקל יעד בטופס למטה כדי לראות תאריכים מומלצים
              </p>
            )}
          </div>
        </div>
      )}

      {/* ══ TDEE CALCULATOR CARD ═════════════════════════════════════════════ */}
      <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🔬</span>
          <div>
            <p className="text-sm font-black text-white">מחשבון TDEE מדויק</p>
            <p className="text-[10px] text-white/40">Mifflin-St Jeor + NEAT + צעדים + מסה רזה</p>
          </div>
        </div>

        {/* Sex */}
        <GlassField label="מגדר">
          <ToggleChips
            options={[{ key: "male" as Sex, label: "זכר 👨" }, { key: "female" as Sex, label: "נקבה 👩" }]}
            value={sex} onChange={setSex}
          />
        </GlassField>

        {/* Age / Height / Weight */}
        <div className="grid grid-cols-3 gap-3">
          <GlassField label="גיל">
            <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} value={age}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").replace(/^0+(\d)/, "$1");
                if (digits === "" || (Number(digits) > 0 && Number(digits) < 100))
                  setAge(digits === "" ? 0 : Number(digits));
              }}
              className={inputCls} dir="ltr" />
          </GlassField>
          <GlassField label='גובה (ס"מ)'>
            <input type="number" value={height} onChange={(e) => setHeight(+e.target.value)} className={inputCls} dir="ltr" />
          </GlassField>
          <GlassField label='משקל (ק"ג)'>
            <input type="number" value={weight} onChange={(e) => setWeight(+e.target.value)} className={inputCls} dir="ltr" />
          </GlassField>
        </div>

        {/* Activity */}
        <GlassField label="רמת פעילות גופנית">
          <select value={activity} onChange={(e) => setActivity(e.target.value as ActivityLevel)} className={selectCls}>
            {(Object.keys(ACTIVITY_MULTIPLIER) as ActivityLevel[]).map((k) => (
              <option key={k} value={k}>{ACTIVITY_LABELS[k]}</option>
            ))}
          </select>
        </GlassField>

        {/* Steps (#12) */}
        <GlassField label="צעדים יומיים ממוצעים">
          <div className="space-y-2">
            <div className="flex gap-1.5">
              {[0, 5000, 8000, 10000, 15000].map((s) => (
                <button key={s} onClick={() => setSteps(s)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                    steps === s
                      ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-300"
                      : "border-white/10 bg-white/5 text-white/40"
                  }`}>
                  {s === 0 ? "0" : `${s / 1000}k`}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input type="number" value={steps === 0 ? "" : steps} step={500} min={0} max={30000}
                placeholder="0"
                onChange={(e) => setSteps(e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value) || 0))}
                className={inputCls} dir="ltr" />
              {result.stepCalories > 0 && (
                <span className="text-[11px] text-emerald-300 font-bold shrink-0 whitespace-nowrap">
                  ≈ {result.stepCalories} קל׳ ביום
                </span>
              )}
            </div>
          </div>
        </GlassField>

        {/* Work style / NEAT (#5) */}
        <GlassField label="סגנון עבודה / NEAT">
          <ToggleChips
            options={(["desk", "standing", "physical"] as WorkStyle[]).map((k) => ({
              key: k, label: WORK_STYLE_LABELS[k],
            }))}
            value={workStyle} onChange={setWorkStyle}
          />
          <p className="text-[10px] text-white/30 text-center mt-1">
            ישיבתי +0 · עמידה +300 · פיזי +600 קל׳ ליום
          </p>
        </GlassField>

        {/* Goal */}
        <GlassField label="מטרה">
          <ToggleChips
            options={(["lose", "maintain", "gain"] as Goal[]).map((g) => ({
              key: g, label: GOAL_LABELS[g],
            }))}
            value={goal} onChange={setGoal}
          />
        </GlassField>

        {/* Deficit precision (#7) — hidden for maintain */}
        {goal !== "maintain" && (
          <GlassField label={goal === "lose" ? "עוצמת גרעון" : "עוצמת עודף"}>
            <ToggleChips
              options={(["mild", "moderate", "aggressive"] as DeficitLevel[]).map((d) => ({
                key: d, label: DEFICIT_LABELS[goal][d],
              }))}
              value={deficitLevel} onChange={setDeficitLevel}
            />
          </GlassField>
        )}

        {/* Goal timeline (#3) — shown when goal ≠ maintain */}
        {goal !== "maintain" && (
          <GlassField label="יעד כמותי עם לוח זמנים (אופציונלי)">
            <div className="grid grid-cols-2 gap-2">
              <input type="number" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)}
                placeholder={`משקל יעד (ק"ג)`}
                className={inputCls} dir="ltr" />
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
                className={inputCls} dir="ltr" />
            </div>
            {targetWeight && targetDate && (() => {
              const daysUntil = Math.max(1, Math.round((new Date(targetDate).getTime() - Date.now()) / 86_400_000));
              const kgDelta = weight - parseFloat(targetWeight);
              const reqDelta = Math.round((kgDelta * 7700) / daysUntil);
              const weeksAtCurrent = result.deficitKcal !== 0
                ? Math.ceil(Math.abs(kgDelta) * 7700 / (Math.abs(result.deficitKcal) * 7))
                : null;
              return (
                <p className="text-[11px] text-white/50 mt-1 leading-relaxed">
                  נדרש:{" "}
                  <span className="text-white font-bold">{Math.abs(reqDelta)} קל׳</span>{" "}
                  {reqDelta > 0 ? "גרעון" : "עודף"} ליום
                  {weeksAtCurrent && (
                    <>{" · "}בקצב הנוכחי:{" "}
                      <span className="text-emerald-300 font-bold">{weeksAtCurrent} שבועות</span>
                    </>
                  )}
                </p>
              );
            })()}
          </GlassField>
        )}

        {/* Macro preset (#18) */}
        <GlassField label="יחס מאקרו">
          <ToggleChips
            options={(["auto", "bulk", "cut", "cardio"] as MacroPreset[]).map((m) => ({
              key: m, label: MACRO_PRESET_LABELS[m],
            }))}
            value={macroPreset} onChange={setMacroPreset}
          />
        </GlassField>

        {/* Health conditions (#15) */}
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <button
            onClick={() => setHealthOpen((o) => !o)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-xs text-white/60 font-bold hover:text-white/80 transition-colors"
          >
            <span>🩺 מצבים בריאותיים / בעיות רפואיות (אופציונלי)</span>
            {healthOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {healthOpen && (
            <div className="px-3 pb-3 space-y-2">
              <textarea
                value={healthConditions}
                onChange={(e) => setHealthConditions(e.target.value)}
                placeholder="לדוגמה: תת-פעילות בלוטת תריס, סוכרת סוג 2, PCOS, כולסטרול גבוה..."
                rows={3}
                className="w-full rounded-xl bg-white/8 border border-white/15 text-white px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/60 placeholder:text-white/25 resize-none"
              />
              <button
                onClick={analyzeHealth}
                disabled={analyzing || !healthConditions.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
              >
                {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                נתח עם AI
              </button>
              {healthNote && (
                <div className={`rounded-xl px-3 py-2 text-xs font-medium border ${
                  healthAdjustment > 0
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : healthAdjustment < 0
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                      : "bg-white/5 border-white/15 text-white/60"
                }`}>
                  {healthAdjustment !== 0 && (
                    <span className="font-black">
                      {healthAdjustment > 0 ? "+" : ""}{healthAdjustment} קל׳ ·{" "}
                    </span>
                  )}
                  {healthNote}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Safety warnings (#17) */}
        {result.warnings.length > 0 && (
          <div className="space-y-1.5">
            {result.warnings.map((w, i) => (
              <div key={i} className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-300 font-medium">
                {w}
              </div>
            ))}
          </div>
        )}

        {/* Results panel */}
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-4 space-y-3">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-black text-emerald-400">היעדים המחושבים שלך</span>
          </div>

          {/* Big calories row */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "קלוריות יום רגיל",  value: `${result.targetCalories.toLocaleString()} קל׳` },
              { label: "קלוריות יום אימון", value: `${result.trainingCalories.toLocaleString()} קל׳` },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-white/8 border border-white/10 p-3 text-center">
                <p className="text-[10px] text-white/40 mb-1">{s.label}</p>
                <p className="text-lg font-black text-emerald-300">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Macros row */}
          <div className="grid grid-cols-4 gap-1.5 text-center">
            {[
              { label: "חלבון",   value: `${result.protein}g` },
              { label: "פחמימות", value: `${result.carbs}g` },
              { label: "שומן",    value: `${result.fat}g` },
              { label: "מים",     value: `${(result.waterMl / 1000).toFixed(1)}L` },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-white/5 border border-white/8 p-2">
                <p className="text-[9px] text-white/40">{s.label}</p>
                <p className="text-sm font-black text-white/90">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Training protein */}
          <div className="flex justify-center">
            <span className="text-[10px] text-white/30">
              חלבון אימון: <span className="text-white/50 font-bold">{result.trainingProtein}g</span>
            </span>
          </div>

          {/* Breakdown line */}
          <div className="rounded-xl bg-white/4 border border-white/8 px-3 py-2 space-y-1">
            <div className="flex justify-between text-[10px] text-white/30">
              <span>BMR: {result.bmr} קל׳</span>
              <span>TDEE: {result.tdee} קל׳</span>
              <span>BMI: {result.bmi}</span>
            </div>
            <div className="flex justify-between text-[10px] text-white/30">
              <span>מסה רזה: <span className="text-white/50 font-bold">{result.leanMassKg}kg</span></span>
              {(result.stepCalories > 0 || result.neatOffset > 0) && (
                <span>NEAT+צעדים: <span className="text-emerald-400/70 font-bold">+{result.stepCalories + result.neatOffset} קל׳</span></span>
              )}
              <span>שינוי: <span className="text-white/50 font-bold">{result.deficitKcal > 0 ? "+" : ""}{result.deficitKcal} קל׳</span></span>
            </div>
          </div>
        </div>

        {/* 3-Scenario predictor (#20) — only when target weight is set */}
        {result.scenarios.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">תחזית קצב השינוי</p>
            <div className="grid grid-cols-3 gap-2">
              {result.scenarios.map((s) => {
                const isActive =
                  (s.delta === 250 && deficitLevel === "mild") ||
                  (s.delta === 500 && deficitLevel === "moderate") ||
                  (s.delta === 750 && deficitLevel === "aggressive");
                return (
                  <div key={s.label}
                    className={`rounded-xl p-2.5 text-center border transition-all ${
                      isActive
                        ? "border-emerald-500/60 bg-emerald-500/15"
                        : "border-white/10 bg-white/5"
                    }`}>
                    <p className="text-[10px] font-bold text-white/60 mb-1">{s.label}</p>
                    <p className={`text-base font-black ${isActive ? "text-emerald-300" : "text-white/80"}`}>
                      {s.weeks}
                    </p>
                    <p className="text-[9px] text-white/30">שבועות</p>
                    <p className="text-[9px] text-white/40 mt-0.5">{s.targetDate}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Save button */}
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 text-white font-black text-sm hover:bg-emerald-400 active:scale-[0.98] transition-all disabled:opacity-50 min-h-[44px]">
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "שומר..." : "החל יעדים → Tab 1"}
        </button>
      </div>

      {/* ══ HISTORY GRAPH (#19) ══════════════════════════════════════════════ */}
      {history.length >= 2 && (
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-base">📈</span>
            <p className="text-sm font-black text-white">היסטוריית קלוריות</p>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: "rgba(255,255,255,0.5)" }}
                itemStyle={{ color: "#6ee7b7" }}
              />
              <Line type="monotone" dataKey="calories" stroke="#6ee7b7" strokeWidth={2} dot={{ r: 3, fill: "#6ee7b7" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

    </div>
  );
}
