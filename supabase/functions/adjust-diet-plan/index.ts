// Diet Plan Target Adjuster Edge Function
//
// IMPORTANT — MANUAL SETUP REQUIRED:
// Uses the same OPENAI_API_KEY secret as the other AI functions
// (Supabase dashboard → Project Settings → Edge Functions → Secrets).
//
// Accepts JSON { dayGroups, analysis, targets, servingSize?, dietPreference? }:
//   dayGroups — the chart as [{ label, meals: [{ period, time, foodPlan, alternative }] }]
//   analysis  — measured per-meal estimates and per-day totals for those meals
//               (from analyze-diet-macros, summed by the app)
//   targets   — the client's daily calorie / macro targets as text
// Returns the same chart with portions changed or items added so each day lands
// within the targets, plus a short list of what changed. The AI can't sum its own
// portions reliably while writing a plan, so it is given measured numbers here.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    dayGroups: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          // The model's own accounting of what it added or removed for the day;
          // asking for it makes the changes add up to the gap instead of overshooting.
          addedCalories: { type: "number" },
          addedProteinG: { type: "number" },
          addedFatG: { type: "number" },
          meals: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                period: { type: "string" },
                foodPlan: { type: "string" },
                alternative: { type: "string" },
              },
              required: ["period", "foodPlan", "alternative"],
            },
          },
        },
        required: ["label", "addedCalories", "addedProteinG", "addedFatG", "meals"],
      },
    },
    changes: { type: "array", items: { type: "string" } },
  },
  required: ["dayGroups", "changes"],
};

const SYSTEM_PROMPT = `You are an expert Indian dietitian adjusting an existing diet chart so that each day meets
the client's calorie and macro targets.

You get the chart, the client's daily targets, and MEASURED estimates: calories and protein for every
meal and each day's totals. Trust these measurements over your own intuition — they show how far each
day is from the targets.

RULES:
- Return EVERY day and EVERY meal, in the same order, with the same "period" for each meal.
  Do not add, remove or reorder meals.
- Keep the dietitian's dishes and style. Prefer changing quantities (e.g. "2 roti" -> "3 roti",
  "1 katori dal" -> "1 bowl dal", "50 g paneer" -> "100 g paneer") and adding items to a meal
  (e.g. "+ 1 katori curd", "+ 2 boiled eggs", "+ 30 g roasted chana") over replacing dishes.
- Respect the diet preference strictly: vegetarian = no eggs, meat, chicken or fish; eggetarian = eggs
  allowed but no meat, chicken or fish; vegan = no meat, fish, eggs or dairy (no paneer, curd, milk, ghee).
- Close calorie gaps mostly in the main meals (roti, rice, dal, fruit, milk).
- Close protein gaps with LEAN protein when fat is on target or high: soya chunks, dal, chana, rajma,
  sprouts, low-fat curd / hung curd, tofu, skimmed milk (egg whites, chicken breast, fish if allowed).
  Paneer, nuts, nut butters, seeds, cheese and ghee are high in fat — use them only when fat also needs to go up.
- Each day comes with the GAP to close (e.g. "Calories: add ~240 kcal · Protein: add ~46 g · Fat: on target").
  Make the SMALLEST changes that close that gap — do not overshoot. Measures marked "on target" must stay
  roughly where they are. Days marked "fully on target" must be returned unchanged.
- Keep count: estimate the calories, protein and fat of every quantity you add or remove
  (e.g. +100 g paneer ≈ +265 kcal, +18 g protein, +21 g fat; +1 roti ≈ +100 kcal, +3 g protein, +1 g fat)
  and report each day's net change in "addedCalories", "addedProteinG" and "addedFatG".
  These must be within about 10% of the day's gap (0 for a day that is fully on target).
- SMALL GAPS NEED SMALL FIXES: when a day's calorie gap is under ~15% of its measured calories, change
  at most 2-3 items that day. Never halve whole meals or shrink every meal at once.
- To cut fat without losing calories or protein, swap a high-fat item for a leaner one of similar size
  (e.g. paneer tikka -> soya chunks, peanut butter -> roasted chana, paratha -> roti) instead of shrinking meals.
- A day is on target only when calories, protein AND fat are all within their ranges. Fix every
  measure that is off (e.g. raise protein while trimming fat by swapping ghee/fried items for lean protein).
- If a day is ABOVE the targets, reduce portions instead.
- A day that is fully on target: return its meals unchanged.
- Never add supplements (protein powder, whey, capsules, etc.), not even "if allowed" — the dietitian
  prescribes those. Use whole foods only.
- Adjust each "alternative" the same way so it matches its main meal. Keep an empty alternative empty.
- Write only meal names with quantities — no recipes or cooking steps.
- Aim for the middle of each target range.
- "changes": 2-6 short bullet points of what you changed and why, with the estimate
  (e.g. "Monday & Thursday lunch: 2 → 3 roti and + 1 katori soya chunks curry (≈ +250 kcal, +20 g protein)").

Return strictly the JSON matching the provided schema.`;

// Foods each diet preference rules out. Checked on what the AI ADDS, so a dish
// the dietitian already wrote is never flagged.
const MEAT = ["chicken", "fish", "mutton", "meat", "keema", "prawns?", "shrimps?", "tuna", "salmon", "lamb", "pork", "beef"];
const EGG = ["eggs?", "omelettes?", "anda"];
const DAIRY = ["paneer", "curd", "dahi", "(?<!(?:almond|soy|soya|oat|coconut|rice|peanut|cashew)\\s)milk", "ghee", "yogh?urt", "cheese", "buttermilk", "chaas", "lassi", "raita", "(?<!peanut\\s|almond\\s)butter", "khoa", "whey"];
// Supplements are the dietitian's call, whatever the diet preference.
const SUPPLEMENTS = ["whey", "protein powder", "protein shake", "protein bar", "supplements?", "capsules?", "tablets?", "scoops?"];
const FORBIDDEN: Record<string, string[]> = {
  vegetarian: [...MEAT, ...EGG, ...SUPPLEMENTS],
  eggetarian: [...MEAT, ...SUPPLEMENTS],
  vegan: [...MEAT, ...EGG, ...DAIRY, ...SUPPLEMENTS],
};

const findTerms = (text: string, terms: string[]) =>
  terms.filter((t) => new RegExp(`\\b${t}\\b`, "i").test(text)).map((t) => t.replace(/\(\?<!.*?\)|\\b|s\?$|\?/g, ""));

// Meals where the AI introduced a food the diet preference rules out.
const dietViolations = (
  before: { meals: MealIn[] }[],
  after: { label: string; meals: { period: string; foodPlan: string; alternative: string }[] }[],
  preference?: string,
) => {
  const terms = FORBIDDEN[preference?.toLowerCase() ?? ""] ?? SUPPLEMENTS;
  const problems: string[] = [];
  after.forEach((day, i) => day.meals.forEach((meal, j) => {
    const original = `${before[i]?.meals[j]?.foodPlan ?? ""} ${before[i]?.meals[j]?.alternative ?? ""}`;
    const added = findTerms(`${meal.foodPlan} ${meal.alternative}`, terms).filter((t) => !findTerms(original, terms).includes(t));
    if (added.length) problems.push(`${day.label} — ${meal.period}: contains ${added.join(", ")}`);
  }));
  return problems;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface MealIn { period: string; time?: string; foodPlan: string; alternative?: string }
interface MealEstimate { period: string; calories: number; protein_g: number }
interface DayAnalysis {
  label: string;
  totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number };
  meals: MealEstimate[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return json({ error: "OPENAI_API_KEY is not configured. Set it in Supabase → Edge Functions → Secrets." }, 500);
    }

    const { dayGroups, analysis, gaps, targets, servingSize, dietPreference }: {
      dayGroups: { label: string; meals: MealIn[] }[];
      analysis: DayAnalysis[];
      gaps?: string[];
      targets: string;
      servingSize?: string;
      dietPreference?: string;
    } = await req.json();

    if (!Array.isArray(dayGroups) || dayGroups.length === 0) return json({ error: "The diet chart has no meals." }, 400);
    if (!targets) return json({ error: "Client targets are required to adjust the plan." }, 400);

    const chartText = dayGroups.map((d, i) => {
      const a = analysis?.[i];
      const header = a
        ? `## ${d.label} — measured: ${Math.round(a.totals.calories)} kcal, protein ${Math.round(a.totals.protein_g)} g, carbs ${Math.round(a.totals.carbs_g)} g, fat ${Math.round(a.totals.fat_g)} g, fibre ${Math.round(a.totals.fiber_g)} g` +
          (gaps?.[i] ? `\nGAP: ${gaps[i]}` : "")
        : `## ${d.label}`;
      const lines = d.meals.map((m, j) => {
        const est = a?.meals?.[j];
        return `- ${m.period}: ${m.foodPlan}` +
          (est ? `  [measured ~${Math.round(est.calories)} kcal, ${Math.round(est.protein_g)} g protein]` : "") +
          `\n  alternative: ${m.alternative?.trim() || "(none)"}`;
      });
      return `${header}\n${lines.join("\n")}`;
    }).join("\n\n");

    const userText = [
      `Client's daily targets:\n${targets}`,
      dietPreference ? `Diet preference: ${dietPreference}` : "",
      servingSize ? `Serving-size guide: ${servingSize}` : "",
      `Current chart with measured nutrition:\n\n${chartText}`,
    ].filter(Boolean).join("\n\n");

    const messages: { role: string; content: string }[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userText },
    ];

    // Second attempt only when the first broke the diet preference.
    let result;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          temperature: 0.3,
          messages,
          response_format: {
            type: "json_schema",
            json_schema: { name: "diet_plan_adjustment", strict: true, schema: RESPONSE_SCHEMA },
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

      try {
        result = JSON.parse(content);
      } catch {
        console.error("Failed to parse AI response:", content);
        throw new Error("Failed to parse the adjusted plan from AI response");
      }

      // Only usable if the shape matches the chart that was sent.
      const sameShape = result.dayGroups?.length === dayGroups.length &&
        result.dayGroups.every((g: { meals: unknown[] }, i: number) => g.meals?.length === dayGroups[i].meals.length);
      if (!sameShape) throw new Error("The AI changed the chart's structure; please try again.");

      const violations = dietViolations(dayGroups, result.dayGroups, dietPreference);
      if (violations.length === 0) break;
      console.warn(`adjust-diet-plan: attempt ${attempt} broke the ${dietPreference} preference:`, violations);
      if (attempt === 2) {
        throw new Error(`The AI kept adding foods that aren't allowed (${violations.join("; ")}). Please try again.`);
      }
      messages.push(
        { role: "assistant", content },
        {
          role: "user",
          content: `These meals add foods that aren't allowed (supplements, or foods outside the client's ${dietPreference || "diet"} preference):\n${violations.join("\n")}\n` +
            `Replace them with allowed whole foods that give similar calories and protein, and return the full chart again.`,
        },
      );
    }

    return json(result);
  } catch (error) {
    console.error("adjust-diet-plan error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
