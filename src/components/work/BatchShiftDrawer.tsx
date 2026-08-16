import { useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { AddItemDrawer } from "@/components/shared/AddItemDrawer";
import { SHIFT_LABELS, SHIFT_HOURS } from "@/lib/payroll-engine";
import { useBatchAddShifts } from "@/hooks/use-work-data";
import { X } from "lucide-react";
import { haptics } from "@/lib/haptics";

type WorkRole = "guard" | "shift_manager" | "achmash";

const ROLE_LABELS: Record<WorkRole, string> = {
  guard: "מאבטח רגיל",
  shift_manager: "אחראי משמרת",
  achmash: 'אחמ"ש',
};

const SHIFT_TYPE_KEYS = Object.keys(SHIFT_LABELS).filter(k => k !== "manual_hourly");

interface BatchShiftDrawerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function BatchShiftDrawer({ open, onOpenChange }: BatchShiftDrawerProps) {
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [shiftType, setShiftType] = useState("morning");
  const [role, setRole] = useState<WorkRole>("guard");
  const [isShabbat, setIsShabbat] = useState(false);
  const [hasBriefing, setHasBriefing] = useState(false);

  const batchAdd = useBatchAddShifts();

  const handleSelect = (days: Date[] | undefined) => {
    setSelectedDates(days ?? []);
  };

  const handleRemoveDate = (date: Date) => {
    setSelectedDates(prev => prev.filter(d => d.getTime() !== date.getTime()));
  };

  const toLocalDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const handleSubmit = () => {
    if (selectedDates.length === 0) return;
    const shifts = selectedDates.map(date => ({
      date: toLocalDateStr(date),
      type: shiftType,
      role,
      is_shabbat_holiday: isShabbat,
      has_briefing: hasBriefing,
      hours: SHIFT_HOURS[shiftType] ?? 8,
    }));
    batchAdd.mutate(shifts, {
      onSuccess: () => {
        haptics.success();
        setSelectedDates([]);
        setShiftType("morning");
        setRole("guard");
        setIsShabbat(false);
        setHasBriefing(false);
        onOpenChange(false);
      },
    });
  };

  const formatDate = (d: Date) =>
    d.toLocaleDateString("he-IL", { day: "numeric", month: "short" });

  return (
    <AddItemDrawer open={open} onClose={() => onOpenChange(false)} title="הוסף משמרות מרובות 📅">
      <div className="space-y-4">
        {/* Calendar */}
        <div className="flex justify-center" dir="ltr">
          <DayPicker
            mode="multiple"
            selected={selectedDates}
            onSelect={handleSelect}
            className="rounded-xl border border-border bg-card p-2"
          />
        </div>

        {/* Selected date chips */}
        {selectedDates.length > 0 && (
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              תאריכים נבחרים ({selectedDates.length})
            </label>
            <div className="flex flex-wrap gap-2">
              {selectedDates
                .slice()
                .sort((a, b) => a.getTime() - b.getTime())
                .map((d) => (
                  <span
                    key={d.getTime()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-work/15 text-work border border-work/30"
                  >
                    {formatDate(d)}
                    <button
                      onClick={() => handleRemoveDate(d)}
                      className="hover:text-red-400 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
            </div>
          </div>
        )}

        {/* Shift type selector */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-2 block">סוג משמרת</label>
          <div className="grid grid-cols-2 gap-2">
            {SHIFT_TYPE_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => setShiftType(key)}
                className={`px-3 py-2.5 rounded-xl border transition-colors text-xs font-medium min-h-[44px] ${
                  shiftType === key
                    ? "border-work bg-work/10 text-work"
                    : "border-border bg-card hover:bg-secondary/40 text-foreground"
                }`}
              >
                {SHIFT_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        {/* Role selector */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-2 block">תפקיד</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(ROLE_LABELS) as WorkRole[]).map((key) => (
              <button
                key={key}
                onClick={() => setRole(key)}
                className={`px-3 py-2.5 rounded-xl border transition-colors text-xs font-medium min-h-[44px] ${
                  role === key
                    ? "border-work bg-work/10 text-work"
                    : "border-border bg-card hover:bg-secondary/40 text-foreground"
                }`}
              >
                {ROLE_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        {/* Shabbat / holiday checkbox */}
        <label className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-card cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            checked={isShabbat}
            onChange={(e) => setIsShabbat(e.target.checked)}
            className="accent-work h-4 w-4"
          />
          <span className="text-sm font-medium">שבת / חג</span>
        </label>

        <label className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-card cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            checked={hasBriefing}
            onChange={(e) => setHasBriefing(e.target.checked)}
            className="accent-work h-4 w-4"
          />
          <span className="text-sm font-medium">תדרוך</span>
        </label>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={batchAdd.isPending || selectedDates.length === 0}
          className="w-full py-3 rounded-xl bg-work text-work-foreground font-bold text-sm hover:opacity-90 transition-opacity min-h-[44px] disabled:opacity-50"
        >
          {batchAdd.isPending
            ? "שומר..."
            : `הוסף ${selectedDates.length} משמרות`}
        </button>
      </div>
    </AddItemDrawer>
  );
}
