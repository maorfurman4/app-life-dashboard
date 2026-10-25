import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { modelParams, type Effort } from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const errResponse = (msg: string, status = 500) =>
  new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SYSTEM_PROMPT = `You are an expert clinical nutritionist specializing in Israeli and Middle Eastern cuisine. Your job is to identify every ingredient in the photo and calculate calories + macros through step-by-step math — never holistic guessing.

════════════════════════════════════════════════════
STEP 1 — VISUAL IDENTIFICATION (be exhaustive)
════════════════════════════════════════════════════
List EVERY component visible including:
- Main proteins (meat, fish, eggs, legumes)
- Starches (rice, pasta, bread, potato)
- Vegetables (cooked or raw)
- Sauces and spreads (hummus, tahini, tomato sauce)
- Cooking fats (olive oil drizzles, butter, frying oil)
- Garnishes (sumac, paprika, parsley — these add minimal calories but note them)

════════════════════════════════════════════════════
STEP 2 — VISUAL WEIGHT ESTIMATION (use these anchors)
════════════════════════════════════════════════════
Plate/container size anchors:
- Standard Israeli dinner plate: 26–28cm diameter
- Glass meal-prep container (1-compartment): holds ~600–900g food
- Small plastic meal-prep container: ~400–600g food
- Hummus plate (white ceramic): typically 180–250g hummus spread
- Side dish bowl: ~150–250g

Portion anchors for common Israeli meals:
- Hummus spread on plate: 150–200g (thick layer covering whole plate)
- Ground beef/lamb on hummus: 120–180g cooked meat
- Tahini sauce drizzled: 30–60g
- Grilled chicken breast (1 piece): 150–200g raw = 120–160g cooked
- Grilled chicken thigh (1 piece with bone): 180–220g raw = 130–170g cooked
- Rice in meal-prep box (1 scoop): 150–200g cooked
- Broccoli in meal-prep box: 100–150g cooked
- Lamb ribs (2–3 pieces on plate): 200–300g with bone = 100–150g edible meat
- Roasted cauliflower balls (3–4 pieces): 150–200g
- Vermicelli rice (1 scoop): 150g cooked

Oil estimation:
- Light drizzle visible on dish: 10–15g oil
- Pan-fried visible sheen: 15–25g oil
- Deep-fried appearance: 20–40g oil absorbed

════════════════════════════════════════════════════
STEP 3 — NUTRITION REFERENCE TABLE (per 100g cooked unless noted)
════════════════════════════════════════════════════
PROTEINS:
- חזה עוף צלוי/מבושל: 165 קל, 31g חלבון, 0g פחמ, 3.6g שומן
- שוק עוף (עם עור): 245 קל, 27g חלבון, 0g פחמ, 15g שומן
- כנף עוף (עם עור): 290 קל, 27g חלבון, 0g פחמ, 20g שומן
- בשר בקר טחון 85% רזה: 215 קל, 26g חלבון, 0g פחמ, 12g שומן
- בשר כבש טחון: 258 קל, 25g חלבון, 0g פחמ, 17g שומן
- כבש צלוי/עצם (בשר): 294 קל, 25g חלבון, 0g פחמ, 21g שומן
- סטייק בקר (סינטה/פילה): 200 קל, 28g חלבון, 0g פחמ, 9g שומן
- בולוניז בשר (בשר+רוטב): 160 קל, 14g חלבון, 5g פחמ, 9g שומן
- פילה סלמון: 208 קל, 20g חלבון, 0g פחמ, 13g שומן
- טונה (קופסה במים): 116 קל, 26g חלבון, 0g פחמ, 1g שומן
- ביצה שלמה (L, ~60g/יח׳): 85 קל, 7g חלבון, 0.6g פחמ, 5.5g שומן
- שניצל עוף (מטוגן בפירורים): 230 קל, 20g חלבון, 12g פחמ, 11g שומן

STARCHES:
- אורז לבן מבושל: 130 קל, 2.7g חלבון, 28g פחמ, 0.3g שומן
- ורמישלי/שערות מלאך מבושלות: 138 קל, 4.5g חלבון, 28g פחמ, 0.8g שומן
- אורז עם ורמישלי (25% ורמישלי): 132 קל, 3g חלבון, 28g פחמ, 0.4g שומן
- תפוח אדמה מבושל: 86 קל, 1.8g חלבון, 20g פחמ, 0.1g שומן
- בטטה מבושלת: 90 קל, 2g חלבון, 21g פחמ, 0.1g שומן
- פסטה מבושלת: 131 קל, 5g חלבון, 25g פחמ, 1g שומן
- פיתה (1 יח׳ ~65g): 165 קל, 5.5g חלבון, 33g פחמ, 0.7g שומן
- לחם לבן (פרוסה 30g): 80 קל, 2.5g חלבון, 15g פחמ, 1g שומן

LEGUMES & SPREADS:
- חומוס מוכן (ממרח): 166 קל, 9g חלבון, 27g פחמ, 3g שומן
- טחינה גולמית/ממרח (לפני מים): 570 קל, 17g חלבון, 23g פחמ, 50g שומן
- טחינה מדוללת כרוטב (50% מים): 285 קל, 8.5g חלבון, 12g פחמ, 25g שומן
- עדשים מבושלות: 116 קל, 9g חלבון, 20g פחמ, 0.4g שומן
- שעועית שחורה/לבנה מבושלת: 127 קל, 8.7g חלבון, 23g פחמ, 0.5g שומן
- חומוס גרגרים מבושל: 164 קל, 8.9g חלבון, 27g פחמ, 2.6g שומן

VEGETABLES (cooked):
- ברוקולי מבושל/מאודה: 35 קל, 2.4g חלבון, 7g פחמ, 0.4g שומן
- ברוקולי מוקפץ בשמן: 80 קל, 2.8g חלבון, 7g פחמ, 4g שומן
- כרובית מבושלת: 25 קל, 2g חלבון, 5g פחמ, 0.3g שומן
- כרובית צלויה בתנור: 60 קל, 2g חלבון, 6g פחמ, 3g שומן
- כרובית כדורים ברוטב: 90 קל, 3g חלבון, 8g פחמ, 5g שומן
- גזר מבושל: 41 קל, 0.9g חלבון, 10g פחמ, 0.2g שומן
- בצל מוקפץ: 45 קל, 1g חלבון, 10g פחמ, 0.1g שומן
- עגבנייה טרייה: 18 קל, 0.9g חלבון, 3.9g פחמ, 0.2g שומן
- מלפפון טרי: 16 קל, 0.7g חלבון, 3.6g פחמ, 0.1g שומן
- חסה: 15 קל, 1.4g חלבון, 2.9g פחמ, 0.2g שומן
- פלפל (כל צבע): 31 קל, 1g חלבון, 7g פחמ, 0.3g שומן
- חציל צלוי: 35 קל, 0.8g חלבון, 8.6g פחמ, 0.2g שומן

FATS & OILS:
- שמן זית (1 כף = 14g): 120 קל, 0g חלבון, 0g פחמ, 14g שומן
- חמאה (1 כף = 14g): 100 קל, 0.1g חלבון, 0g פחמ, 11.5g שומן
- אבוקדו: 160 קל, 2g חלבון, 9g פחמ, 15g שומן
- שקדים (30g): 173 קל, 6g חלבון, 6g פחמ, 15g שומן

DAIRY:
- גבינה צהובה: 402 קל, 25g חלבון, 1.3g פחמ, 33g שומן
- קוטג׳ 5%: 85 קל, 11g חלבון, 3.4g פחמ, 3g שומן
- יוגורט 3%: 61 קל, 3.5g חלבון, 4.7g פחמ, 3g שומן

════════════════════════════════════════════════════
STEP 4 — CALCULATE (show your work mentally before reporting)
════════════════════════════════════════════════════
For EACH component:
  calories_contrib = estimated_grams × (ref_cal ÷ 100)
  protein_contrib  = estimated_grams × (ref_protein ÷ 100)
  carbs_contrib    = estimated_grams × (ref_carbs ÷ 100)
  fat_contrib      = estimated_grams × (ref_fat ÷ 100)

Then SUM all components.

IMPORTANT CALIBRATION RULES:
- Do NOT round up portions. If a plate looks like ~160g chicken, use 160g not 200g.
- Hummus plates in Israel: the spread is 150–200g. Do NOT call it 300g+ unless it's an exceptionally large portion.
- Tahini drizzle is usually 30–50g, NOT 100g.
- Rice in a meal-prep box: one scoop ~150–180g cooked (NOT 300g unless the box is totally packed).
- Cooking oil: if pan-fried or sautéed, add 15–20g oil absorbed, not more.
- For mixed dishes (bolognese, stew), account for sauce weight separately from meat weight.

════════════════════════════════════════════════════
STEP 5 — REPORT
════════════════════════════════════════════════════
Call report_meal with the mathematically summed totals.
- meal_name: Hebrew name describing the full dish
- confidence: "high" = clearly visible + common Israeli dish, "medium" = partly obscured or complex, "low" = blurry/unclear
- no_food: true ONLY when absolutely no food is visible

Never refuse to analyze. Always produce a best-effort calculation even for blurry images.`;



Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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

  const requestId = crypto.randomUUID().slice(0, 8);
  const t0 = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const { imageBase64 } = body;

    if (!imageBase64) return errResponse("missing image", 400);

    const hasPrefix    = imageBase64.startsWith("data:");
    const payloadBytes = imageBase64.length;
    console.log(`[${requestId}] recv image — bytes=${payloadBytes} hasPrefix=${hasPrefix}`);

    if (payloadBytes > 3_000_000) return errResponse("התמונה גדולה מדי — הקטן אותה ונסה שוב", 413);

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return errResponse("OPENAI_API_KEY not set");

    const dataUrl = hasPrefix
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

    // One recognition attempt; gpt-5-mini with "minimal" reasoning is ~10× cheaper than gpt-4o
    const analyze = async (effort: Effort): Promise<Response | Record<string, unknown>> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25_000);
      console.log(`[${requestId}] calling openai effort=${effort}`);
      const tFetch = Date.now();

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        signal: controller.signal,
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          ...modelParams("smart", effort === "minimal" ? 1500 : 4000, effort),
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
                { type: "text", text: "Analyze this food image and call report_meal with your findings." },
              ],
            },
          ],
          tools: [{
            type: "function",
            function: {
              name: "report_meal",
              description: "Report the identified meal with nutritional data in Hebrew",
              parameters: {
                type: "object",
                properties: {
                  meal_name:  { type: "string",  description: "שם האוכל בעברית" },
                  calories:   { type: "number",  description: "קלוריות כוללות" },
                  protein_g:  { type: "number",  description: "חלבון בגרמים" },
                  carbs_g:    { type: "number",  description: "פחמימות בגרמים" },
                  fat_g:      { type: "number",  description: "שומן בגרמים" },
                  confidence: { type: "string",  enum: ["high", "medium", "low"] },
                  no_food:       { type: "boolean", description: "true only when absolutely no food is visible" },
                  portion_grams: { type: "number",  description: "total estimated gram weight of all food combined" },
                },
                required: ["meal_name", "calories", "protein_g", "carbs_g", "fat_g", "confidence", "no_food"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "report_meal" } },
        }),
      }).finally(() => clearTimeout(timer));

      console.log(`[${requestId}] openai responded status=${res.status} ms=${Date.now() - tFetch}`);

      if (!res.ok) {
        const t = await res.text();
        console.error(`[${requestId}] openai error status=${res.status} body=${t}`);
        if (res.status === 429) return errResponse("יותר מדי בקשות, נסה שוב בעוד דקה", 429);
        return errResponse(`שגיאת AI (${res.status})`, 502);
      }

      const data     = await res.json();
      const usage    = data?.usage;
      const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];

      if (!toolCall) {
        console.error(`[${requestId}] no tool call in response`);
        return errResponse("תגובת AI לא תקינה — נסה שנית");
      }

      try {
        const parsed = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
        console.log(`[${requestId}] parsed=${JSON.stringify(parsed)} tokens=${usage?.total_tokens ?? "?"} total_ms=${Date.now() - t0}`);
        return parsed;
      } catch {
        console.error(`[${requestId}] JSON parse failed args=${toolCall.function.arguments}`);
        return errResponse("תגובת AI לא תקינה — נסה שנית");
      }
    };

    let result = await analyze("minimal");
    // Without reasoning the model occasionally names the food but reports 0 kcal — retry that once with reasoning
    if (!(result instanceof Response) && !result.no_food && !(Number(result.calories) > 0)) {
      result = await analyze("low");
    }
    if (result instanceof Response) return result;
    const parsed = result;

    if (parsed.no_food) {
      return errResponse("לא זוהה מזון בתמונה — נסה תמונה ברורה יותר", 422);
    }

    const confidence = (["high", "medium", "low"].includes(String(parsed.confidence))
      ? parsed.confidence
      : "medium") as "high" | "medium" | "low";

    const meal = {
      name:          String(parsed.meal_name    ?? "ארוחה לא ידועה"),
      calories:      Number(parsed.calories     ?? 0),
      protein_g:     Number(parsed.protein_g    ?? 0),
      carbs_g:       Number(parsed.carbs_g      ?? 0),
      fat_g:         Number(parsed.fat_g        ?? 0),
      portion_grams: Number(parsed.portion_grams ?? 0),
      items:         [] as string[],
      confidence,
    };

    return new Response(JSON.stringify({ meal }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[${requestId}] unhandled error ms=${Date.now() - t0} err=${msg}`);
    return errResponse(msg.includes("aborted") ? "הבקשה ארכה יותר מדי — נסה שוב" : msg);
  }
});
