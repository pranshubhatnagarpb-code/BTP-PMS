// Blood Report AI Analysis Edge Function
//
// Requires the OPENAI_API_KEY secret (Supabase → Edge Functions → Secrets),
// the same one used by extract-blood-report and generate-diet-plan.
//
// Accepts JSON: the report's recorded markers (with the reference ranges the
// app uses), the previous report's values for trend context, and a short
// client profile. Returns a structured, nutrition-focused interpretation that
// the nutritionist reviews and can feed into diet plan generation.
// Only markers that were actually recorded are analysed — nothing is invented.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface MarkerInput {
  label: string;
  unit: string;
  value: number;
  referenceRange: string | null;
  status: "low" | "normal" | "high" | "unknown";
  previousValue?: number | null;
}

interface AnalyzeRequest {
  reportDate: string;
  previousReportDate?: string | null;
  markers: MarkerInput[];
  notes?: string | null;
  client?: {
    age?: number | null;
    gender?: string | null;
    goal?: string | null;
    healthConditions?: string[];
    dietPreference?: string | null;
  };
}

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    overallConcern: { type: "string", enum: ["low", "moderate", "high"] },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          marker: { type: "string" },
          value: { type: "string" },
          status: { type: "string", enum: ["low", "borderline", "normal", "high"] },
          interpretation: { type: "string" },
          trend: { type: ["string", "null"] },
        },
        required: ["marker", "value", "status", "interpretation", "trend"],
      },
    },
    nutritionPriorities: { type: "array", items: { type: "string" } },
    foodsToInclude: { type: "array", items: { type: "string" } },
    foodsToLimit: { type: "array", items: { type: "string" } },
    supplementConsiderations: { type: "array", items: { type: "string" } },
    followUp: { type: "array", items: { type: "string" } },
  },
  required: [
    "summary",
    "overallConcern",
    "findings",
    "nutritionPriorities",
    "foodsToInclude",
    "foodsToLimit",
    "supplementConsiderations",
    "followUp",
  ],
};

const SYSTEM_PROMPT = `You are a clinical nutritionist assistant for an Indian weight-loss and wellness practice.
You interpret a client's blood report for the nutritionist (not the client) and translate it into dietary guidance.

RULES:
- Analyse ONLY the markers provided. Never invent values or comment on tests that were not given.
- Use the client's age and gender when judging values (e.g. hemoglobin differs for men and women); the supplied reference ranges are general adult ranges.
- Mark a value "borderline" when it is within range but close to the limit in a way that matters nutritionally.
- If a previous value is given, describe the trend briefly in "trend" (e.g. "Improved from 7.1%"); otherwise null.
- "findings": include every abnormal or borderline marker, plus normal markers only when relevant to the client's goal or conditions. Order by clinical importance.
- "summary": 2–4 sentences, plain language, for the nutritionist.
- "nutritionPriorities": 3–6 concrete dietary goals driven by the findings (e.g. "Lower glycaemic load across all meals").
- "foodsToInclude" / "foodsToLimit": specific Indian foods and ingredients, respecting the client's diet preference.
- "supplementConsiderations": only where findings justify it; phrase as considerations to discuss, not prescriptions.
- "followUp": retests or when to refer to a doctor (e.g. markedly abnormal values, suspected thyroid or kidney issues).
- Do not diagnose disease. Be concise.

Return strictly the JSON matching the provided schema.`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return json({ error: "OPENAI_API_KEY is not configured. Set it in Supabase → Edge Functions → Secrets." }, 500);
    }

    const body = (await req.json()) as AnalyzeRequest;
    const markers = Array.isArray(body.markers)
      ? body.markers.filter((m) => typeof m?.value === "number" && Number.isFinite(m.value))
      : [];
    if (markers.length === 0) {
      return json({ error: "This report has no recorded values to analyse." }, 400);
    }

    const c = body.client || {};
    const markerLines = markers
      .map((m) => {
        const range = m.referenceRange ? ` (ref ${m.referenceRange})` : "";
        const flag = m.status !== "unknown" ? ` [${m.status}]` : "";
        const prev = typeof m.previousValue === "number" ? ` — previous: ${m.previousValue} ${m.unit}` : "";
        return `- ${m.label}: ${m.value} ${m.unit}${range}${flag}${prev}`;
      })
      .join("\n");

    const userPrompt = `**Client profile**
- Age: ${c.age ?? "not specified"}
- Gender: ${c.gender || "not specified"}
- Goal: ${c.goal ? c.goal.replace(/_/g, " ") : "not specified"}
- Diet preference: ${c.dietPreference || "not specified"}
- Known health conditions: ${c.healthConditions?.length ? c.healthConditions.join(", ") : "none recorded"}

**Blood report dated ${body.reportDate}**${body.previousReportDate ? ` (previous report: ${body.previousReportDate})` : ""}
${markerLines}
${body.notes ? `\n**Nutritionist notes on the report:** ${body.notes}` : ""}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
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
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "blood_report_analysis", strict: true, schema: RESPONSE_SCHEMA },
        },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) return json({ error: "Rate limit exceeded. Please try again later." }, 429);
      const errText = await res.text();
      console.error("OpenAI error:", res.status, errText);
      throw new Error(`AI request failed: ${res.status}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content in AI response");

    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch {
      throw new Error("AI response was not valid JSON");
    }

    return json({ analysis });
  } catch (error) {
    console.error("analyze-blood-report error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
