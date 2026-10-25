import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { modelParams } from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const { imageBase64, mimeType, muscleGroup } = await req.json();

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY not set");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        signal: controller.signal,
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...modelParams("smart", 1000),
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}`,
                    detail: "low",
                  },
                },
                {
                  type: "text",
                  text: `You are a personal trainer. Identify this gym machine.
Target muscle group: ${muscleGroup}

Respond ONLY with valid JSON (no markdown):
{
  "machineName": "שם המכונה בעברית",
  "howToUse": "2-3 משפטים בעברית על איך להשתמש במכונה לשריר ${muscleGroup}",
  "equipmentKeywords": ["מילת ציוד1", "מילת ציוד2"]
}

equipmentKeywords should match Hebrew equipment terms used in Israeli gyms (e.g. "כבל", "מכבש", "ספסל").`,
                },
              ],
            },
          ],
        }),
      });
      clearTimeout(timeout);
    } catch (e) {
      clearTimeout(timeout);
      if ((e as Error).name === 'AbortError') {
        return new Response(JSON.stringify({ error: 'AI request timed out' }), {
          status: 504,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw e;
    }

    if (!response.ok) {
      const t = await response.text();
      console.error("OpenAI error:", response.status, t);
      throw new Error(`AI ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    const clean = content.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      console.error('Failed to parse OpenAI response:', content);
      return new Response(JSON.stringify({ error: 'AI response was not valid JSON' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("identify-machine error:", err);
    return new Response(
      JSON.stringify({
        error: (err as Error).message,
        machineName: "לא זוהה",
        howToUse: "לא ניתן לזהות את המכונה. נסה תמונה ברורה יותר.",
        equipmentKeywords: [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
});
