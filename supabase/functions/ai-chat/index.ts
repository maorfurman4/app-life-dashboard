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

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// Caps keep a long conversation from growing the prompt (and the bill) without limit
const MAX_HISTORY = 12;
const MAX_MESSAGE_CHARS = 2000;

const sum = (rows: { amount?: number | null }[] | null) =>
  Math.round((rows ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0));

/** Compact numbers about the user — read with the user's own JWT, so RLS limits it to their rows. */
// deno-lint-ignore no-explicit-any
async function userContext(db: any): Promise<string> {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
  const monthStart = today.slice(0, 8) + "01";
  const weekAgo = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" })
    .format(new Date(Date.now() - 6 * 86_400_000));

  const [shifts, expenses, incomes, fixedExp, fixedInc, workouts, meals] = await Promise.all([
    db.from("work_shifts").select("hours, type").gte("date", monthStart).lte("date", today),
    db.from("expense_entries").select("amount, category").gte("date", monthStart).lte("date", today),
    db.from("income_entries").select("amount").eq("source", "manual").gte("date", monthStart).lte("date", today),
    db.from("fixed_expenses").select("amount, name").eq("is_active", true),
    db.from("fixed_income").select("amount, name").eq("is_active", true),
    db.from("workouts").select("date, duration_minutes").gte("date", weekAgo).lte("date", today),
    db.from("nutrition_entries").select("calories, protein_g").eq("date", today),
  ]);

  const shiftRows = shifts.data ?? [];
  const hours = shiftRows.reduce((s: number, r: { hours: number | null }) => s + Number(r.hours ?? 0), 0);
  const byCategory: Record<string, number> = {};
  for (const e of expenses.data ?? []) byCategory[e.category] = (byCategory[e.category] ?? 0) + Number(e.amount);
  const topCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([c, a]) => `${c} ₪${Math.round(a)}`).join(", ");
  const mealRows = meals.data ?? [];
  const kcal = mealRows.reduce((s: number, m: { calories: number | null }) => s + Number(m.calories ?? 0), 0);
  const protein = mealRows.reduce((s: number, m: { protein_g: number | null }) => s + Number(m.protein_g ?? 0), 0);
  const workoutRows = workouts.data ?? [];

  return [
    `תאריך היום: ${today}.`,
    `עבודה החודש: ${shiftRows.length} משמרות, ${Math.round(hours)} שעות.`,
    `כסף החודש: הוצאות משתנות ₪${sum(expenses.data)}${topCategories ? ` (בעיקר: ${topCategories})` : ""}; הוצאות קבועות ₪${sum(fixedExp.data)} לחודש; הכנסות קבועות ₪${sum(fixedInc.data)} לחודש; הכנסות ידניות ₪${sum(incomes.data)}. שכר מהמשמרות מחושב באפליקציה בלשונית עבודה.`,
    `אימונים ב-7 ימים אחרונים: ${workoutRows.length} (${workoutRows.reduce((s: number, w: { duration_minutes: number | null }) => s + Number(w.duration_minutes ?? 0), 0)} דקות).`,
    `תזונה היום: ${mealRows.length} ארוחות, ${Math.round(kcal)} קל׳, ${Math.round(protein)} ג׳ חלבון.`,
  ].join("\n");
}

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

  try {
    const body = await req.json().catch(() => ({}));
    const { messages: raw = [] } = body as { messages: ChatMessage[] };

    if (!Array.isArray(raw) || raw.length === 0) {
      return errResponse("messages array is required", 400);
    }
    // Only user/assistant turns from the client — a client-sent "system" message could override our instructions
    const messages = raw
      .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
      .slice(-MAX_HISTORY)
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));
    if (messages.length === 0) return errResponse("messages array is required", 400);

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return errResponse("OPENAI_API_KEY not set");

    const systemMessage: ChatMessage = {
      role: "system",
      content:
        "אתה עוזר אישי חכם באפליקציה My Life. ענה תמיד בעברית, קצר וידידותי. אתה עוזר עם נושאי ספורט, תזונה, כסף ובריאות. אל תהיה ארוך מדי — עד 3-4 משפטים בדרך כלל.\n" +
        "כשהמשתמש שואל על הנתונים שלו, ענה לפי הנתונים למטה בלבד ואל תמציא מספרים שלא מופיעים בהם.\n\n" +
        "נתוני המשתמש:\n" + await userContext(supabaseClient).catch((e) => {
          console.error("ai-chat context error:", e);
          return "(לא זמינים כרגע)";
        }),
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      signal: controller.signal,
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...modelParams("smart", 1000),
        messages: [systemMessage, ...messages],
      }),
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      const text = await res.text();
      console.error("OpenAI error:", res.status, text);
      if (res.status === 429) return errResponse("יותר מדי בקשות, נסה שוב מאוחר יותר", 429);
      return errResponse(`שגיאת AI (${res.status})`, 502);
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content ?? "מצטער, לא הצלחתי לענות";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ai-chat error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return errResponse(
      msg.includes("aborted") ? "הבקשה ארכה יותר מדי — נסה שוב" : msg
    );
  }
});
