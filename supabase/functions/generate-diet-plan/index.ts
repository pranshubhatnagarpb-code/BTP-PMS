import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ClientDetails {
  name: string;
  goal: 'weight_loss' | 'weight_gain' | 'maintain' | 'muscle_building' | 'disease_management';
  height: number;
  weight: number;
  age: number;
  gender: 'male' | 'female' | 'other';
  skinType: string;
  hairType: string;
  healthConditions: string[];
  dietPreference: 'vegetarian' | 'non-vegetarian' | 'both';
  supplements?: string;
}

// Portion measures a meal can be given in (see SERVING_UNITS in src/lib/dietPlanDocument.ts).
const SERVING_UNITS = ['bowl', 'katori', 'cup', 'glass', 'tsp', 'tbsp'];

const getDayGroupings = (numberOfDays: number) => {
  if (numberOfDays <= 1) return [{ label: "Monday", days: ["Monday"] }];
  if (numberOfDays === 2) return [
    { label: "Monday", days: ["Monday"] },
    { label: "Tuesday", days: ["Tuesday"] },
  ];
  if (numberOfDays === 3) return [
    { label: "Monday", days: ["Monday"] },
    { label: "Tuesday", days: ["Tuesday"] },
    { label: "Wednesday", days: ["Wednesday"] },
  ];
  if (numberOfDays === 4) return [
    { label: "Monday & Thursday", days: ["Monday", "Thursday"] },
    { label: "Tuesday", days: ["Tuesday"] },
    { label: "Wednesday", days: ["Wednesday"] },
    { label: "Friday", days: ["Friday"] },
  ];
  if (numberOfDays === 5) return [
    { label: "Monday & Thursday", days: ["Monday", "Thursday"] },
    { label: "Tuesday & Friday", days: ["Tuesday", "Friday"] },
    { label: "Wednesday", days: ["Wednesday"] },
  ];
  if (numberOfDays === 6) return [
    { label: "Monday & Thursday", days: ["Monday", "Thursday"] },
    { label: "Tuesday & Friday", days: ["Tuesday", "Friday"] },
    { label: "Wednesday & Saturday", days: ["Wednesday", "Saturday"] },
  ];
  // 7 days (full week)
  return [
    { label: "Monday & Thursday", days: ["Monday", "Thursday"] },
    { label: "Tuesday & Friday", days: ["Tuesday", "Friday"] },
    { label: "Wednesday & Saturday", days: ["Wednesday", "Saturday"] },
    { label: "Sunday", days: ["Sunday"] },
  ];
};

const getDayGroupingsFlat = (numberOfDays: number, startDate?: string) => {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const start = startDate ? new Date(startDate) : new Date();
  return Array.from({ length: numberOfDays }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const label = dayNames[date.getDay()];
    return { label, days: [label] };
  });
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientDetails, customPrompt, numberOfDays = 7, useDayGrouping = true, startDate, includeAlternatives: includeAlternativesRequested = true, bloodReportAnalysis, nutritionTargets, menuStyle = 'days', fastDay }: { clientDetails: ClientDetails; customPrompt?: string; numberOfDays?: number; useDayGrouping?: boolean; startDate?: string; includeAlternatives?: boolean; bloodReportAnalysis?: string; nutritionTargets?: string; menuStyle?: 'days' | 'weekly'; fastDay?: string } = await req.json();

    // 'weekly': one menu for the whole week, each meal giving several options
    // labelled by frequency / day and separated by OR (the clinic's format).
    const weekly = menuStyle === 'weekly';
    // Weekly menus carry their options inside foodPlan, so no separate alternative.
    const includeAlternatives = weekly ? false : includeAlternativesRequested;
    const fastDayName = typeof fastDay === 'string' ? fastDay.trim() : '';
    const fastDayShort = fastDayName.slice(0, 3).toUpperCase();

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    // Every goal the client form offers; an unknown one is passed through as-is
    // rather than becoming "undefined" in the prompt.
    const goalText = {
      weight_loss: "weight loss / fat loss (calorie deficit, high protein)",
      weight_gain: "healthy weight gain (calorie surplus)",
      maintain: "weight maintenance",
      muscle_building: "muscle building (calorie surplus with high protein, to support strength training)",
      disease_management: "disease management (meals shaped around the health conditions below)",
    }[clientDetails.goal] ?? clientDetails.goal;

    const dayGroups = weekly
      ? [{ label: "Weekly menu", days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] }]
      : useDayGrouping ? getDayGroupings(numberOfDays) : getDayGroupingsFlat(numberOfDays, startDate);
    const groupDescriptions = weekly
      ? `- ONE group labelled "Weekly menu": a single menu for the whole week, with options per meal as described below`
      : useDayGrouping
        ? dayGroups.map((g, i) => `- Group ${i + 1}: ${g.label} (same meals for all days in this group)`).join('\n')
        : dayGroups.map((g) => `- ${g.label} (unique meals, different from all other days)`).join('\n');
    const altField = includeAlternatives ? '"alternative": "Alternative option with quantities"' : '"alternative": ""';
    const altDot = includeAlternatives ? '"alternative": "..."' : '"alternative": ""';
    const groupJsonExamples = dayGroups.map((g, i) => {
      if (i === 0) {
        return `    {
      "label": "${g.label}",
      "meals": [
        { "period": "Upon waking up", "time": "7:00 AM", "foodPlan": "Specific food with quantities", ${altField}, "notes": "", "servingUnit": "", "servingQty": 0, "estimatedCalories": 0, "estimatedProteinG": 0 },
        { "period": "Breakfast", "time": "9:00 AM", "foodPlan": "Vegetable poha", ${altDot}, "notes": "", "servingUnit": "bowl", "servingQty": 1 },
        { "period": "Mid Morning", "time": "10:30 AM", "foodPlan": "...", ${altDot}, "notes": "" },
        { "period": "Lunch", "time": "1:00 PM", "foodPlan": "...", ${altDot}, "notes": "" },
        { "period": "Evening Snack", "time": "5:00 PM", "foodPlan": "...", ${altDot}, "notes": "" },
        { "period": "Dinner", "time": "7:30 PM", "foodPlan": "...", ${altDot}, "notes": "" },
        { "period": "Bedtime", "time": "9:30 PM", "foodPlan": "...", ${altDot}, "notes": "" }
      ]
    }`;
      }
      return `    { "label": "${g.label}", "meals": [...] }`;
    }).join(',\n');

    const weeklyInstruction = `The plan is ONE weekly menu, written the way this clinic writes its plans:
- Breakfast, lunch, dinner and the evening snack: give 3-6 options in "foodPlan", one option per line, with a line containing only OR between options.
  Start each option with a label in CAPITALS saying how often or when it is had, followed by a colon — e.g. "2/WEEK:", "1/WEEK:", "1/WEEK (compulsory):", "MON-WED-FRI:", "SUN:".
  A meal's options should add up to about 7 times a week. Mark options the client must not skip with "(compulsory)" (e.g. green leafy vegetables, cruciferous vegetables).
- Items had with every option of a meal (e.g. a cup of herbal tea with breakfast) go first in "foodPlan", followed by a line containing only "+".
- Simple meals (on rising, pre/post-workout, mid-morning, pre-lunch water, bedtime) can be a single option without a label.
${fastDayName ? `- The client fasts on ${fastDayName}. For breakfast, lunch and dinner include one option labelled "ON ${fastDayShort}:" with fasting-friendly food (sama rice, rajgira, sweet potato, curd, fruit, nuts; sabudana only in moderation).\n` : ''}- Write portions inside each option; set "servingUnit": "" and "servingQty": 0, and leave "alternative" as "".
- Example "foodPlan" for lunch: "2/WEEK: 1 bowl koshimbir + 1 bowl dal (low oil) + 3/4 bowl rice + 1 glass buttermilk\\nOR\\n1/WEEK (compulsory): 1 bowl kachumber + 1 bowl green leafy vegetable subji + 1 roti + 1 katori curd\\nOR\\n2/WEEK: 1 bowl kachumber + 1 bowl chicken curry (100 g chicken) + 1 bowl rice${fastDayName ? `\\nOR\\nON ${fastDayShort}: 1 bowl sama khichdi + 1 bowl vrat ki kadhi` : ''}"
- "estimatedCalories" / "estimatedProteinG": estimate for one typical option of the meal; every option should fit the meal's budget.`;

    const groupingInstruction = weekly
      ? weeklyInstruction
      : useDayGrouping
        ? `The plan uses grouped days — days within a group share the same meals. Each GROUP must have DIFFERENT meals from the other groups to provide variety.`
        : `The plan uses individual days — EVERY day must have COMPLETELY UNIQUE meals. No two days should share the same breakfast, lunch, or dinner. Maximize variety across all ${numberOfDays} days.`;

    const systemPrompt = `You are an expert Indian nutritionist and dietitian specializing in holistic nutrition. Create a detailed, time-based lifestyle plan with authentic Indian meals.

CRITICAL STRUCTURE: The plan must be organized as follows:
${groupDescriptions}

${groupingInstruction}${weekly ? '' : ' Do NOT use "OR" options - give ONE specific meal per period (unless the nutritionist\'s instructions say otherwise).'} ${weekly ? '' : includeAlternatives ? 'For EVERY meal period, also provide ONE alternative option that the client can swap in if they don\'t like the primary option. The alternative should be a completely different dish that serves the same nutritional purpose.' : 'Do NOT provide alternative meals — leave the "alternative" field empty for every meal. The nutritionist has specified exact meals in the instructions.'}

Your response must be a valid JSON object with exactly this structure:
{
  "planName": "Lifestyle Plan for [Client Name]",
  "introMessage": "A personalized 2-3 sentence message about the lifestyle plan.",
  "affirmations": ["3 positive health affirmations"],
  "dayGroups": [
${groupJsonExamples}
  ],
  "servingSize": "1 bowl is 250ml, 1 katori 100ml",
  "oilGuidelines": {
    "cooking": {
      "groupA": ["oil names - 2 tsp each"],
      "groupB": ["oil names - 1-2 tsp each"]
    },
    "raw": ["oils for topping/salads - 1 tsp each"],
    "deepFrying": ["high smoke point oils for occasional use"],
    "note": "All oils must be unrefined/cold pressed. Total should not exceed 4-5 tsp a day."
  },
  "importantNotes": ["List of 3-5 important dietary notes"],
  "disclaimer": "Standard nutrition coaching disclaimer",
  "skinCareTips": "Tips based on skin type",
  "hairCareTips": "Tips based on hair type",
  "healthNotes": "Notes for health conditions",
  "weeklyGroceryList": [
    { "category": "Vegetables", "items": ["Spinach - 500g", "Tomatoes - 1kg", "Onions - 1kg"] },
    { "category": "Fruits", "items": ["Banana - 6 pcs", "Apple - 4 pcs"] },
    { "category": "Grains & Pulses", "items": ["Brown rice - 1kg", "Moong dal - 500g"] },
    { "category": "Dairy", "items": ["Curd - 1kg", "Paneer - 200g"] },
    { "category": "Spices & Condiments", "items": ["Haldi powder", "Jeera"] },
    { "category": "Others", "items": ["Jaggery - 200g", "Honey - 1 bottle"] }
  ]
}

CRITICAL FORMATTING RULE FOR foodPlan, alternative, AND notes FIELDS:
- Write ONLY the meal name with quantities. Example: "2 roti with 1 bowl dal" or "1 cup oats porridge with banana"
- Do NOT add recipe steps, cooking methods, or preparation details inside parentheses or brackets
- Do NOT write things like "Oats porridge (boil 1 cup oats in milk, add banana)" — the parenthetical recipe is FORBIDDEN
- "servingUnit" / "servingQty" — the portion of a single-dish meal or drink, in one of the clinic's measures:
  "bowl" (250 ml), "katori" (100 ml), "cup" (150 ml), "glass" (250 ml), "tsp" (teaspoon) or "tbsp" (tablespoon).
  e.g. poha, upma, khichdi, oats, dalia, soup, dal, curd, sprouts, fruit bowl → "bowl" or "katori";
  tea, coffee, milk → "cup"; buttermilk, juice, coconut water, lemon water → "glass"; seeds, ghee, chia → "tsp" or "tbsp".
  "servingQty" is 1, 2 or 3. Leave that measure out of "foodPlan" (write "Vegetable poha", not "1 bowl vegetable poha").
  For meals of several items (e.g. "2 roti with 1 katori dal and 1 katori sabzi") or pieces (eggs, fruit, roti), keep the quantities in "foodPlan" and set "servingUnit": "" and "servingQty": 0.
- "notes": output an empty string "" for every meal unless the nutritionist's instructions ask for notes. Do NOT put recipes, cooking tips, timing tips, or any other remarks there — the nutritionist fills this in manually while editing. Never generate any text for this field.

CALORIES AND MACROS — IMPORTANT (after the nutritionist's instructions, which always come first):
- When daily nutrition targets are given in the client profile, EVERY day's meals must add up to within those ranges.
  Size portions to fit: more rotis, rice, dal, paneer, eggs, chicken, curd, milk, nuts, fruit for higher targets; smaller portions for lower targets.
- Budget roughly: breakfast 20-25%, lunch 25-30%, dinner 20-25% of the day's calories, with the rest across snacks and drinks.
- Spread protein across meals (about 20-40 g in each main meal for high-protein goals). Use the diet preference for protein sources:
  vegetarian — paneer, tofu, curd/Greek yoghurt, milk, dal, chana, rajma, soya chunks, sprouts; non-vegetarian can add eggs, chicken, fish.
- Do NOT write a low-calorie, weight-loss style plan for weight gain or muscle building goals.
- Follow the per-meal budget when one is given. A 600-700 kcal meal needs real portions (e.g. 3 rotis + 1 bowl dal + 100 g paneer sabzi + curd), not a light snack-sized plate.
- For EVERY meal also fill "estimatedCalories" and "estimatedProteinG" with your honest estimate for the portions written.
  Before answering, add these up for each day; if a day is outside the target range, enlarge or add items and re-estimate.

Focus on:
- Authentic Indian cuisine with variety (North & South Indian)
- Practical, easily available ingredients with exact quantities
- Include traditional superfoods (haldi, methi, amla, moringa, ashwagandha etc.)
${weekly
  ? '- Several labelled options per main meal, separated by OR lines, as described in the weekly menu instructions\n- Variety across the options of each meal'
  : `- ONE specific meal per period (no OR options)${includeAlternatives ? ' with ONE alternative option for each meal — a completely different dish (not a variation) that serves the same nutritional purpose' : ' — no alternative meals, leave "alternative" field empty'}\n- Different meals across day-groups for variety`}
- Leave every meal's "notes" field as an empty string "" unless the nutritionist's instructions ask for notes
- Proper hydration guidance
- Keep the plan concise enough to fit in 2 pages when printed
- Weekly grocery list with items easily available in Indian markets (local sabzi mandi, kirana stores)
- Categorize grocery items (Vegetables, Fruits, Grains & Pulses, Dairy, Spices & Condiments, Others)
- Include approximate quantities needed for the week`;

    const groupLabels = dayGroups.map(g => g.label).join(', ');

    const instructions = typeof customPrompt === 'string' ? customPrompt.trim() : '';

    // The nutritionist's own instructions outrank everything else in both prompts.
    const priorityRules = instructions
      ? `HIGHEST PRIORITY — THE NUTRITIONIST'S INSTRUCTIONS:
The nutritionist has written detailed instructions for this client (in the user message under "Nutritionist's Instructions").
They override EVERYTHING else: the client profile, goal, diet preference, health conditions, skin/hair details, the calculated nutrition targets,
the blood report analysis, and every rule below (meal structure, number of meals, timings, OR options, alternatives, notes, portion sizes, calories, macros).
Wherever an instruction conflicts with anything else, follow the instruction exactly — do not soften, "balance" or second-guess it.
Use the client profile and the rules below only to fill in what the instructions do not cover.

`
      : '';

    const userPrompt = `${instructions ? `**Nutritionist's Instructions (HIGHEST PRIORITY — follow exactly; they override the client profile, targets and everything below):**\n${instructions}\n\n` : ''}Create a personalized detailed lifestyle plan for:

**Client Profile:**
- Name: ${clientDetails.name}
- Goal: ${goalText}
- Height: ${clientDetails.height} cm
- Weight: ${clientDetails.weight} kg
- Age: ${clientDetails.age} years
- Gender: ${clientDetails.gender}
- Diet Preference: ${clientDetails.dietPreference}

${nutritionTargets ? `**Daily Nutrition Targets (calculated from the client profile${instructions ? " — use them only where the nutritionist's instructions do not say otherwise" : ' — the meals must meet these'}):**\n${nutritionTargets}\n\n` : ''}**Skin & Hair:**
- Skin Type: ${clientDetails.skinType}
- Hair Type: ${clientDetails.hairType}

**Health Conditions/Concerns:**
${clientDetails.healthConditions.length > 0 ? clientDetails.healthConditions.join(', ') : 'None specified'}
${clientDetails.supplements?.trim() ? `\n**Supplements prescribed by the nutritionist (already decided, do not change or add to them):**\n${clientDetails.supplements.trim()}\nKeep meals compatible with these (e.g. lime water or vitamin C with iron on rising).\n` : ''}
${bloodReportAnalysis ? `\n**Blood Report Analysis (reviewed by the nutritionist):**\n${bloodReportAnalysis.slice(0, 4000)}\n\nShape the meals around these findings: follow the nutrition priorities, favour the foods to include, and avoid or minimise the foods to limit. Mention how the plan addresses the blood report in "healthNotes". The nutritionist's additional instructions take precedence if they conflict.\n` : ''}
${!weekly && fastDayName ? `\n**Fasting:** The client fasts on ${fastDayName}. Keep that day's meals fasting-friendly (sama rice, rajgira, sweet potato, curd, fruit, nuts; sabudana only in moderation).\n` : ''}

${weekly
  ? `Create a comprehensive lifestyle plan as ONE weekly menu (group "Weekly menu") followed for ${numberOfDays} days${fastDayName ? `, with fasting options for ${fastDayName}` : ''}.`
  : `Create a comprehensive lifestyle plan covering ${numberOfDays} days (${groupLabels})${useDayGrouping ? ', with grouped days sharing the same meals' : ', with every day having fully unique meals'}.`} Include oil guidelines and important dietary notes.${instructions ? `\n\nBefore answering, go through the Nutritionist's Instructions at the top one by one and make sure the plan follows every one of them exactly — they take priority over the client profile and all other guidance.` : ''}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // gpt-4o: gpt-4o-mini didn't size portions to the calorie / protein targets reliably.
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: priorityRules + systemPrompt + "\nReturn only valid JSON." },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    let dietPlan;
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;
      dietPlan = JSON.parse(jsonString.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse diet plan from AI response");
    }

    // Strip alternatives if toggle is off — enforce server-side regardless of AI output
    if (!includeAlternatives && dietPlan.dayGroups) {
      dietPlan.dayGroups = dietPlan.dayGroups.map((group: any) => ({
        ...group,
        meals: (group.meals || []).map((meal: any) => ({ ...meal, alternative: '' })),
      }));
    }

    // Notes are filled in manually by the nutritionist while editing, never
    // by the AI — clear them server-side even if the model ignored the prompt.
    // The per-meal estimates only make the model budget portions; they aren't
    // part of the plan (the editor's AI Nutrition Analysis gives real estimates).
    if (dietPlan.dayGroups) {
      dietPlan.dayGroups = dietPlan.dayGroups.map((group: any) => ({
        ...group,
        meals: (group.meals || []).map(({ estimatedCalories: _kcal, estimatedProteinG: _protein, servingUnit, servingQty, ...meal }: any) => {
          // Only the clinic's measures with a quantity of 1-3 are valid; anything else means no portion.
          const unit = SERVING_UNITS.includes(servingUnit) ? servingUnit : '';
          const qty = Math.round(Number(servingQty));
          return { ...meal, notes: '', servingUnit: unit, servingQty: unit ? (qty >= 1 && qty <= 3 ? qty : 1) : undefined };
        }),
      }));
    }

    return new Response(
      JSON.stringify({ dietPlan }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating diet plan:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
