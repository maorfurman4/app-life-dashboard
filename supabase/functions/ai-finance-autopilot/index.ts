import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { modelParams } from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-make-secret",
};

/**
 * ai-finance-autopilot — Natural language expense logger via Telegram
 * Auth: x-make-secret header
 * Input: { text: string, userId: string, chatId?: string }
 * Output: { success: boolean, expense?: object, xpGained: number, message: string, isFirstAutoExpense: boolean }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth
  const makeSecret = req.headers.get('x-make-secret');
  const expectedSecret = Deno.env.get('MAKE_COM_SECRET');
  if (!expectedSecret || makeSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { text, userId } = await req.json();
    if (!text || !userId) throw new Error('text and userId are required');

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) throw new Error('OPENAI_API_KEY not set');

    // 1. Parse expense with GPT-4o-mini
    const parseResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...modelParams("fast", 600),
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Extract expense data from Hebrew or English text. Return ONLY valid JSON: {"amount": number, "category": string, "description": string, "currency": "ILS"}. Category must be one of: קפה/מסעדה, סופרמרקט, רכב, בילויים, בריאות, לבוש, חשבונות, אחר. If the text is not about an expense, return {"amount": 0, "category": "אחר", "description": "לא הובנה הוצאה", "currency": "ILS"}.`
          },
          { role: 'user', content: text }
        ]
      })
    });

    const parseData = await parseResponse.json();
    const parsed = JSON.parse(parseData.choices?.[0]?.message?.content ?? '{}');

    if (!parsed.amount || parsed.amount <= 0) {
      return new Response(JSON.stringify({
        success: false,
        message: '🤔 לא הצלחתי לזהות הוצאה בהודעה. נסה: "הוצאתי 50 ש"ח על קפה"',
        xpGained: 0,
        isFirstAutoExpense: false,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Insert expense into DB
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const today = new Date().toISOString().slice(0, 10);
    const { data: expense, error: expenseError } = await supabase
      .from('expense_entries')
      .insert({
        user_id: userId,
        amount: parsed.amount,
        category: parsed.category,
        description: parsed.description,
        date: today,
        currency: parsed.currency ?? 'ILS',
        exchange_rate: 1.0,
        notes: `[AI Autopilot] מקור: "${text.slice(0, 100)}"`,
      })
      .select()
      .single();

    if (expenseError) throw expenseError;

    // 3. Award XP (+10 for logging expense via AI)
    const { error: xpError } = await supabase.rpc('increment_user_xp', {
      p_user_id: userId,
      p_xp: 10,
    }).then(r => r).catch(() =>
      // Fallback: direct update if RPC doesn't exist
      supabase.from('user_xp')
        .upsert({ user_id: userId, total_xp: 10 }, { onConflict: 'user_id' })
        .then(r => r)
    );

    // 4. Check if first auto-expense (for AI Autopilot achievement)
    const { count } = await supabase
      .from('expense_entries')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .ilike('notes', '%AI Autopilot%');

    const isFirstAutoExpense = (count ?? 0) <= 1;

    // 5. Unlock achievement if first time
    if (isFirstAutoExpense) {
      await supabase.from('achievements').upsert({
        user_id: userId,
        achievement_key: 'ai_autopilot_first',
        xp_earned: 50,
      }, { onConflict: 'user_id,achievement_key' });
    }

    const message = `✅ *הוצאה נרשמה!*\n\n💰 ${parsed.amount} ₪ — ${parsed.category}\n📝 ${parsed.description}\n⚡ +10 XP${isFirstAutoExpense ? '\n\n🤖 *AI Autopilot Badge Unlocked!* +50 XP' : ''}`;

    return new Response(JSON.stringify({
      success: true,
      expense,
      xpGained: isFirstAutoExpense ? 60 : 10,
      message,
      isFirstAutoExpense,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: `❌ שגיאה: ${String(error)}`,
      xpGained: 0,
      isFirstAutoExpense: false,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
