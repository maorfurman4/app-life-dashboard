import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { modelParams } from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const errResponse = (msg: string, status = 500) =>
  new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Verify the request has a valid Supabase JWT
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
    const body = await req.json().catch(() => ({}));
    const { userId, weekExpenses, weekWorkouts, weekCalories, weekBalance, userName } = body as {
      userId?: string;
      weekExpenses?: number;
      weekWorkouts?: number;
      weekCalories?: number;
      weekBalance?: number;
      userName?: string;
    };

    if (!userId) return errResponse("userId is required", 400);

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return errResponse("OPENAI_API_KEY not set");

    const displayName = userName ?? "המשתמש";
    const systemPrompt = `אתה עוזר חכם שמנתח את השבוע האחרון של ${displayName}. ענה עם 3-4 תובנות קצרות ומעודדות בעברית, כל אחת עם emoji מתאים. החזר JSON בפורמט: {"insights": ["תובנה 1", "תובנה 2", "תובנה 3"]}`;

    const userMessage = `נתוני השבוע:
- הוצאות: ${weekExpenses ?? 0} ₪
- אימונים: ${weekWorkouts ?? 0}
- קלוריות ממוצע יומי: ${weekCalories ?? 0}
- יתרה שבועית: ${weekBalance ?? 0} ₪`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        ...modelParams("smart", 800),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return errResponse(`OpenAI error: ${errText}`, 502);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    let parsed: { insights?: string[] };
    try {
      parsed = JSON.parse(cleaned) as { insights?: string[] };
    } catch (e) {
      console.error('Failed to parse OpenAI response:', raw);
      return errResponse('AI response was not valid JSON');
    }

    return new Response(JSON.stringify({ insights: parsed.insights ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return errResponse(`Unexpected error: ${(e as Error).message}`);
  }
});
