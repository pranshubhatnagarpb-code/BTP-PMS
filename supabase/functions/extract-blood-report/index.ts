// Blood Report Extraction Edge Function
//
// IMPORTANT — MANUAL SETUP REQUIRED:
// You must set the OPENAI_API_KEY secret in your Supabase project before this function will work.
// In the Supabase dashboard: Project Settings → Edge Functions → Secrets, add:
//   OPENAI_API_KEY = sk-...your OpenAI API key...
//
// This function accepts a multipart/form-data upload with a single "file" field
// (PDF or image). It extracts ONLY values that are actually present in the report
// using OpenAI. It must NEVER invent, guess, or fill in "ideal" / "normal" defaults.
// Missing values are returned as null.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MARKER_KEYS = [
  "hemoglobin",
  "fasting_blood_sugar",
  "postprandial_blood_sugar",
  "hba1c",
  "total_cholesterol",
  "triglycerides",
  "hdl",
  "ldl",
  "vldl",
  "vitamin_d",
  "vitamin_b12",
  "tsh",
  "uric_acid",
  "creatinine",
  "iron",
  "ferritin",
  "calcium",
] as const;

const MARKER_PROPERTIES = MARKER_KEYS.reduce((acc, key) => {
  acc[key] = {
    type: "object",
    additionalProperties: false,
    properties: {
      value: { type: ["number", "null"] },
      unit: { type: ["string", "null"] },
      reference_range: { type: ["string", "null"] },
      status: {
        type: ["string", "null"],
        enum: ["low", "normal", "high", null],
      },
    },
    required: ["value", "unit", "reference_range", "status"],
  };
  return acc;
}, {} as Record<string, unknown>);

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    reportDate: { type: ["string", "null"] },
    labName: { type: ["string", "null"] },
    notes: { type: ["string", "null"] },
    warnings: { type: "array", items: { type: "string" } },
    markers: {
      type: "object",
      additionalProperties: false,
      properties: MARKER_PROPERTIES,
      required: [...MARKER_KEYS],
    },
  },
  required: ["reportDate", "labName", "notes", "warnings", "markers"],
};

const SYSTEM_PROMPT = `You are a clinical lab report extraction assistant.
You will receive a blood test report (as text or image). Extract ONLY values
that are explicitly present in the report.

CRITICAL RULES:
- NEVER invent, guess, infer, or fill in "ideal", "normal", or default values.
- If a biomarker is not present in the report, return value=null, unit=null, reference_range=null, status=null for it.
- NEVER derive a value from a reference range. Only use the actual measured reading.
- "status" must be set ONLY if both an actual value AND a reference range are present in the report itself, and you can clearly determine low/normal/high from them. Otherwise null.
- "reportDate" should be the collection/report date in YYYY-MM-DD if found, otherwise null.
- "labName" is the lab/clinic name if visible, otherwise null.
- Add a short string in "warnings" for any marker that appears in the report but couldn't be parsed cleanly.
- Use the units exactly as printed in the report.

Return strictly the JSON matching the provided schema.`;

const emptyMarkers = () =>
  MARKER_KEYS.reduce((acc, k) => {
    acc[k] = { value: null, unit: null, reference_range: null, status: null };
    return acc;
  }, {} as Record<string, unknown>);

const emptyResult = (warnings: string[] = []) => ({
  reportDate: null,
  labName: null,
  notes: null,
  warnings,
  markers: emptyMarkers(),
});

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  // Lightweight text extraction for text-based PDFs using unpdf (pure JS, Deno-friendly).
  try {
    const { extractText, getDocumentProxy } = await import(
      "https://esm.sh/unpdf@0.12.1"
    );
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return (text || "").trim();
  } catch (err) {
    console.warn("PDF text extraction failed:", err);
    return "";
  }
}

async function callOpenAI(
  payloadMessages: Array<Record<string, unknown>>,
  apiKey: string,
): Promise<Record<string, unknown>> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o", // vision-capable, supports json_schema
      temperature: 0,
      messages: payloadMessages,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "blood_report_extraction",
          strict: true,
          schema: RESPONSE_SCHEMA,
        },
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("OpenAI error:", res.status, errText);
    throw new Error(`OpenAI request failed: ${res.status}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned empty content");
  try {
    return JSON.parse(content);
  } catch {
    throw new Error("OpenAI response was not valid JSON");
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Read OPENAI_API_KEY from Supabase Edge Function secrets.
    // MUST be set manually in the Supabase dashboard (see file header).
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({
          error:
            "OPENAI_API_KEY is not configured. Set it in Supabase → Edge Functions → Secrets.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return new Response(
        JSON.stringify({ error: "No file uploaded under 'file' field." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    const isImage = file.type.startsWith("image/");

    let messages: Array<Record<string, unknown>>;

    if (isPdf) {
      const text = await extractPdfText(bytes);
      if (text && text.length > 80) {
        // Text-based PDF: send extracted text to OpenAI.
        messages = [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Extract biomarkers from the following blood report text. Remember: only return values that are actually present.\n\n---\n${text}\n---`,
          },
        ];
      } else {
        // Scanned PDF with no usable text — we cannot rasterize PDFs cheaply
        // in the Edge runtime, so ask the caller to upload page images instead.
        return new Response(
          JSON.stringify(
            emptyResult([
              "This PDF appears to be scanned and contains no extractable text. Please export the report pages as images (JPG/PNG) and upload them, or upload a text-based PDF.",
            ]),
          ),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    } else if (isImage) {
      const base64 = bytesToBase64(bytes);
      const mime = file.type || "image/jpeg";
      messages = [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Extract biomarkers from this blood report image. Only return values actually visible in the image.",
            },
            {
              type: "image_url",
              image_url: { url: `data:${mime};base64,${base64}` },
            },
          ],
        },
      ];
    } else {
      return new Response(
        JSON.stringify({ error: "Unsupported file type. Upload PDF or image." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const result = await callOpenAI(messages, OPENAI_API_KEY);

    // Defensive: ensure all marker keys are present even if model omitted any.
    const markers = (result.markers as Record<string, unknown>) || {};
    const normalizedMarkers = MARKER_KEYS.reduce((acc, k) => {
      const m = (markers[k] as Record<string, unknown>) || {};
      acc[k] = {
        value: typeof m.value === "number" ? m.value : null,
        unit: typeof m.unit === "string" && m.unit.trim() ? m.unit : null,
        reference_range:
          typeof m.reference_range === "string" && m.reference_range.trim()
            ? m.reference_range
            : null,
        status:
          m.status === "low" || m.status === "normal" || m.status === "high"
            ? m.status
            : null,
      };
      return acc;
    }, {} as Record<string, unknown>);

    return new Response(
      JSON.stringify({
        reportDate: (result.reportDate as string) ?? null,
        labName: (result.labName as string) ?? null,
        notes: (result.notes as string) ?? null,
        warnings: Array.isArray(result.warnings)
          ? (result.warnings as string[])
          : [],
        markers: normalizedMarkers,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("extract-blood-report error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
