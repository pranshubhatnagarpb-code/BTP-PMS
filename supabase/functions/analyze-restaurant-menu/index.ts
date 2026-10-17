// Restaurant Menu Analyzer Edge Function
//
// IMPORTANT — MANUAL SETUP REQUIRED:
// You must set the OPENAI_API_KEY secret in your Supabase project before this
// function will work. In the Supabase dashboard: Project Settings → Edge
// Functions → Secrets, add:
//   OPENAI_API_KEY = sk-...your OpenAI API key...
//
// Accepts JSON { restaurantName: string, images: string[] } where each entry
// is a data URL (data:<mime>;base64,...) of a menu photo or a menu PDF. Returns the
// healthy-option picks from that menu plus a ready-to-copy-paste summary
// message for clinic staff to send to a client. Never invents dishes that
// aren't actually on the menu.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_FILES = 20;

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    healthyOptions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          description: { type: ["string", "null"] },
          whyHealthy: { type: "string" },
          estimatedCalories: { type: ["string", "null"] },
        },
        required: ["name", "description", "whyHealthy", "estimatedCalories"],
      },
    },
    summaryText: { type: "string" },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: ["healthyOptions", "summaryText", "warnings"],
};

const SYSTEM_PROMPT = `You are a clinical dietitian's assistant helping clinic staff quickly find
healthy options on a restaurant's menu, to recommend to weight-management clients.

You will receive one or more photos and/or PDFs of the SAME restaurant's menu
(possibly multiple pages). Read all of them as one combined menu.

CRITICAL RULES:
- ONLY select dishes that are actually printed on the menu. Never invent, guess, or add a dish that isn't visible.
- Prefer dishes that are grilled/steamed/baked/tandoori/roasted over deep-fried; higher protein or fiber; lower refined carbs and added sugar; not swimming in cream/butter/heavy sauce; reasonable portion framing (e.g. "small", "single").
- If the menu has no genuinely healthy options, return an empty healthyOptions array rather than stretching the definition.
- "whyHealthy" is one short sentence a dietitian would actually say to a client (e.g. "Grilled, high protein, no added sugar").
- "estimatedCalories" is a rough per-serving estimate if you can reasonably infer it from the dish description, otherwise null. Never present it as a precise/measured value.
- Note anything you couldn't read clearly (blurry photo, cut-off page, unreadable PDF page, etc.) in "warnings".

"summaryText" must be a clean, plain-text message (NO markdown, NO asterisks/hashes)
that clinic staff can copy and paste directly into WhatsApp/SMS to a client. Format:
- First line: the restaurant name followed by "— Healthy Picks"
- Then each healthy option as "• <name> — <whyHealthy>" on its own line
- End with one short, warm closing line (e.g. a portion-size or ordering tip)
If healthyOptions is empty, summaryText should say so plainly and suggest asking the client to check with the clinic before ordering there.

Return strictly the JSON matching the provided schema.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({
          error: "OPENAI_API_KEY is not configured. Set it in Supabase → Edge Functions → Secrets.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { restaurantName, images } = await req.json();

    if (!restaurantName || typeof restaurantName !== "string" || !restaurantName.trim()) {
      return new Response(
        JSON.stringify({ error: "Please provide the restaurant's name." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!Array.isArray(images) || images.length === 0) {
      return new Response(
        JSON.stringify({ error: "Please upload at least one photo of the menu." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (images.length > MAX_FILES) {
      return new Response(
        JSON.stringify({ error: `Please upload at most ${MAX_FILES} menu files at a time.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    for (const img of images) {
      if (typeof img !== "string" || !(img.startsWith("data:image/") || img.startsWith("data:application/pdf"))) {
        return new Response(
          JSON.stringify({ error: "One of the uploaded files isn't a valid image or PDF." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const userContent: Array<Record<string, unknown>> = [
      {
        type: "text",
        text: `This is the menu for "${restaurantName.trim()}" (${images.length} file${images.length > 1 ? "s" : ""} of the same menu). Identify the healthy options.`,
      },
      // PDFs go in as file parts, which gpt-4o reads directly (text and page images).
      ...images.map((url: string, i: number) =>
        url.startsWith("data:application/pdf")
          ? { type: "file", file: { filename: `menu-${i + 1}.pdf`, file_data: url } }
          : { type: "image_url", image_url: { url } }
      ),
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "restaurant_menu_analysis", strict: true, schema: RESPONSE_SCHEMA },
        },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const errorText = await response.text();
      console.error("OpenAI error:", response.status, errorText);
      let detail = "";
      try {
        detail = JSON.parse(errorText)?.error?.message ?? "";
      } catch { /* non-JSON error body */ }
      throw new Error(`AI request failed (${response.status})${detail ? `: ${detail}` : ""}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content in AI response");

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse menu analysis from AI response");
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-restaurant-menu error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
