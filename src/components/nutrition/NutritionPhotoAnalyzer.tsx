import { localDateStr } from "@/utils/date";
import { useState, useRef } from "react";
import { ScanSearch, Loader2, AlertTriangle, FolderOpen, Star, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAddNutrition, useAddFavoriteMeal } from "@/hooks/use-sport-data";
import { detectRedLabels, redLabelColor } from "@/lib/red-labels";
import { recognizeMeal } from "@/lib/ai-service";
import { compressImageToBase64 } from "@/lib/image-utils";
import { toast } from "sonner";

interface FoodAnalysis {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  red_labels: string[];
}

async function analyzeFood(base64: string): Promise<FoodAnalysis> {
  const meal = await recognizeMeal(base64);
  return {
    name:       meal.name,
    calories:   meal.calories,
    protein_g:  meal.protein_g,
    carbs_g:    meal.carbs_g,
    fat_g:      meal.fat_g,
    red_labels: [],
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NutritionPhotoAnalyzer() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result,      setResult]      = useState<FoodAnalysis | null>(null);
  const [preview,     setPreview]     = useState<string | null>(null);
  const cameraRef  = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const addNutrition = useAddNutrition();
  const addFavorite  = useAddFavoriteMeal();
  const today = localDateStr();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setIsAnalyzing(true);
    setResult(null);
    try {
      const base64   = await compressImageToBase64(file);
      const analysis = await analyzeFood(base64);
      setResult(analysis);
      if (analysis.calories > 0) toast.success(`זוהה: ${analysis.name}`);
    } catch (err) {
      console.error(err);
      toast.error("שגיאה בניתוח התמונה — בדוק חיבור AI");
    } finally {
      setIsAnalyzing(false);
      if (cameraRef.current)  cameraRef.current.value  = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!result) return;
    try {
      await addNutrition.mutateAsync({
        name:      result.name,
        meal_type: "lunch",
        calories:  result.calories,
        protein_g: result.protein_g,
        carbs_g:   result.carbs_g,
        fat_g:     result.fat_g,
        date:      today,
      });
      setResult(null);
      setPreview(null);
      toast.success("ארוחה נשמרה");
    } catch {
      toast.error("שגיאה בשמירת הארוחה");
    }
  };

  const handleSaveFavorite = async () => {
    if (!result) return;
    try {
      await addFavorite.mutateAsync({
        name:      result.name,
        calories:  result.calories,
        protein_g: result.protein_g,
        carbs_g:   result.carbs_g,
        fat_g:     result.fat_g,
      });
      toast.success("נשמר כמועדף");
    } catch {
      toast.error("שגיאה");
    }
  };

  const allRedLabels = result
    ? [...result.red_labels, ...detectRedLabels({ calories: result.calories }).map((l) => l.label)]
    : [];

  return (
    <div className="rounded-2xl bg-card border border-border p-4 space-y-4" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-nutrition/10 flex items-center justify-center">
          <ScanSearch className="h-4 w-4 text-nutrition" />
        </div>
        <div>
          <h3 className="text-sm font-semibold" style={{ letterSpacing: 0 }}>זיהוי מזון מתמונה</h3>
          <p className="text-xs text-muted-foreground">ניתוח קלוריות ותוויות אדומות</p>
        </div>
      </div>

      <input ref={cameraRef}  type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      {!result && !isAnalyzing && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => cameraRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-nutrition/30 hover:border-nutrition/60 hover:bg-nutrition/5 transition-colors min-h-[90px] group"
          >
            <div className="h-9 w-9 rounded-xl bg-nutrition/10 flex items-center justify-center group-hover:bg-nutrition/20 transition-colors">
              <Camera className="h-5 w-5 text-nutrition" />
            </div>
            <span className="text-xs font-semibold text-nutrition">צלם תמונה</span>
          </button>
          <button
            onClick={() => galleryRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-border hover:border-nutrition/30 hover:bg-nutrition/5 transition-colors min-h-[90px] group"
          >
            <div className="h-9 w-9 rounded-xl bg-secondary/50 flex items-center justify-center group-hover:bg-nutrition/10 transition-colors">
              <FolderOpen className="h-5 w-5 text-muted-foreground group-hover:text-nutrition transition-colors" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground group-hover:text-nutrition transition-colors">בחר מגלריה</span>
          </button>
        </div>
      )}

      {isAnalyzing && (
        <div className="flex flex-col items-center gap-3 py-6">
          {preview && (
            <img src={preview} alt="preview" className="h-28 w-28 object-cover rounded-xl border border-border opacity-70" />
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-nutrition" />
            מנתח תמונה...
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {preview && (
            <img src={preview} alt="meal" className="w-full h-36 object-cover rounded-xl border border-border" />
          )}
          <div className="p-3 rounded-xl bg-secondary space-y-2">
            <p className="font-semibold text-sm">{result.name}</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                ["קלוריות", result.calories,  ""],
                ["חלבון",   result.protein_g, "g"],
                ["פחמימות", result.carbs_g,   "g"],
                ["שומן",    result.fat_g,     "g"],
              ].map(([label, val, unit]) => (
                <div key={String(label)} className="bg-card rounded-lg p-2">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-bold">{val}{unit}</p>
                </div>
              ))}
            </div>

            {allRedLabels.length > 0 && (
              <div className="flex items-start gap-2 p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-orange-500">{[...new Set(allRedLabels)].join(" · ")}</p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1 bg-nutrition hover:bg-nutrition/90 text-nutrition-foreground"
              onClick={handleSave}
              disabled={addNutrition.isPending}
            >
              {addNutrition.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "שמור ארוחה"}
            </Button>
            <Button variant="outline" onClick={handleSaveFavorite} disabled={addFavorite.isPending} className="px-3">
              <Star className="h-4 w-4 text-nutrition" />
            </Button>
            <Button variant="outline" onClick={() => { setResult(null); setPreview(null); }}>
              ביטול
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
