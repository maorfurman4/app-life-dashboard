import { localDateStr } from "@/utils/date";
import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

interface ParsedWorkout {
  type: string;
  duration_minutes: number;
  calories_burned?: number;
  date: string;
  notes: string;
}

interface ParsedWeightEntry {
  weight_kg: number;
  date: string;
}

interface ParseResult {
  workouts: ParsedWorkout[];
  weights: ParsedWeightEntry[];
}

function parseAppleHealthXML(xmlText: string): ParseResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const workouts: ParsedWorkout[] = [];
  const weights: ParsedWeightEntry[] = [];

  const workoutEls = doc.querySelectorAll("Workout");
  workoutEls.forEach((el) => {
    const actType = el.getAttribute("workoutActivityType") ?? "";
    const start = el.getAttribute("startDate") ?? "";
    const end = el.getAttribute("endDate") ?? "";
    const cal = el.getAttribute("totalEnergyBurned");
    if (!start) return;
    const durationMs = start && end ? new Date(end).getTime() - new Date(start).getTime() : 0;
    const duration = Math.round(durationMs / 60000);
    const dateStr = start.slice(0, 10);
    workouts.push({
      type: actType.replace("HKWorkoutActivityType", "").toLowerCase(),
      duration_minutes: duration > 0 ? duration : 30,
      calories_burned: cal ? Math.round(parseFloat(cal)) : undefined,
      date: dateStr,
      notes: "ייבוא מ-Apple Health",
    });
  });

  const weightRecords = doc.querySelectorAll('Record[type="HKQuantityTypeIdentifierBodyMass"]');
  weightRecords.forEach((el) => {
    const value = el.getAttribute("value");
    const start = el.getAttribute("startDate");
    if (!value || !start) return;
    weights.push({ weight_kg: parseFloat(value), date: start.slice(0, 10) });
  });

  return { workouts, weights };
}

function parseGoogleFitJSON(jsonText: string): ParseResult {
  const workouts: ParsedWorkout[] = [];
  const weights: ParsedWeightEntry[] = [];

  try {
    const data = JSON.parse(jsonText) as {
      bucket?: {
        dataset?: {
          dataSourceId?: string;
          point?: { startTimeNanos?: string; value?: { fpVal?: number; intVal?: number }[] }[];
        }[];
      }[];
    };

    if (!data.bucket) return { workouts, weights };

    for (const bucket of data.bucket) {
      for (const dataset of bucket.dataset ?? []) {
        const src = dataset.dataSourceId ?? "";
        for (const point of dataset.point ?? []) {
          const tsNs = point.startTimeNanos ? BigInt(point.startTimeNanos) : BigInt(0);
          const date = tsNs > BigInt(0)
            ? localDateStr(new Date(Number(tsNs / BigInt(1000000))))
            : localDateStr();

          if (src.includes("activity.segment")) {
            workouts.push({
              type: "google_fit",
              duration_minutes: 30,
              date,
              notes: "ייבוא מ-Google Fit",
            });
          } else if (src.includes("weight")) {
            const val = point.value?.[0]?.fpVal;
            if (val) weights.push({ weight_kg: val, date });
          }
        }
      }
    }
  } catch {
    // silent
  }

  return { workouts, weights };
}

function parseCSV(csvText: string): ParseResult {
  const workouts: ParsedWorkout[] = [];
  const weights: ParsedWeightEntry[] = [];

  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return { workouts, weights };

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const stepIdx = headers.findIndex((h) => h.includes("step"));
  const calIdx = headers.findIndex((h) => h.includes("cal") || h.includes("energy"));
  const weightIdx = headers.findIndex((h) => h.includes("weight") || h.includes("mass"));
  const dateIdx = headers.findIndex((h) => h.includes("date") || h.includes("time"));
  const durationIdx = headers.findIndex((h) => h.includes("duration") || h.includes("min"));

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const date = dateIdx >= 0 ? (cols[dateIdx] ?? "").slice(0, 10) : localDateStr();

    if (stepIdx >= 0 || calIdx >= 0 || durationIdx >= 0) {
      const cal = calIdx >= 0 ? parseFloat(cols[calIdx]) : undefined;
      const duration = durationIdx >= 0 ? parseFloat(cols[durationIdx]) : 30;
      workouts.push({
        type: "csv_import",
        duration_minutes: isNaN(duration) ? 30 : duration,
        calories_burned: cal && !isNaN(cal) ? Math.round(cal) : undefined,
        date,
        notes: "ייבוא מ-CSV",
      });
    }

    if (weightIdx >= 0) {
      const w = parseFloat(cols[weightIdx]);
      if (!isNaN(w) && w > 0) weights.push({ weight_kg: w, date });
    }
  }

  return { workouts, weights };
}

async function parseFile(file: File): Promise<ParseResult> {
  const text = await file.text();
  const name = file.name.toLowerCase();

  if (name.endsWith(".xml")) return parseAppleHealthXML(text);
  if (name.endsWith(".json")) return parseGoogleFitJSON(text);
  if (name.endsWith(".csv")) return parseCSV(text);
  return { workouts: [], weights: [] };
}

export function HealthImport() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleFile(file: File) {
    setFileName(file.name);
    setDone(false);
    const result = await parseFile(file);
    setParseResult(result);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  async function handleImport() {
    if (!parseResult || !user) return;
    setImporting(true);

    try {
      if (parseResult.workouts.length > 0) {
        const rows = parseResult.workouts.map((w) => ({
          user_id: user.id,
          category: w.type,
          duration_minutes: w.duration_minutes,
          calories_burned: w.calories_burned ?? null,
          date: w.date,
          notes: w.notes,
        }));

        const { error } = await supabase.from("workouts").insert(rows);
        if (error) throw error;
      }

      if (parseResult.weights.length > 0) {
        const { error: testError } = await supabase
          .from("weight_logs" as "workouts")
          .select("id")
          .limit(1);

        if (testError) {
          console.log("weight_logs table not available — skipping weight import");
          toast.info("ייבוא משקל אינו זמין");
        } else {
          const weightRows = parseResult.weights.map((w) => ({
            user_id: user.id,
            weight_kg: w.weight_kg,
            date: w.date,
          }));
          await (supabase as ReturnType<typeof supabase.from> & { from: (t: string) => ReturnType<typeof supabase.from> })
            .from("weight_logs")
            .insert(weightRows);
        }
      }

      toast.success(`יובאו ${parseResult.workouts.length} אימונים בהצלחה ✅`);
      setDone(true);
    } catch (e) {
      toast.error("שגיאה בייבוא: " + (e as Error).message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="px-4 py-6 space-y-4"
      dir="rtl"
    >
      <div>
        <h2 className="text-lg font-black text-white mb-1">ייבוא בריאות</h2>
        <p className="text-xs text-white/50">ייבא נתונים מ-Apple Health, Google Fit, או CSV</p>
      </div>

      <motion.div
        onDragOver={(e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        animate={{ borderColor: dragging ? "rgba(16,185,129,0.8)" : "rgba(255,255,255,0.15)" }}
        className="rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all"
        style={{
          background: dragging ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.05)",
          border: "2px dashed rgba(255,255,255,0.15)",
        }}
      >
        <Upload className="h-8 w-8 text-white/40" />
        <p className="text-sm font-bold text-white/70 text-center">
          גרור קובץ לכאן או לחץ לבחירה
        </p>
        <p className="text-xs text-white/35 text-center">
          .xml (Apple Health) · .json (Google Fit) · .csv
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xml,.json,.csv"
          className="hidden"
          onChange={onFileChange}
        />
      </motion.div>

      <AnimatePresence>
        {parseResult && fileName && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl p-4 space-y-3"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-bold text-white/70">{fileName}</span>
            </div>

            <div className="flex gap-4">
              <div className="flex-1 rounded-xl p-3 text-center" style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <p className="text-2xl font-black text-emerald-400">{parseResult.workouts.length}</p>
                <p className="text-[10px] text-white/50 mt-0.5">אימונים</p>
              </div>
              <div className="flex-1 rounded-xl p-3 text-center" style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.2)" }}>
                <p className="text-2xl font-black text-blue-400">{parseResult.weights.length}</p>
                <p className="text-[10px] text-white/50 mt-0.5">מדידות משקל</p>
              </div>
            </div>

            <p className="text-xs text-white/50">
              נמצאו {parseResult.workouts.length} אימונים, {parseResult.weights.length} מדידות משקל
            </p>

            {done ? (
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-bold">יובא בהצלחה!</span>
              </div>
            ) : parseResult.workouts.length === 0 && parseResult.weights.length === 0 ? (
              <div className="flex items-center gap-2 text-amber-400">
                <AlertCircle className="h-4 w-4" />
                <span className="text-xs">לא נמצאו נתונים לייבוא בקובץ זה</span>
              </div>
            ) : (
              <button
                onClick={handleImport}
                disabled={importing}
                className="w-full py-3 rounded-xl font-black text-sm transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: "#10b981", color: "white" }}
              >
                {importing ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    מייבא...
                  </span>
                ) : (
                  "ייבא"
                )}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
