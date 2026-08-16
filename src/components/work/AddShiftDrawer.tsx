import { useState, useMemo } from "react";
import { AddItemDrawer } from "@/components/shared/AddItemDrawer";
import { SHIFT_LABELS, SHIFT_HOURS, calcShiftBreakdown, getShiftTimes, DEFAULT_PAYROLL_SETTINGS } from "@/lib/payroll-engine";
import { useAddShift, usePayrollSettings } from "@/hooks/use-work-data";
import { useAddIncome } from "@/hooks/use-finance-data";
import { todayLocalStr } from "@/utils/date";
import { toast } from "sonner";
import { haptics } from "@/lib/haptics";

type ShiftType = 'morning' | 'afternoon' | 'night' | 'long_morning' | 'long_night' | 'briefing' | 'manual_hourly';
type WorkRole = 'guard' | 'shift_manager' | 'achmash';

const ROLE_LABELS: Record<WorkRole, string> = {
  guard: 'מאבטח רגיל',
  shift_manager: 'אחראי משמרת',
  achmash: 'אחמ"ש',
};

interface AddShiftDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function AddShiftDrawer({ open, onClose }: AddShiftDrawerProps) {
  const [shiftType, setShiftType] = useState<ShiftType>("morning");
  const [role, setRole] = useState<WorkRole>("guard");
  const [date, setDate] = useState(todayLocalStr);
  const [isShabbat, setIsShabbat] = useState(false);
  const [hasBriefing, setHasBriefing] = useState(false);
  const [notes, setNotes] = useState("");
  const [showMealQuestion, setShowMealQuestion] = useState(false);
  const [hadMeal, setHadMeal] = useState<boolean | null>(null);
  const [customHours, setCustomHours] = useState<number>(8);

  const addShift = useAddShift();
  const addIncome = useAddIncome();
  const { data: payrollSettings } = usePayrollSettings();

  const settings = payrollSettings ?? DEFAULT_PAYROLL_SETTINGS;
  const previewBreakdown = useMemo(() =>
    shiftType !== "manual_hourly"
      ? calcShiftBreakdown(
          { id: "", date, type: shiftType, role, is_shabbat_holiday: isShabbat, has_briefing: hasBriefing, hours: SHIFT_HOURS[shiftType] || 8, notes: null },
          settings
        )
      : null
  , [shiftType, date, role, isShabbat, hasBriefing, settings]);

  const isMorningShift = shiftType === "long_morning" || shiftType === "morning";

  const handleSave = () => {
    // If morning shift and we haven't asked about meal yet, show question
    if (isMorningShift && hadMeal === null && !showMealQuestion) {
      setShowMealQuestion(true);
      return;
    }

    addShift.mutate(
      {
        date,
        type: shiftType,
        role,
        is_shabbat_holiday: isShabbat,
        has_briefing: hasBriefing,
        hours: shiftType === "manual_hourly" ? customHours : (SHIFT_HOURS[shiftType] || 8),
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          haptics.success();
          // If had meal, add meal voucher income
          if (hadMeal) {
            addIncome.mutate(
              { amount: 68, category: "salary", description: "שובר ארוחה", date, source: "meal_voucher" },
              {
                onError: (err) => {
                  console.error("Meal voucher income error:", err);
                  haptics.error();
                  toast.error("המשמרת נשמרה, אך שובר הארוחה נכשל: " + (err as Error).message);
                },
              }
            );
          }
          toast.success("משמרת נוספה בהצלחה");
          resetForm();
          onClose();
        },
        onError: (err) => {
          haptics.error();
          toast.error("שגיאה בשמירת משמרת: " + (err as Error).message);
        },
      }
    );
  };

  const resetForm = () => {
    setShiftType("morning");
    setRole("guard");
    setIsShabbat(false);
    setHasBriefing(false);
    setNotes("");
    setShowMealQuestion(false);
    setHadMeal(null);
    setCustomHours(8);
  };

  const handleMealAnswer = (answer: boolean) => {
    setHadMeal(answer);
    setShowMealQuestion(false);
  };

  const shiftEntries = (Object.keys(SHIFT_LABELS) as ShiftType[]).map((key) => ({
    key,
    label: key === "manual_hourly" ? "שעות ידניות 📝" : SHIFT_LABELS[key],
    times: getShiftTimes(key, role),
  }));

  return (
    <AddItemDrawer open={open} onClose={onClose} title="הוסף משמרת">
      <div className="space-y-4">
        {/* Meal voucher question overlay */}
        {showMealQuestion && (
          <div className="rounded-xl border-2 border-work bg-work/5 p-4 space-y-3">
            <p className="text-sm font-bold text-center">🍽️ האם הייתה ארוחה במשמרת זו?</p>
            <p className="text-[10px] text-muted-foreground text-center">אם כן, יתווסף שובר ארוחה בסך 68₪</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => handleMealAnswer(true)}
                className="px-3 py-2.5 rounded-xl border-2 border-emerald-500 bg-emerald-500/10 text-emerald-400 text-sm font-bold min-h-[44px]">
                ✓ כן
              </button>
              <button onClick={() => handleMealAnswer(false)}
                className="px-3 py-2.5 rounded-xl border border-border bg-card text-sm font-medium text-muted-foreground min-h-[44px]">
                ✗ לא
              </button>
            </div>
          </div>
        )}

        {/* Show meal status if already answered */}
        {hadMeal !== null && isMorningShift && (
          <div className={`rounded-xl px-3 py-2 text-xs font-medium text-center ${
            hadMeal ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground"
          }`}>
            {hadMeal ? "🍽️ שובר ארוחה +68₪" : "ללא שובר ארוחה"}
            <button onClick={() => { setHadMeal(null); setShowMealQuestion(true); }}
              className="me-2 underline text-[10px]">שנה</button>
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-2 block">סוג משמרת</label>
          <div className="grid grid-cols-2 gap-2">
            {shiftEntries.map((s) => (
              <button key={s.key} onClick={() => { setShiftType(s.key); setHadMeal(null); setShowMealQuestion(false); }}
                className={`px-3 py-2.5 rounded-xl border transition-colors text-xs font-medium min-h-[44px] ${
                  shiftType === s.key ? "border-work bg-work/10 text-work" : "border-border bg-card hover:bg-secondary/40 text-foreground"
                }`}>
                <span>{s.label}</span>
                {s.times && s.key !== "manual_hourly" && (
                  <span className="block text-[10px] text-muted-foreground mt-0.5" dir="ltr">
                    {s.times.start}–{s.times.end}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {shiftType === "manual_hourly" && (
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">כמה שעות עבדת?</label>
            <input
              type="number"
              min={0.5}
              max={24}
              step={0.5}
              value={customHours}
              onChange={(e) => setCustomHours(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:border-work min-h-[44px]"
            />
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-2 block">תפקיד</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(ROLE_LABELS) as WorkRole[]).map((key) => (
              <button key={key} onClick={() => setRole(key)}
                className={`px-3 py-2.5 rounded-xl border transition-colors text-xs font-medium min-h-[44px] ${
                  role === key ? "border-work bg-work/10 text-work" : "border-border bg-card hover:bg-secondary/40 text-foreground"
                }`}>
                {ROLE_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">תאריך</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:border-work min-h-[44px]" />
        </div>

        <div>
          <label className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-card cursor-pointer min-h-[44px]">
            <input type="checkbox" checked={isShabbat} onChange={(e) => setIsShabbat(e.target.checked)} className="accent-work h-4 w-4" />
            <span className="text-sm font-medium">שבת / חג</span>
          </label>
          <p className="text-[11px] text-muted-foreground mt-1 px-1">
            משמרות שחלות בשבת עצמה מזוהות אוטומטית — סמן כאן רק עבור חג, או אם ברצונך לעקוף את הזיהוי האוטומטי.
          </p>
        </div>

        <label className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-card cursor-pointer min-h-[44px]">
          <input type="checkbox" checked={hasBriefing} onChange={(e) => setHasBriefing(e.target.checked)} className="accent-work h-4 w-4" />
          <span className="text-sm font-medium">תדרוך</span>
        </label>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">הערות (אופציונלי)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="הערות נוספות..."
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:border-work resize-none h-16" />
        </div>

        {shiftType !== "manual_hourly" && previewBreakdown && (
          <div className="rounded-xl border border-work/30 bg-work/5 px-4 py-3 space-y-1.5">
            <p className="text-xs font-semibold text-work mb-1">שכר צפוי</p>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>שכר בסיס</span>
              <span>₪{previewBreakdown.basePay.toFixed(0)}</span>
            </div>
            {previewBreakdown.recovery > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>שי</span>
                <span>₪{previewBreakdown.recovery.toFixed(0)}</span>
              </div>
            )}
            {previewBreakdown.excellence > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>מצוינות</span>
                <span>₪{previewBreakdown.excellence.toFixed(0)}</span>
              </div>
            )}
            {previewBreakdown.travel > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>נסיעות</span>
                <span>₪{previewBreakdown.travel.toFixed(0)}</span>
              </div>
            )}
            {previewBreakdown.briefingPay > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>תדרוך</span>
                <span>₪{previewBreakdown.briefingPay.toFixed(0)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-foreground border-t border-border pt-1.5 mt-1">
              <span>סה"כ ברוטו</span>
              <span className="text-work">₪{previewBreakdown.totalGross.toFixed(0)}</span>
            </div>
          </div>
        )}

        <button onClick={handleSave} disabled={addShift.isPending}
          className="w-full py-3 rounded-xl bg-work text-work-foreground font-bold text-sm hover:opacity-90 transition-opacity min-h-[44px] disabled:opacity-50">
          {addShift.isPending ? "שומר..." : "שמור משמרת"}
        </button>
      </div>
    </AddItemDrawer>
  );
}
