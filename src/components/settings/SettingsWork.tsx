import { useState, useEffect } from "react";
import { Briefcase, Save, Loader2 } from "lucide-react";
import { usePayrollSettings, useSavePayrollSettings } from "@/hooks/use-work-data";
import { DEFAULT_PAYROLL_SETTINGS, type PayrollSettings } from "@/lib/payroll-engine";
import { toast } from "sonner";
import { haptics } from "@/lib/haptics";

export function SettingsWork() {
  const { data: settings, isLoading } = usePayrollSettings();
  const saveSettings = useSavePayrollSettings();
  const [form, setForm] = useState<PayrollSettings>(DEFAULT_PAYROLL_SETTINGS);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const update = <K extends keyof PayrollSettings>(key: K, value: string) => {
    if (key === "income_sync_mode") {
      setForm((prev) => ({ ...prev, [key]: value as "net" | "bank" }));
    } else {
      setForm((prev) => ({ ...prev, [key]: parseFloat(value) || 0 }));
    }
  };

  const toggleOvertime = (enabled: boolean) => {
    setForm((prev) => ({ ...prev, overtime_enabled: enabled }));
  };

  const handleSave = () => {
    saveSettings.mutate(form, {
      onSuccess: () => { haptics.success(); toast.success("הגדרות עבודה נשמרו"); },
      onError: () => { haptics.error(); toast.error("שגיאה בשמירת הגדרות"); },
    });
  };

  const rateFields: { key: keyof PayrollSettings; label: string; unit: string }[] = [
    { key: "base_hourly_rate",    label: "שכר בסיס (שעתי)",      unit: "₪" },
    { key: "alt_hourly_rate",     label: "שכר אחראי (שעתי)",     unit: "₪" },
    { key: "achmash_hourly_rate", label: "שכר אחמ\"ש (שעתי)",    unit: "₪" },
    { key: "recovery_per_hour",   label: "הבראה לשעה",            unit: "₪" },
    { key: "excellence_per_hour", label: "מצוינות לשעה",          unit: "₪" },
    { key: "shabbat_hourly_rate", label: "שבת לשעה",              unit: "₪" },
    { key: "travel_per_shift",    label: "נסיעות למשמרת",         unit: "₪" },
    { key: "briefing_per_shift",  label: "תדרוך למשמרת",          unit: "₪" },
  ];

  const mandatoryFields: { key: keyof PayrollSettings; label: string }[] = [
    { key: "national_insurance_pct", label: "ביטוח לאומי" },
    { key: "health_insurance_pct",   label: "ביטוח בריאות" },
  ];

  const officeFields: { key: keyof PayrollSettings; label: string; unit: string }[] = [
    { key: "lunch_deduction",          label: "השתתפות ארוחות צהר", unit: "₪" },
    { key: "union_national_deduction", label: "הסתדרות לאומית",     unit: "₪" },
  ];

  const pensionFields: { key: keyof PayrollSettings; label: string }[] = [
    { key: "harel_savings_pct", label: "ניכוי הראל ש'"       },
    { key: "harel_study_pct",   label: "ניכוי הראל קר"       },
    { key: "harel_travel_pct",  label: "ניכוי האל נסיע"      },
    { key: "extra_harel_pct",   label: "ניכוי הראל ש' (נוסף)" },
  ];

  const inputCls = "w-24 rounded-none bg-white/5 border border-white/20 px-3 py-2 text-sm text-white focus:outline-none focus:border-white focus:bg-white/10 min-h-[44px] transition-colors";

  if (isLoading) {
    return (
      <div className="bg-black/50 backdrop-blur-2xl border border-white/10 rounded-none p-4 md:p-5 flex items-center justify-center h-40">
        <Loader2 className="h-5 w-5 text-white/50 animate-spin" />
      </div>
    );
  }

  const SectionRow = ({ label, fieldKey, unit }: { label: string; fieldKey: keyof PayrollSettings; unit: string }) => (
    <div className="flex items-center justify-between gap-3">
      <label className="text-sm text-white/50">{label}</label>
      <div className="flex items-center gap-1.5">
        <input type="number" step="0.01" value={form[fieldKey] as number}
          onChange={(e) => update(fieldKey, e.target.value)}
          className={inputCls} dir="ltr" />
        <span className="text-xs text-white/40 w-6">{unit}</span>
      </div>
    </div>
  );

  return (
    <div className="bg-black/50 backdrop-blur-2xl border border-white/10 rounded-none p-4 md:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Briefcase className="h-4 w-4 text-white/70" />
        <h3 className="text-sm font-semibold text-white uppercase tracking-widest">חוזה עבודה ותעריפים</h3>
      </div>

      <div className="space-y-3">
        <p className="text-xs text-white/40 font-medium uppercase tracking-widest">תעריפים</p>
        {rateFields.map((f) => <SectionRow key={f.key} label={f.label} fieldKey={f.key} unit={f.unit} />)}
      </div>

      <div className="space-y-3 border-t border-white/10 pt-3">
        <p className="text-xs text-white/40 font-medium uppercase tracking-widest">שעות נוספות</p>
        <div className="flex items-center justify-between gap-3">
          <label className="text-sm text-white/50">חישוב אוטומטי (125% / 150%)</label>
          <div className="grid grid-cols-2 gap-2 w-40">
            {([{ value: true, label: "פעיל" }, { value: false, label: "כבוי" }] as const).map((opt) => (
              <button key={String(opt.value)} onClick={() => toggleOvertime(opt.value)}
                className={`px-3 py-2.5 rounded-none border transition-colors text-xs font-semibold min-h-[44px] ${
                  form.overtime_enabled === opt.value
                    ? "bg-white text-black border-white"
                    : "bg-white/5 border-white/20 text-gray-300 hover:bg-white/10 hover:text-white"
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-white/30 leading-relaxed">
          כשפעיל: שעה 9-10 במשמרת מחושבות ב-125% ושעה 11+ ב-150% מהתעריף (כולל תעריף שבת, אם רלוונטי). שבת מזוהה אוטומטית — כל משמרת שחלה בשבת עצמה, וכל משמרת לילה שמתחילה בליל שישי.
        </p>
      </div>

      <div className="space-y-3 border-t border-white/10 pt-3">
        <p className="text-xs text-white/40 font-medium uppercase tracking-widest">ניכויי חובה (%)</p>
        {mandatoryFields.map((f) => <SectionRow key={f.key} label={f.label} fieldKey={f.key} unit="%" />)}
      </div>

      <div className="space-y-3 border-t border-white/10 pt-3">
        <p className="text-xs text-white/40 font-medium uppercase tracking-widest">ניכויי משרד</p>
        {officeFields.map((f) => <SectionRow key={f.key} label={f.label} fieldKey={f.key} unit={f.unit} />)}
      </div>

      <div className="space-y-3 border-t border-white/10 pt-3">
        <p className="text-xs text-white/40 font-medium uppercase tracking-widest">ניכויי חו״ז (%)</p>
        {pensionFields.map((f) => <SectionRow key={f.key} label={f.label} fieldKey={f.key} unit="%" />)}
      </div>

      <div className="space-y-3 border-t border-white/10 pt-3">
        <p className="text-xs text-white/40 font-medium uppercase tracking-widest">סנכרון הכנסה לכלכלה</p>
        <div className="grid grid-cols-2 gap-2">
          {([{ value: "net", label: "נטו" }, { value: "bank", label: "סכום בבנק" }] as const).map((opt) => (
            <button key={opt.value} onClick={() => update("income_sync_mode", opt.value)}
              className={`px-3 py-2.5 rounded-none border transition-colors text-xs font-semibold min-h-[44px] ${
                form.income_sync_mode === opt.value
                  ? "bg-white text-black border-white"
                  : "bg-white/5 border-white/20 text-gray-300 hover:bg-white/10 hover:text-white"
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <button onClick={handleSave} disabled={saveSettings.isPending}
        className="w-full py-3 rounded-none bg-white text-black font-bold text-sm hover:bg-white/90 transition-colors min-h-[44px] flex items-center justify-center gap-2 disabled:opacity-50">
        {saveSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saveSettings.isPending ? "שומר..." : "שמור הגדרות עבודה"}
      </button>
    </div>
  );
}
