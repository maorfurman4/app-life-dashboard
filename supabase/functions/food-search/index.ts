import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { modelParams } from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FoodResult {
  name: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: string;
}

async function searchOpenFoodFacts(query: string): Promise<FoodResult[]> {
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10&lc=he&fields=product_name,product_name_he,brands,nutriments,countries_tags`;
    const res = await fetch(url, { headers: { "User-Agent": "MaorLifeApp/1.0" } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.products || [])
      .filter((p: any) => (p.product_name_he || p.product_name) && p.nutriments?.["energy-kcal_100g"])
      .map((p: any) => ({
        name: p.product_name_he || p.product_name,
        brand: p.brands || undefined,
        calories: Math.round(p.nutriments["energy-kcal_100g"] || 0),
        protein: Math.round((p.nutriments.proteins_100g || 0) * 10) / 10,
        carbs: Math.round((p.nutriments.carbohydrates_100g || 0) * 10) / 10,
        fat: Math.round((p.nutriments.fat_100g || 0) * 10) / 10,
        source: "off",
      }))
      .slice(0, 8);
  } catch (e) {
    console.error("OFF error:", e);
    return [];
  }
}

async function translateToHebrew(names: string[]): Promise<string[]> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey || names.length === 0) return names;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...modelParams("fast", 600),
        messages: [
          {
            role: "system",
            content: "Translate food names from English to Hebrew. Return ONLY a JSON array of strings, same length and order as input. No explanations.",
          },
          { role: "user", content: JSON.stringify(names) },
        ],
      }),
    });
    if (!res.ok) {
      console.error("AI gateway:", res.status);
      return names;
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "[]";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length === names.length) return parsed;
    return names;
  } catch (e) {
    console.error("translate error:", e);
    return names;
  }
}

async function searchUSDA(query: string): Promise<FoodResult[]> {
  // USDA FoodData Central public DEMO_KEY (no auth needed for limited use)
  try {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=6&api_key=DEMO_KEY`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const foods = (data.foods || []).slice(0, 6);

    const enResults: FoodResult[] = foods.map((f: any) => {
      const nut = (key: string) =>
        f.foodNutrients?.find((n: any) => n.nutrientName?.toLowerCase().includes(key))?.value || 0;
      return {
        name: f.description || "Unknown",
        brand: f.brandOwner || undefined,
        calories: Math.round(nut("energy")),
        protein: Math.round(nut("protein") * 10) / 10,
        carbs: Math.round(nut("carbohydrate") * 10) / 10,
        fat: Math.round(nut("total lipid") * 10) / 10,
        source: "usda",
      };
    });

    const names = enResults.map((r) => r.name);
    const heNames = await translateToHebrew(names);
    return enResults.map((r, i) => ({ ...r, name: heNames[i] || r.name }));
  } catch (e) {
    console.error("USDA error:", e);
    return [];
  }
}

async function estimateWithAI(query: string): Promise<FoodResult[]> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return [];
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        ...modelParams("smart", 600),
        messages: [
          {
            role: "system",
            content: `Return per-100g nutritional values for the food item the user names.
Respond with ONLY a JSON object: { "name_he": "<Hebrew name>", "calories": <number>, "protein": <number>, "carbs": <number>, "fat": <number> }
Use USDA standard values. No markdown, no explanation.`,
          },
          { role: "user", content: query },
        ],
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? "{}";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed.name_he) return [];
    return [{
      name:     parsed.name_he,
      calories: Math.round(parsed.calories ?? 0),
      protein:  Math.round((parsed.protein ?? 0) * 10) / 10,
      carbs:    Math.round((parsed.carbs   ?? 0) * 10) / 10,
      fat:      Math.round((parsed.fat     ?? 0) * 10) / 10,
      source:   "ai",
    }];
  } catch (e) {
    console.error("AI estimate error:", e);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { query, barcode } = await req.json();

    // Barcode lookup
    if (barcode && typeof barcode === "string") {
      try {
        const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
        const res = await fetch(url, { headers: { "User-Agent": "MaorLifeApp/1.0" } });
        const data = await res.json();
        if (data.status === 1 && data.product) {
          const p = data.product;
          const n = p.nutriments || {};
          const result = {
            name: p.product_name_he || p.product_name || "מוצר ללא שם",
            brand: p.brands || undefined,
            calories: Math.round(n["energy-kcal_100g"] || 0),
            protein: Math.round((n.proteins_100g || 0) * 10) / 10,
            carbs: Math.round((n.carbohydrates_100g || 0) * 10) / 10,
            fat: Math.round((n.fat_100g || 0) * 10) / 10,
            source: "off-barcode",
            barcode,
          };
          return new Response(JSON.stringify({ results: [result], product: result }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ results: [], error: "מוצר לא נמצא" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("barcode error:", e);
        return new Response(JSON.stringify({ results: [], error: "שגיאה בחיפוש ברקוד" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const offResults = await searchOpenFoodFacts(query);
    let results = offResults;

    if (offResults.length < 3) {
      const usdaResults = await searchUSDA(query);
      const seen = new Set(offResults.map((r) => r.name.toLowerCase()));
      const merged = [...offResults];
      for (const r of usdaResults) {
        if (!seen.has(r.name.toLowerCase())) {
          merged.push(r);
          seen.add(r.name.toLowerCase());
        }
      }
      results = merged;
    }

    // Append AI estimate at the end as a fallback option.
    // For whole foods with no real DB results, it's the only option.
    // For branded products (protein powder etc.), real results appear first.
    const aiResults = await estimateWithAI(query);
    const seenNames = new Set(results.map((r) => r.name.toLowerCase()));
    for (const r of aiResults) {
      if (!seenNames.has(r.name.toLowerCase())) {
        results = [...results, r];
      }
    }

    return new Response(JSON.stringify({ results: results.slice(0, 12) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("food-search error:", err);
    return new Response(JSON.stringify({ results: [], error: (err as Error).message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
