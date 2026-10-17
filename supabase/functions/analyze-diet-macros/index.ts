// Diet Plan Nutrition Analyzer Edge Function
//
// IMPORTANT — MANUAL SETUP REQUIRED:
// Uses the same OPENAI_API_KEY secret as the other AI functions
// (Supabase dashboard → Project Settings → Edge Functions → Secrets).
//
// Accepts JSON { days: [{ label, meals: [{ period, time, foodPlan }] }],
// servingSize?, client? } — a snapshot of the diet chart as it is in the editor.
// Returns per-meal estimates of calories, protein, carbs, fat and fiber plus
// observations for the dietitian. Daily totals are summed by the caller so the
// arithmetic is exact; the numbers themselves are AI estimates, not measurements.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_MEALS = 150;

const MEAL_ESTIMATE = {
  type: "object",
  additionalProperties: false,
  properties: {
    period: { type: "string" },
    food: { type: "string" },
    calories: { type: "number" },
    protein_g: { type: "number" },
    carbs_g: { type: "number" },
    fat_g: { type: "number" },
    fiber_g: { type: "number" },
    assumptions: { type: ["string", "null"] },
  },
  required: ["period", "food", "calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "assumptions"],
};

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    days: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          meals: { type: "array", items: MEAL_ESTIMATE },
        },
        required: ["label", "meals"],
      },
    },
    observations: { type: "array", items: { type: "string" } },
    suggestions: { type: "array", items: { type: "string" } },
  },
  required: ["days", "observations", "suggestions"],
};

const SYSTEM_PROMPT = `You are a clinical dietitian's assistant estimating the nutritional value of an
Indian weight-management diet chart that a dietitian is editing.

For EVERY meal you receive, estimate calories (kcal), protein, carbohydrates, fat and fiber (grams)
for the quantities written. Return the days and meals in the same order you received them, one
estimate per meal. Copy "period" as the meal name only (e.g. "Breakfast", without the time) and
"food" as the meal text from the input.

RULES:
- Use typical Indian home-cooked preparations and standard nutrition references (e.g. IFCT / USDA).
- Use the clinic's serving-size guide when a meal says bowl / katori / glass etc.
- If no quantity is written, assume one standard home portion and say so in "assumptions".
- Assume minimal oil for home cooking (about 1 tsp per cooked dish) unless the meal says otherwise.
- Drinks like water, green tea or black coffee without sugar are ~0.
- If a meal lists options with "or", estimate the first option and mention it in "assumptions".
- Round calories to whole numbers and grams to one decimal.
- "assumptions" is one short phrase (e.g. "1 roti ≈ 30 g atta") or null when nothing was assumed.

Then add:
- "observations": 3-6 short points on the QUALITY of the plan for the client's goal — protein sources
  and how protein is spread across meals, carb quality, fat sources, vegetables and fibre, meal timing
  around the goal, and any day that is clearly lighter or heavier than the others.
  Do NOT state daily calorie or macro totals or ranges: the app adds up your per-meal numbers and
  compares them with the client's targets itself, and your own totals would not match.
- "suggestions": 0-4 short, practical changes that suit the client's goal better
  (e.g. which meal to add paneer, eggs, curd or an extra roti to). Don't repeat observations.

Return strictly the JSON matching the provided schema.`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return json({ error: "OPENAI_API_KEY is not configured. Set it in Supabase → Edge Functions → Secrets." }, 500);
    }

    const { days, servingSize, client } = await req.json();

    if (!Array.isArray(days) || days.length === 0) {
      return json({ error: "The diet chart has no meals to analyze." }, 400);
    }
    const mealCount = days.reduce((n: number, d: { meals?: unknown[] }) => n + (Array.isArray(d?.meals) ? d.meals.length : 0), 0);
    if (mealCount === 0) return json({ error: "The diet chart has no meals to analyze." }, 400);
    if (mealCount > MAX_MEALS) return json({ error: `Too many meals to analyze at once (max ${MAX_MEALS}).` }, 400);

    const clientLines = client
      ? Object.entries(client)
          .filter(([, v]) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0))
          .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
          .join("\n")
      : "";

    const chartText = days
      .map((d: { label: string; meals: { period: string; time?: string; foodPlan: string }[] }) =>
        `## ${d.label}\n` +
        d.meals.map((m) => `- ${m.period}${m.time ? ` (${m.time})` : ""}: ${m.foodPlan}`).join("\n")
      )
      .join("\n\n");

    const userText = [
      servingSize ? `Serving-size guide: ${servingSize}` : "",
      clientLines ? `Client details:\n${clientLines}` : "",
      `Diet chart:\n\n${chartText}`,
    ].filter(Boolean).join("\n\n");

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
          { role: "user", content: userText },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "diet_macro_analysis", strict: true, schema: RESPONSE_SCHEMA },
        },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return json({ error: "Rate limit exceeded. Please try again in a moment." }, 429);
      if (response.status === 402) return json({ error: "AI credits exhausted. Please add credits to continue." }, 402);
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
      throw new Error("Failed to parse nutrition analysis from AI response");
    }

    return json(result);
  } catch (error) {
    console.error("analyze-diet-macros error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
