import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  Camera, ImageIcon, PenLine, Pencil, Droplets, Check, X as XIcon,
  X, Plus, UtensilsCrossed, Loader2, Trash2,
} from "lucide-react";
import {
  useNutritionEntries, useUserSettings, useWaterEntry,
  useAddWaterMl, useUpsertWater, useDeleteNutrition,
} from "@/hooks/use-sport-data";
import { AddMealDrawer } from "@/components/nutrition/AddMealDrawer";
import { NutritionPlannerTab } from "@/components/nutrition/NutritionPlannerTab";
import { NutritionJournalTab } from "@/components/nutrition/NutritionJournalTab";
import { NutritionCulinaryTab } from "@/components/nutrition/NutritionCulinaryTab";
import { NutritionWeeklySummary } from "@/components/nutrition/NutritionWeeklySummary";
import { NutritionWeeklyMealPlan } from "@/components/nutrition/NutritionWeeklyMealPlan";
import { FavoriteMealsQuickAdd } from "@/components/nutrition/FavoriteMealsQuickAdd";
import { recognizeMeal, type MealRecognitionResult } from "@/lib/ai-service";
import { compressImageToBase64 } from "@/lib/image-utils";
import { AIConfirmationCard } from "@/components/nutrition/AIConfirmationCard";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/nutrition")({
  component: NutritionPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = "dashboard" | "planner" | "journal" | "culinary" | "weekly";

const TABS: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "מסך ראשי"  },
  { key: "culinary",  label: "מתכונים"   },
  { key: "planner",   label: "מחשבון AI" },
  { key: "weekly",    label: "תפריט שבועי" },
  { key: "journal",   label: "היסטוריה"  },
];

// ─── SVG Ring ─────────────────────────────────────────────────────────────────
function Ring({
  value, max, color, size, stroke, children,
}: {
  value: number; max: number; color: string;
  size: number; stroke: number; children: React.ReactNode;
}) {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct  = max > 0 ? Math.min(value / max, 1) : 0;
  const dash = pct * circ;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* track */}
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        {/* progress */}
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 0.7s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        {children}
      </div>
    </div>
  );
}

// ─── Floating Action Button ───────────────────────────────────────────────────
function QuickAddFAB({
  onCamera,
  onGallery,
  onManual,
}: {
  onCamera:  () => void;
  onGallery: () => void;
  onManual:  () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const options = [
    {
      icon: Camera,    label: "צלם עכשיו",   color: "#a855f7",
      action: () => { onCamera();  setExpanded(false); },
    },
    {
      icon: ImageIcon, label: "בחר מגלריה",  color: "#3b82f6",
      action: () => { onGallery(); setExpanded(false); },
    },
    {
      icon: PenLine,   label: "הזנה ידנית",  color: "#10b981",
      action: () => { onManual();  setExpanded(false); },
    },
  ];

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2.5">
      {expanded && (
        <div className="flex flex-col items-center gap-2 mb-1">
          {options.map((opt, i) => (
            <button
              key={i}
              onClick={opt.action}
              className="flex items-center gap-3 px-5 py-2.5 rounded-2xl text-white text-sm font-bold shadow-2xl backdrop-blur-xl border border-white/15"
              style={{
                background: opt.color + "e0",
                animation: `fabSlideUp 0.18s ease ${i * 45}ms both`,
              }}
            >
              <opt.icon className="h-4 w-4" />
              {opt.label}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        className={`h-14 w-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ${
          expanded
            ? "bg-white/15 backdrop-blur-xl border border-white/25 rotate-45"
            : "bg-emerald-500 hover:bg-emerald-400 active:scale-95"
        }`}
      >
        {expanded ? <X className="h-6 w-6 text-white" /> : <Plus className="h-7 w-7 text-white" />}
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function NutritionPage() {
  const [activeTab,     setActiveTab]     = useState<Tab>("dashboard");
  const [addMealOpen,   setAddMealOpen]   = useState(false);
  const [waterEditMode, setWaterEditMode] = useState(false);
  const [waterInputVal, setWaterInputVal] = useState("");

  // ── AI Vision state ──
  const cameraFileRef                   = useRef<HTMLInputElement>(null);
  const galleryFileRef                  = useRef<HTMLInputElement>(null);
  const [aiScanning,  setAiScanning]    = useState(false);
  const [aiResult,    setAiResult]      = useState<MealRecognitionResult | null>(null);
  const [prefill,     setPrefill]       = useState<{
    name?: string; calories?: number; protein?: number; carbs?: number; fat?: number;
  }>({});

  // ── Data hooks ──
  const { data: meals    } = useNutritionEntries();
  const { data: settings } = useUserSettings();
  const { data: waterEntry } = useWaterEntry();
  const addWaterMl  = useAddWaterMl();
  const upsertWater = useUpsertWater();
  const deleteMeal  = useDeleteNutrition();
  const [showAllMeals, setShowAllMeals] = useState(false);

  const handleDeleteMeal = (id: string) => {
    deleteMeal.mutate(id, {
      onSuccess: () => toast.success("ארוחה נמחקה"),
      onError:   () => toast.error("שגיאה במחיקה"),
    });
  };

  const handleWaterManualSave = () => {
    const ml = Math.round(Number(waterInputVal));
    if (isNaN(ml) || ml < 0) return;
    upsertWater.mutate(
      { glasses: ml },
      {
        onSuccess: () => { setWaterEditMode(false); setWaterInputVal(""); },
        onError:   (e) => toast.error("שגיאה: " + (e as Error).message),
      }
    );
  };

  // ── Macro totals ──
  const foodMeals = (meals ?? []).filter((m: any) => m.meal_type !== "exercise");
  const foodCal   = foodMeals.reduce((s, m) => s + (m.calories ?? 0), 0);
  // burnedCal kept for reference but no longer subtracted from netCal
  const _burnedCal = (meals ?? []).filter((m: any) => m.meal_type === "exercise").reduce((s, m) => s + (m.calories ?? 0), 0);
  const netCal    = foodCal;
  const totalProt = foodMeals.reduce((s, m) => s + (Number(m.protein_g) || 0), 0);
  const totalCarb = foodMeals.reduce((s, m) => s + (Number(m.carbs_g)   || 0), 0);
  const totalFat  = foodMeals.reduce((s, m) => s + (Number(m.fat_g)     || 0), 0);

  // ── Water: glasses field now stores ml directly ──
  const totalWaterMl = waterEntry?.glasses ?? 0;

  // ── Goals — switch on training day ──
  const s = settings as any;
  const calGoal   = s?.daily_calories_goal ?? 2000;
  const protGoal  = s?.daily_protein_goal  ?? 120;
  const carbGoal  = s?.daily_carbs_goal ?? 250;
  const fatGoal   = s?.daily_fat_goal   ?? 65;
  const waterGoal = s?.daily_water_ml   ?? 2500;
  const remaining = calGoal - netCal;

  // ── Water quick-add ──
  const handleAddWater = (ml: number) => {
    addWaterMl.mutate(
      { addMl: ml, currentMl: totalWaterMl },
      { onError: (e) => toast.error("שגיאה: " + (e as Error).message) }
    );
  };

  // ── AI Vision flow: file → compress → recognizeMeal → show confirmation card ──
  const handleAIFile = async (file: File) => {
    setAiScanning(true);
    try {
      const b64    = await compressImageToBase64(file);
      const result = await recognizeMeal(b64);
      setAiResult(result);
    } catch (err: any) {
      toast.error(err?.message ?? "לא הצלחתי לזהות — נסה תמונה ברורה יותר");
    } finally {
      setAiScanning(false);
    }
  };

  // ── "Edit" from confirmation card → transfer to AddMealDrawer ──
  const handleAIEdit = () => {
    if (!aiResult) return;
    setPrefill({
      name:     aiResult.name,
      calories: Math.round(aiResult.calories),
      protein:  Math.round(aiResult.protein_g),
      carbs:    Math.round(aiResult.carbs_g ?? 0),
      fat:      Math.round(aiResult.fat_g   ?? 0),
    });
    setAiResult(null);
    setAddMealOpen(true);
  };

  return (
    <>
      {/* ── Page wrapper: background image lives HERE, not in fixed divs ── */}
      {/* z-index: -2 was hidden behind body bg-color. Now the wrapper      */}
      {/* itself paints the image, directly over the body background.        */}
      <div
        dir="rtl"
        className="-mx-3 md:-mx-6 -mt-3 md:-mt-6 relative bg-cover bg-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=2000&auto=format&fit=crop')`,
          minHeight: '100vh',
        }}
      >
        {/* ── Dark overlay — absolute, sits over the image ── */}
        <div className="absolute inset-0 bg-[#080b12]/42 pointer-events-none" />

        {/* ── All content — relative z-10 so it's above the overlay ── */}
        <div className="relative z-10 pb-32 pt-8">


        {/* ── Glass tab bar — sticky ── */}
        <div className="relative z-10 px-4 py-2 bg-black/25 backdrop-blur-xl">
          <div className="flex gap-1 p-1 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex-1 py-2 px-1 rounded-xl text-[11px] font-bold transition-all duration-200 ${
                  activeTab === t.key
                    ? "bg-emerald-500 text-white shadow-lg"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            TAB 1 — DASHBOARD
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "dashboard" && (
          <div className="px-4 pt-8 space-y-4">

            {/* ── Favorite Meals Quick Add ── */}
            <FavoriteMealsQuickAdd />

            {/* ── Main Macro Glass Panel ── */}
            <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-5">
              <p className="text-[10px] font-bold text-white/40 text-center mb-5 uppercase tracking-widest">
                יעד יומי
              </p>

              {/* Primary — large Calories ring */}
              <div className="flex justify-center mb-4">
                <Ring value={netCal} max={calGoal} color="#10b981" size={170} stroke={14}>
                  <span className="text-3xl font-black text-white leading-none">
                    {Math.round(netCal).toLocaleString("he")}
                  </span>
                  <span className="text-[10px] text-white/40">
                    / {calGoal.toLocaleString("he")} קל׳
                  </span>
                  <span className="text-[9px] font-bold text-emerald-400 mt-0.5">
                    {calGoal > 0 ? Math.round((netCal / calGoal) * 100) : 0}%
                  </span>
                </Ring>
              </div>

              {/* Calorie breakdown: Eaten | Burned | Remaining */}
              <div className="grid grid-cols-3 gap-2 mb-6">
                {/* אכלת */}
                <div className="flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-xl bg-white/5">
                  <span className="text-[10px] text-white/40">אכלת</span>
                  <span className="text-sm font-black text-white">{Math.round(foodCal).toLocaleString("he")}</span>
                  <span className="text-[9px] text-white/30">קל׳</span>
                </div>
                {/* נשרפו — hidden (calories no longer subtracted) */}
                <div className="flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-xl bg-white/5 opacity-0 pointer-events-none select-none" aria-hidden="true">
                  <span className="text-[10px] text-white/40">נשרפו</span>
                  <span className="text-sm font-black text-white/25">—</span>
                  <span className="text-[9px] text-white/20">קל׳</span>
                </div>
                {/* נותרו */}
                <div className={`flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-xl ${
                  remaining >= 0
                    ? "bg-emerald-500/10 border border-emerald-500/20"
                    : "bg-rose-500/10 border border-rose-500/20"
                }`}>
                  <span className={`text-[10px] ${remaining >= 0 ? "text-emerald-400/70" : "text-rose-400/70"}`}>נותרו</span>
                  <span className={`text-sm font-black ${remaining >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {Math.round(Math.abs(remaining)).toLocaleString("he")}
                  </span>
                  <span className={`text-[9px] ${remaining >= 0 ? "text-emerald-400/50" : "text-rose-400/50"}`}>
                    {remaining < 0 ? "חריגה!" : "קל׳"}
                  </span>
                </div>
              </div>

              {/* Secondary — Protein / Carbs / Fat */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: totalProt, max: protGoal, label: "חלבון",   unit: "g", color: "#3b82f6" },
                  { value: totalCarb, max: carbGoal, label: "פחמימות", unit: "g", color: "#f59e0b" },
                  { value: totalFat,  max: fatGoal,  label: "שומן",    unit: "g", color: "#ec4899" },
                ].map((m) => (
                  <div key={m.label} className="flex flex-col items-center gap-1.5">
                    <Ring value={m.value} max={m.max} color={m.color} size={82} stroke={8}>
                      <span className="text-sm font-black text-white">{Math.round(m.value)}</span>
                      <span className="text-[8px] text-white/40">{m.unit}</span>
                    </Ring>
                    <div className="text-center">
                      <p className="text-[11px] font-semibold text-white/70">{m.label}</p>
                      <p className="text-[9px] text-white/30">מ-{m.max}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Water Tracker ── */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-cyan-400" />
                  <span className="text-sm font-bold text-white">מים</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-cyan-400">
                    {(totalWaterMl / 1000).toFixed(2)}L
                  </span>
                  <span className="text-[10px] text-white/30">
                    / {(waterGoal / 1000).toFixed(1)}L
                  </span>
                  {totalWaterMl > 0 && (
                    <button
                      onClick={() => addWaterMl.mutate({ addMl: -totalWaterMl, currentMl: totalWaterMl })}
                      className="text-[9px] text-white/20 hover:text-rose-400 transition-colors"
                    >
                      איפוס
                    </button>
                  )}
                </div>
              </div>

              {/* Segmented progress bar */}
              <div className="relative w-full h-3 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500"
                  style={{ width: `${Math.min((totalWaterMl / waterGoal) * 100, 100)}%` }}
                />
                {/* droplet markers every 500ml */}
                <div className="absolute inset-0 flex">
                  {Array.from({ length: Math.floor(waterGoal / 500) }, (_, i) => (
                    <div key={i} className="flex-1 border-r border-white/10 last:border-0" />
                  ))}
                </div>
              </div>

              {/* Quick-add buttons / manual input */}
              {waterEditMode ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={waterInputVal}
                    onChange={(e) => setWaterInputVal(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => { if (e.key === "Enter") handleWaterManualSave(); if (e.key === "Escape") setWaterEditMode(false); }}
                    placeholder="הזן ml..."
                    className="flex-1 bg-white/8 border border-cyan-500/30 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-cyan-400/60 text-start"
                    autoFocus
                  />
                  <button
                    onClick={handleWaterManualSave}
                    disabled={upsertWater.isPending}
                    className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30 hover:bg-cyan-500/35 transition-colors disabled:opacity-40"
                  >
                    <Check className="h-4 w-4 text-cyan-400" />
                  </button>
                  <button
                    onClick={() => setWaterEditMode(false)}
                    className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                  >
                    <XIcon className="h-4 w-4 text-white/40" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "+500ml", ml: 500  },
                    { label: "+750ml", ml: 750  },
                    { label: "+1.5L",  ml: 1500 },
                  ].map(({ label, ml }) => (
                    <button
                      key={ml}
                      onClick={() => handleAddWater(ml)}
                      disabled={addWaterMl.isPending}
                      className="py-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs font-bold hover:bg-cyan-500/20 active:scale-95 transition-all disabled:opacity-40"
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    onClick={() => { setWaterEditMode(true); setWaterInputVal(String(totalWaterMl)); }}
                    className="py-2 rounded-xl border border-white/20 bg-white/5 text-white/40 hover:text-cyan-400 hover:border-cyan-500/30 hover:bg-cyan-500/10 transition-all flex items-center justify-center"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* ── Today's Meals ── */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-bold text-white">ארוחות היום</span>
                </div>
                <span className="text-[11px] text-white/30">{meals?.length ?? 0} ארוחות</span>
              </div>

              {!meals || meals.length === 0 ? (
                <p className="text-center text-white/25 text-xs py-3">
                  לחץ + להוסיף ארוחה ראשונה
                </p>
              ) : (
                <div className="divide-y divide-white/5">
                  {(showAllMeals ? meals : meals.slice(0, 5)).map((m) => (
                    <div key={m.id} className="flex items-center justify-between py-2 gap-2">
                      <span className="text-sm text-white/90 font-medium truncate min-w-0">
                        {m.name}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] text-white/40 shrink-0">
                        {m.calories  != null && <span>{m.calories}קל׳</span>}
                        {m.protein_g != null && <span>{m.protein_g}g P</span>}
                        <button
                          onClick={() => handleDeleteMeal(m.id)}
                          disabled={deleteMeal.isPending && deleteMeal.variables === m.id}
                          aria-label={`מחק ${m.name}`}
                          className="h-8 w-8 rounded-xl flex items-center justify-center text-white/30 hover:text-rose-400 hover:bg-rose-500/10 transition-all disabled:opacity-40"
                        >
                          {deleteMeal.isPending && deleteMeal.variables === m.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2  className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  ))}
                  {(meals?.length ?? 0) > 5 && (
                    <button
                      onClick={() => setShowAllMeals((v) => !v)}
                      className="w-full text-center text-white/40 text-[10px] pt-2"
                    >
                      {showAllMeals ? "הצג פחות" : `+${meals!.length - 5} ארוחות נוספות`}
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB 2 — AI PLANNER  (Phase 2)
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "planner" && (
          <NutritionPlannerTab />
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB 3 — JOURNAL  (Phase 3)
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "journal" && (
          <div className="space-y-4">
            <NutritionWeeklySummary />
            <NutritionJournalTab />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB 4 — CULINARY AI  (Phase 3)
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "culinary" && (
          <NutritionCulinaryTab />
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB 5 — WEEKLY MEAL PLAN  (Phase 4)
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "weekly" && (
          <NutritionWeeklyMealPlan />
        )}

        </div>{/* end: relative z-10 content */}
      </div>{/* end: bg wrapper */}

      {/* ── Camera input (forces device camera) ── */}
      <input
        ref={cameraFileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleAIFile(f);
          e.target.value = "";
        }}
      />
      {/* ── Gallery input (no capture — opens photo library) ── */}
      <input
        ref={galleryFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleAIFile(f);
          e.target.value = "";
        }}
      />

      {/* ── AI scanning overlay ── */}
      {aiScanning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 text-purple-400 animate-spin" />
            <p className="text-white font-bold text-sm">מזהה ארוחה עם AI...</p>
          </div>
        </div>
      )}

      {/* ── AI Confirmation Card ── */}
      {aiResult && (
        <AIConfirmationCard
          result={aiResult}
          onAdd={()     => setAiResult(null)}
          onEdit={handleAIEdit}
          onDismiss={() => setAiResult(null)}
        />
      )}

      {/* ── FAB — Tab 1 only ── */}
      {activeTab === "dashboard" && (
        <QuickAddFAB
          onCamera={()  => cameraFileRef.current?.click()}
          onGallery={() => galleryFileRef.current?.click()}
          onManual={() => { setPrefill({}); setAddMealOpen(true); }}
        />
      )}

      {/* ── Drawers ── */}
      <AddMealDrawer
        open={addMealOpen}
        onClose={() => { setAddMealOpen(false); setPrefill({}); }}
        prefillName={prefill.name}
        prefillCalories={prefill.calories}
        prefillProtein={prefill.protein}
        prefillCarbs={prefill.carbs}
        prefillFat={prefill.fat}
      />

      {/* ── FAB keyframe animation ── */}
      <style>{`
        @keyframes fabSlideUp {
          from { opacity: 0; transform: translateY(12px) scale(0.92); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
    </>
  );
}
