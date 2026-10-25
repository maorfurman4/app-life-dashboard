import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { modelParams } from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_BASE64_BYTES = 10 * 1024 * 1024; // 10 MB cap (base64 encoded)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // JWT auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { imageBase64, mimeType = "image/jpeg" } = body as {
      imageBase64?: string;
      mimeType?: string;
    };

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "imageBase64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Size guard — never store the image (privacy-first)
    if (imageBase64.length > MAX_BASE64_BYTES) {
      return new Response(JSON.stringify({ error: "Image too large (max 10 MB)" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
    if (!allowedMimes.includes(mimeType)) {
      return new Response(JSON.stringify({ error: "Unsupported file type" }), {
        status: 415,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

    const dataUrl = `data:${mimeType};base64,${imageBase64}`;

    const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...modelParams("smart", 4000, "low"),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: dataUrl, detail: "high" },
              },
              {
                type: "text",
                text: `זהו תלוש שכר ישראלי. חלץ את השדות הבאים והחזר JSON בלבד ללא הסברים נוספים.
אם ערך אינו מופיע, השתמש ב-null.

{
  "grossPay": <שכר ברוטו כמספר>,
  "netPay": <שכר נטו כמספר>,
  "deductions": {
    "tax": <מס הכנסה כמספר>,
    "socialSecurity": <ביטוח לאומי כמספר>,
    "pension": <פנסיה עובד כמספר>,
    "health": <ביטוח בריאות כמספר>,
    "educationFund": <קרן השתלמות עובד כמספר>,
    "other": <ניכויים אחרים כמספר>
  }
}`,
              },
            ],
          },
        ],
      }),
    });

    if (!oaiRes.ok) {
      const err = await oaiRes.text();
      throw new Error(`OpenAI error ${oaiRes.status}: ${err}`);
    }

    const oaiJson = await oaiRes.json();
    const content: string = oaiJson.choices?.[0]?.message?.content ?? "{}";

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    let extracted: Record<string, unknown> = {};
    if (jsonMatch) {
      try {
        extracted = JSON.parse(jsonMatch[0]);
      } catch {
        console.error("Failed to parse model JSON:", jsonMatch[0]);
      }
    }

    // The image is never stored — log only a usage marker per user
    console.log(`payslip-parse-ai: user=${user.id} parsed ok`);

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("payslip-parse-ai error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
