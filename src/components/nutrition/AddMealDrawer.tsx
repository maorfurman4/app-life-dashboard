import { useState, useEffect, useRef, useMemo } from "react";
import { AddItemDrawer } from "@/components/shared/AddItemDrawer";
import { Loader2, Plus, UtensilsCrossed, Search, ScanBarcode } from "lucide-react";
import { useAddNutrition } from "@/hooks/use-sport-data";
import { toast } from "sonner";
import { haptics } from "@/lib/haptics";
import { MealPhotoCapture } from "./MealPhotoCapture";
import { BarcodeScanner } from "./BarcodeScanner";
import { supabase } from "@/integrations/supabase/client";
import type { FoodFactsProduct } from "@/lib/open-food-facts";

function autoMealType(): "breakfast" | "lunch" | "snack" | "dinner" {
  const h = new Date().getHours();
  if (h >= 6  && h < 10) return "breakfast";
  if (h >= 10 && h < 15) return "lunch";
  if (h >= 15 && h < 19) return "snack";
  if (h >= 19 && h < 23) return "dinner";
  return "snack";
}

interface FoodResult {
  name: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source?: string;
}

// Per-100g base stored after selection so grams can recalculate
interface FoodBase {
  name: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface AddMealDrawerProps {
  open: boolean;
  onClose: () => void;
  prefillName?: string;
  prefillCalories?: number;
  prefillProtein?: number;
  prefillCarbs?: number;
  prefillFat?: number;
}

export function AddMealDrawer({
  open,
  onClose,
  prefillName = "",
  prefillCalories,
  prefillProtein,
  prefillCarbs,
  prefillFat,
}: AddMealDrawerProps) {
  const [mode, setMode] = useState<"manual" | "search">("search");
  const [name, setName] = useState(prefillName);
  const [calories, setCalories] = useState(prefillCalories?.toString() ?? "");
  const [protein, setProtein] = useState(prefillProtein?.toString() ?? "");
  const [carbs, setCarbs] = useState(prefillCarbs?.toString() ?? "");
  const [fat, setFat] = useState(prefillFat?.toString() ?? "");
  const [grams, setGrams] = useState("100");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBase, setSelectedBase] = useState<FoodBase | null>(null);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const addNutrition = useAddNutrition();

  const macroPreview = useMemo(() => ({
    calories: Math.round(Number(calories) || 0),
    protein: Math.round(Number(protein) || 0),
    carbs: Math.round(Number(carbs) || 0),
    fat: Math.round(Number(fat) || 0),
  }), [calories, protein, carbs, fat]);

  // Debounced search via food-search edge function (OFF → USDA → AI fallback)
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await supabase.functions.invoke("food-search", {
          body: { query: query.trim() },
        });
        setResults(data?.results ?? []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Recalculate macros whenever grams changes (only if a food is selected)
  useEffect(() => {
    if (!selectedBase) return;
    const factor = (parseFloat(grams) || 100) / 100;
    setCalories(Math.round(selectedBase.calories * factor).toString());
    setProtein((selectedBase.protein * factor).toFixed(1));
    setCarbs((selectedBase.carbs * factor).toFixed(1));
    setFat((selectedBase.fat * factor).toFixed(1));
  }, [grams, selectedBase]);

  const selectFood = (food: FoodResult) => {
    // Store per-100g base so gram changes can recalculate
    setSelectedBase({
      name: food.name,
      brand: food.brand,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
    });
    setName(food.name + (food.brand ? ` (${food.brand})` : ""));
    const factor = (parseFloat(grams) || 100) / 100;
    setCalories(Math.round(food.calories * factor).toString());
    setProtein((food.protein * factor).toFixed(1));
    setCarbs((food.carbs * factor).toFixed(1));
    setFat((food.fat * factor).toFixed(1));
    setMode("manual");
    setResults([]);
    setQuery("");
  };

  const handleBarcodeProduct = (product: FoodFactsProduct) => {
    setSelectedBase({
      name: product.name,
      brand: product.brand,
      calories: product.calories,
      protein: product.protein,
      carbs: product.carbs,
      fat: product.fat,
    });
    const factor = (parseFloat(grams) || 100) / 100;
    setName(product.name + (product.brand ? ` (${product.brand})` : ""));
    setCalories(Math.round(product.calories * factor).toString());
    setProtein((product.protein * factor).toFixed(1));
    setCarbs((product.carbs * factor).toFixed(1));
    setFat((product.fat * factor).toFixed(1));
    setMode("manual");
  };

  const resetForm = () => {
    setName(""); setCalories(""); setProtein(""); setCarbs(""); setFat("");
    setQuery(""); setResults([]); setMode("search"); setSelectedBase(null); setGrams("100");
  };

  const handleSave = () => {
    if (!name.trim()) { toast.error("הזן שם מזון"); return; }
    addNutrition.mutate(
      {
        name,
        meal_type: autoMealType(),
        calories: calories ? parseInt(calories) : undefined,
        protein_g: protein ? parseFloat(protein) : undefined,
        carbs_g: carbs ? parseFloat(carbs) : undefined,
        fat_g: fat ? parseFloat(fat) : undefined,
      },
      {
        onSuccess: () => { haptics.success(); toast.success("ארוחה נשמרה!"); resetForm(); onClose(); },
        onError: (err) => toast.error("שגיאה: " + err.message),
      }
    );
  };

  return (
    <>
    <BarcodeScanner
      open={barcodeScannerOpen}
      onClose={() => setBarcodeScannerOpen(false)}
      onDetected={() => {}}
      onProductFound={handleBarcodeProduct}
    />
    <AddItemDrawer open={open} onClose={onClose} title="הוסף ארוחה">
      <div className="space-y-4">
        {/* Mode toggle */}
        <div className="flex gap-1 rounded-xl bg-secondary/30 p-1">
          <button
            onClick={() => setMode("manual")}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors min-h-[36px] ${
              mode === "manual" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            הזנה ידנית
          </button>
          <button
            onClick={() => setMode("search")}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors min-h-[36px] ${
              mode === "search" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <Search className="h-3 w-3 inline ms-1" />חיפוש
          </button>
          <button
            onClick={() => setBarcodeScannerOpen(true)}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition-colors min-h-[36px] text-muted-foreground hover:text-foreground"
          >
            <ScanBarcode className="h-3 w-3 inline ms-1" />ברקוד
          </button>
        </div>

        {/* Photo capture in search mode */}
        {mode === "search" && (
          <MealPhotoCapture
            onRecognized={(meal) => {
              setName(meal.name);
              setCalories(Math.round(meal.calories).toString());
              setProtein(meal.protein_g.toFixed(1));
              setCarbs(meal.carbs_g.toFixed(1));
              setFat(meal.fat_g.toFixed(1));
              setMode("manual");
            }}
          />
        )}

        {mode === "search" && (
          <div className="space-y-2">
            {/* Gram selector — always visible so user picks before selecting */}
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">כמות (גרם)</label>
              <div className="flex gap-1.5">
                {[50, 100, 150, 200, 300].map((g) => (
                  <button
                    key={g}
                    onClick={() => setGrams(g.toString())}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors min-h-[32px] ${
                      grams === g.toString()
                        ? "bg-nutrition/20 text-nutrition border border-nutrition/40"
                        : "bg-secondary/30 text-muted-foreground border border-transparent"
                    }`}
                  >
                    {g}g
                  </button>
                ))}
                <input
                  type="number"
                  value={grams}
                  onChange={(e) => setGrams(e.target.value)}
                  className="w-16 px-2 rounded-lg border border-border bg-card text-[11px] text-center"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="חפש: חזה עוף, אורז, מלפפון..."
                className="w-full px-3 py-2.5 pe-9 rounded-xl border border-border bg-card text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-nutrition min-h-[44px]"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
              />
              {loading && (
                <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-nutrition" />
              )}
            </div>

            {results.length > 0 && (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {results.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => selectFood(r)}
                    className="w-full flex items-center gap-2 p-2 rounded-xl bg-secondary/20 hover:bg-secondary/35 transition-colors text-end"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">{r.name}</p>
                        {r.source === "ai" && (
                          <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 font-semibold">אומדן AI</span>
                        )}
                      </div>
                      <div className="flex gap-2 text-[10px] text-muted-foreground">
                        {r.brand && <span className="truncate">{r.brand}</span>}
                        <span>{r.calories} קל׳/100g</span>
                        <span>P:{r.protein}g</span>
                        <span>C:{r.carbs}g</span>
                        <span>F:{r.fat}g</span>
                      </div>
                    </div>
                    <Plus className="h-4 w-4 text-nutrition shrink-0" />
                  </button>
                ))}
              </div>
            )}
            {!loading && query.length >= 2 && results.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">אין תוצאות — נסה מילה אחרת</p>
            )}
          </div>
        )}

        {mode === "manual" && (
          <>
            {/* Gram selector in manual mode too (recalculates if food was selected) */}
            {selectedBase && (
              <div>
                <label className="text-[10px] font-medium text-muted-foreground mb-1 block">כמות (גרם) — מחשב מחדש אוטומטית</label>
                <div className="flex gap-1.5">
                  {[50, 100, 150, 200, 300].map((g) => (
                    <button
                      key={g}
                      onClick={() => setGrams(g.toString())}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors min-h-[32px] ${
                        grams === g.toString()
                          ? "bg-nutrition/20 text-nutrition border border-nutrition/40"
                          : "bg-secondary/30 text-muted-foreground border border-transparent"
                      }`}
                    >
                      {g}g
                    </button>
                  ))}
                  <input
                    type="number"
                    value={grams}
                    onChange={(e) => setGrams(e.target.value)}
                    className="w-16 px-2 rounded-lg border border-border bg-card text-[11px] text-center"
                    dir="ltr"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">שם המזון / הארוחה</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="לדוגמה: חזה עוף 200 גרם, סלט ירקות"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-nutrition focus:ring-2 focus:ring-nutrition/20 transition-shadow min-h-[44px]"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "קלוריות", value: calories, set: setCalories, mode: "numeric" as const, color: "text-emerald-500" },
                { label: "חלבון (g)", value: protein, set: setProtein, mode: "decimal" as const, color: "text-blue-500" },
                { label: "פחמימות (g)", value: carbs, set: setCarbs, mode: "decimal" as const, color: "text-amber-500" },
                { label: "שומן (g)", value: fat, set: setFat, mode: "decimal" as const, color: "text-pink-500" },
              ].map(({ label, value, set, mode, color }) => (
                <div key={label}>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
                  <input
                    type="text"
                    inputMode={mode}
                    value={value}
                    onChange={(e) => {
                      const raw = e.target.value;
                      // allow digits and a single decimal point only — avoids mobile "number" input quirks
                      const cleaned = mode === "numeric"
                        ? raw.replace(/[^0-9]/g, "")
                        : raw.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
                      set(cleaned);
                    }}
                    placeholder="0"
                    className={`w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm font-semibold text-center ${color} placeholder:text-muted-foreground/50 placeholder:font-normal focus:outline-none focus:border-nutrition focus:ring-2 focus:ring-nutrition/20 transition-shadow min-h-[44px]`}
                    dir="ltr"
                    autoComplete="off"
                  />
                </div>
              ))}
            </div>
          </>
        )}

        <button
          onClick={handleSave}
          disabled={addNutrition.isPending}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-nutrition text-nutrition-foreground font-bold text-sm hover:opacity-90 transition-opacity min-h-[44px] disabled:opacity-50"
        >
          <UtensilsCrossed className="h-4 w-4" />
          {addNutrition.isPending ? "שומר..." : "שמור ארוחה"}
        </button>
      </div>
    </AddItemDrawer>
    </>
  );
}
