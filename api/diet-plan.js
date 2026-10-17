// API endpoint to generate diet plans using OpenAI instead of Lovable Gemini
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const getDayGroupings = (numberOfDays, startDate) => {
  console.log('getDayGroupings called with:', { numberOfDays, startDate });
  
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const start = new Date(startDate);
  console.log('Start date object:', start);
  console.log('Start date string:', start.toDateString());
  console.log('Start date ISO:', start.toISOString());
  
  const dayGroups = [];
  
  // Generate sequential days starting from the actual start date
  for (let i = 0; i < numberOfDays; i++) {
    const currentDate = new Date(start);
    currentDate.setDate(start.getDate() + i);
    const dayName = days[currentDate.getDay()];
    const dateStr = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    dayGroups.push({
      dayName,
      date: dateStr,
      fullDate: currentDate.toISOString().split('T')[0]
    });
  }
  
  // Create day groups that respect the actual start date sequence
  // For 7-day plans, create pairs based on the actual sequence
  const pairedGroups = [];
  
  if (numberOfDays === 7) {
    // Pair days 1-4, 2-5, 3-6, and keep day 7 separate
    pairedGroups.push({
      label: `${dayGroups[0].dayName} & ${dayGroups[3].dayName}`,
      dates: `${dayGroups[0].date} & ${dayGroups[3].date}`,
      days: [dayGroups[0], dayGroups[3]]
    });
    pairedGroups.push({
      label: `${dayGroups[1].dayName} & ${dayGroups[4].dayName}`,
      dates: `${dayGroups[1].date} & ${dayGroups[4].date}`,
      days: [dayGroups[1], dayGroups[4]]
    });
    pairedGroups.push({
      label: `${dayGroups[2].dayName} & ${dayGroups[5].dayName}`,
      dates: `${dayGroups[2].date} & ${dayGroups[5].date}`,
      days: [dayGroups[2], dayGroups[5]]
    });
    pairedGroups.push({
      label: dayGroups[6].dayName,
      dates: dayGroups[6].date,
      days: [dayGroups[6]]
    });
  } else if (numberOfDays === 6) {
    // Pair days 1-4, 2-5, 3-6
    pairedGroups.push({
      label: `${dayGroups[0].dayName} & ${dayGroups[3].dayName}`,
      dates: `${dayGroups[0].date} & ${dayGroups[3].date}`,
      days: [dayGroups[0], dayGroups[3]]
    });
    pairedGroups.push({
      label: `${dayGroups[1].dayName} & ${dayGroups[4].dayName}`,
      dates: `${dayGroups[1].date} & ${dayGroups[4].date}`,
      days: [dayGroups[1], dayGroups[4]]
    });
    pairedGroups.push({
      label: `${dayGroups[2].dayName} & ${dayGroups[5].dayName}`,
      dates: `${dayGroups[2].date} & ${dayGroups[5].date}`,
      days: [dayGroups[2], dayGroups[5]]
    });
  } else if (numberOfDays === 5) {
    // Pair days 1-4, 2-5, keep day 3 separate
    pairedGroups.push({
      label: `${dayGroups[0].dayName} & ${dayGroups[3].dayName}`,
      dates: `${dayGroups[0].date} & ${dayGroups[3].date}`,
      days: [dayGroups[0], dayGroups[3]]
    });
    pairedGroups.push({
      label: `${dayGroups[1].dayName} & ${dayGroups[4].dayName}`,
      dates: `${dayGroups[1].date} & ${dayGroups[4].date}`,
      days: [dayGroups[1], dayGroups[4]]
    });
    pairedGroups.push({
      label: dayGroups[2].dayName,
      dates: dayGroups[2].date,
      days: [dayGroups[2]]
    });
  } else if (numberOfDays === 4) {
    // Pair days 1&2, keep days 3&4 separate
    pairedGroups.push({
      label: `${dayGroups[0].dayName} & ${dayGroups[3].dayName}`,
      dates: `${dayGroups[0].date} & ${dayGroups[3].date}`,
      days: [dayGroups[0], dayGroups[3]]
    });
    pairedGroups.push({
      label: dayGroups[1].dayName,
      dates: dayGroups[1].date,
      days: [dayGroups[1]]
    });
    pairedGroups.push({
      label: dayGroups[2].dayName,
      dates: dayGroups[2].date,
      days: [dayGroups[2]]
    });
  } else {
    // For other durations, create individual day groups
    for (let i = 0; i < dayGroups.length; i++) {
      pairedGroups.push({
        label: dayGroups[i].dayName,
        dates: dayGroups[i].date,
        days: [dayGroups[i]]
      });
    }
  }
  
  return pairedGroups;
};

const getDayGroupingsFlat = (numberOfDays, startDate) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const start = new Date(startDate);
  return Array.from({ length: numberOfDays }, (_, i) => {
    const currentDate = new Date(start);
    currentDate.setDate(start.getDate() + i);
    const dayName = days[currentDate.getDay()];
    const dateStr = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return {
      label: dayName,
      dates: dateStr,
      days: [{ dayName, date: dateStr, fullDate: currentDate.toISOString().split('T')[0] }],
    };
  });
};

export default async function handler(req, res) {
  // Set CORS headers for all responses
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { clientDetails, customPrompt, numberOfDays = 7, startDate, useDayGrouping = true, includeAlternatives = true } = req.body;
    
    console.log('Request body received:', { startDate, numberOfDays });
    
    if (!clientDetails) {
      return res.status(400).json({ error: 'clientDetails is required' });
    }

    const goalText = {
      weight_loss: "weight loss / fat loss",
      weight_gain: "weight gain / muscle building",
      maintain: "weight maintenance"
    }[clientDetails.goal];

    const dayGroups = useDayGrouping
      ? getDayGroupings(numberOfDays, startDate || new Date())
      : getDayGroupingsFlat(numberOfDays, startDate || new Date());
    const groupDescriptions = useDayGrouping
      ? dayGroups.map((g, i) => `- Group ${i + 1}: ${g.label} (${g.dates}) — same meals for all days in this group`).join('\n')
      : dayGroups.map((g) => `- ${g.label} (${g.dates}) — fully unique meals, different from every other day`).join('\n');
    const groupJsonExamples = dayGroups.map((g, i) => {
      return `    {
      "label": "${g.label}",
      "dates": "${g.dates}",
      "editable": true,
      "meals": [
        { "period": "Upon waking up", "time": "6:30 AM", "foodPlan": "Specific food with quantities", "alternative": "Alternative option with quantities", "notes": "" },
        { "period": "Early morning", "time": "8:00 AM", "foodPlan": "...", "alternative": "...", "notes": "" },
        { "period": "Breakfast", "time": "9:30 AM", "foodPlan": "...", "alternative": "...", "notes": "" },
        { "period": "Mid Morning", "time": "11:00 AM", "foodPlan": "...", "alternative": "...", "notes": "" },
        { "period": "Lunch", "time": "1:30 PM", "foodPlan": "...", "alternative": "...", "notes": "" },
        { "period": "Evening Snack", "time": "5:00 PM", "foodPlan": "...", "alternative": "...", "notes": "" },
        { "period": "Dinner", "time": "8:00 PM", "foodPlan": "...", "alternative": "...", "notes": "" },
        { "period": "Bedtime", "time": "10:00 PM", "foodPlan": "...", "alternative": "...", "notes": "" }
      ]
    }`;
    }).join(',\n');

    const systemPrompt = `You are an expert Indian nutritionist and dietitian specializing in holistic nutrition with deep knowledge of regional cuisines and dietary restrictions. Create a highly personalized, time-based lifestyle plan with authentic Indian meals.

CRITICAL DIETARY RESTRICTION ENFORCEMENT:
- If client specifies "no wheat" - ABSOLUTELY NO wheat, maida, sooji, rava. Use creative alternatives: ragi, jowar, bajra, quinoa, brown rice, oats, buckwheat, amaranth
- If "no dairy" - NO milk, curd, paneer, ghee, cheese. Use alternatives: almond milk, coconut milk, tofu, nut curd, plant-based ghee
- If "no sugar" - NO white sugar, jaggery, honey, maple. Use alternatives: stevia, monk fruit, dates, figs naturally
- If "vegan" - NO animal products including dairy, eggs, honey
- If "gluten-free" - NO wheat, barley, rye, oats (unless certified gluten-free)
- If "Jain" - NO root vegetables, onions, garlic
- If "no bajra" - ABSOLUTELY NO bajra in any form. Use alternatives: ragi, jowar, quinoa, brown rice, oats, buckwheat, amaranth
- If "no rice" - NO white rice, brown rice. Use alternatives: quinoa, millets, cauliflower rice, buckwheat.

LANGUAGE RULE:
- - Output language: ${outputLanguage}
- Default output language is English.
- Use Hindi only when the user explicitly says "Generate in hindi" or "Output in hindi".
- Never switch language based on meal names, ingredients, or examples.
- If outputLanguage is Hindi, the entire diet chart must be written in Hindi using Devanagari script.
- Do not output meal names, notes, or explanations in English.
- Only allow unavoidable medical or supplement names in English if absolutely necessary.

MEAL STRUCTURE & TIMING RULES:
- The nutritionist's custom instructions define the meal structure and timing. Follow them EXACTLY and COMPLETELY.
- If custom instructions specify an eating window (e.g., "12 PM to 8 PM", "16:8 fasting", "eat between 2 PM-10 PM") — ALL meals MUST be within that window. Do NOT add any meals outside it.
- If custom instructions specify specific meal times (e.g., "breakfast at 9 AM", "lunch at 2 PM") — use EXACTLY those times.
- If custom instructions specify a number of meals or meal names — use ONLY those meals, no more, no less.
- If custom instructions say "no breakfast" or exclude any meal — REMOVE that meal entirely.
- Custom meal structure COMPLETELY REPLACES the default 8-meal structure below.
- Only fall back to the default structure when the nutritionist has given NO timing or structure instructions at all.
- DEFAULT MEAL STRUCTURE (use ONLY when no custom timing/structure is specified): Upon waking up (6:30 AM), Early morning (8:00 AM), Breakfast (9:30 AM), Mid Morning (11:00 AM), Lunch (1:30 PM), Evening Snack (5:00 PM), Dinner (8:00 PM), Bedtime (10:00 PM)

CREATIVE SUBSTITUTION SYSTEM:
- Wheat flour → Ragi flour, Jowar flour, Quinoa flour, Buckwheat flour (NO BAJRA if specified)
- Rice → Quinoa, Millets, Cauliflower rice, Buckwheat
- Regular pasta → Millet pasta, Red lentil pasta, Zucchini noodles
- Bread → Ragi bread, Jowar bread, Multigrain bread, Lettuce wraps

REGIONAL CUISINE VARIETY REQUIREMENT:
Each day-group must feature different regional Indian cuisine:
- North Indian: Punjabi, Kashmiri, Rajasthani, Uttar Pradesh
- South Indian: Tamil Nadu, Kerala, Karnataka, Andhra
- East Indian: Bengali, Odia, Assamese
- West Indian: Maharashtrian, Gujarati, Rajasthani
- Northeast: Manipuri, Nagaland, Assamese tribal

CRITICAL STRUCTURE: The plan must be organized as follows:
${groupDescriptions}

${useDayGrouping
  ? 'Each group should have DIFFERENT meals from the other groups to provide variety. Days within the same group share identical meals.'
  : `EVERY day must have COMPLETELY UNIQUE meals — no breakfast, lunch, or dinner should repeat across any two days. Maximize variety across all ${numberOfDays} days.`}
Do NOT use "OR" options - give ONE specific meal per period. ${includeAlternatives ? 'For EVERY meal period, also provide ONE alternative option that the client can swap in if they don\'t like the primary option. The alternative should be a completely different dish that serves the same nutritional purpose.' : 'Do NOT provide alternative meals — leave the "alternative" field empty for every meal. The nutritionist has specified exact meals in the instructions.'}

Your response must be a valid JSON object with exactly this structure:
{
  "planName": "Personalized Lifestyle Plan for [Client Name]",
  "introMessage": "[Generate a personalized 2-3 sentence introduction about this client's lifestyle plan, highlighting their specific regional cuisine variety and dietary accommodations]",
  "affirmations": ["3 positive health affirmations tailored to client's goals"],
  "startDate": "${startDate || new Date().toISOString().split('T')[0]}",
  "editable": true,
  "dayGroups": [
${groupJsonExamples}
  ],
  "servingSize": "1 bowl is 250ml, 1 katori 100ml",
  "oilGuidelines": {
    "cooking": {
      "groupA": ["cold-pressed coconut oil - 2 tsp", "cold-pressed sesame oil - 2 tsp", "ghee (if not vegan) - 1 tsp"],
      "groupB": ["mustard oil - 1-2 tsp", "groundnut oil - 1-2 tsp", "rice bran oil - 1 tsp"]
    },
    "raw": ["extra virgin olive oil - 1 tsp", "flaxseed oil - 1 tsp"],
    "deepFrying": ["cold-pressed groundnut oil or mustard oil for occasional use only"],
    "note": "All oils must be cold-pressed and unrefined. Total should not exceed 4-5 tsp a day. Rotate oils weekly for variety."
  },
  "importantNotes": ["5-7 important dietary notes specific to client's conditions and restrictions"],
  "disclaimer": "Consult with healthcare provider before making dietary changes. This plan is personalized guidance, not medical advice.",
  "skinCareTips": "Specific tips based on skin type and dietary restrictions",
  "hairCareTips": "Specific tips based on hair type and dietary restrictions", 
  "healthNotes": "Detailed notes for specific health conditions with food recommendations",
  "supplements": "Detailed list of recommended supplements with specific dosage instructions, timing, and form (powder/capsule/liquid) based on client's profile, health conditions, and dietary restrictions. Format as single string with proper spacing.",
  "weeklyGroceryList": [
    { "category": "Vegetables", "items": ["Spinach - 500g", "Tomatoes - 1kg", "Onions - 1kg", "Local seasonal vegetables - 2kg"] },
    { "category": "Fruits", "items": ["Seasonal local fruits - 2kg variety", "Banana - 6 pcs", "Citrus fruits - 500g"] },
    { "category": "Grains & Pulses", "items": ["Brown/red/black rice - 1kg", "Moong dal - 500g", "Masoor dal - 500g", "Regional millets - 500g"] },
    { "category": "Dairy & Alternatives", "items": ["Curd/Plant-based curd - 1kg", "Paneer/Tofu - 200g", "Milk/Plant milk - 1L"] },
    { "category": "Spices & Condiments", "items": ["Turmeric powder - 100g", "Cumin seeds - 200g", "Coriander powder - 100g", "Regional spices as needed"] },
    { "category": "Others", "items": ["Jaggery/coconut sugar - 200g", "Honey/maple syrup (if allowed) - 200g", "Nuts and seeds - 500g mixed"] }
  ]
}

CRITICAL FORMATTING RULE FOR foodPlan, alternative, AND notes FIELDS:
- Write ONLY the meal name with quantities. Example: "2 roti with 1 bowl dal" or "1 cup oats porridge with banana"
- Do NOT add recipe steps, cooking methods, or preparation details inside parentheses or brackets
- Do NOT write things like "Oats porridge (boil 1 cup oats in milk, add banana)" — the parenthetical recipe is FORBIDDEN
- "notes": ALWAYS output an empty string "" for every single meal, with no exceptions. Do NOT put recipes, cooking tips, timing tips, or any other remarks there — the nutritionist fills this in manually while editing. Never generate any text for this field.

ENHANCED FOCUS AREAS:
- STRICT dietary restriction compliance with creative alternatives
- Regional Indian cuisine diversity across day-groups
- Traditional superfoods integration: moringa, ashwagandha, amla, triphala, turmeric, ginger, garlic
- ONE specific meal per period (no OR options) with ONE completely different alternative
- Alternative meals should be different dishes, not variations (e.g., if main is Rajma, alternative could be Chole)
- Progressive meal variety - no repetition across day-groups
- Leave every meal's "notes" field as an empty string "" — never generate content for it
- Seasonal ingredient integration based on current month
- Local market availability - ingredients easily found in Indian sabzi mandi and kirana stores
- Precise quantities and measurements for portion control
- Weekly grocery list organized by category with approximate quantities
- If client provides supplements, include exactly as specified in supplements field as single string
- If no supplements specified, recommend based on health goals, conditions, and dietary restrictions
- NUTRITIONIST INSTRUCTIONS TAKE ABSOLUTE PRIORITY: Any instruction given by the nutritionist in their custom prompt overrides defaults for meal structure, timing, food choices, and format. Never ignore or partially apply nutritionist instructions.
- Nutritional accuracy with macro balance: 50-60% carbs, 15-20% protein, 20-30% healthy fats
- Include traditional wisdom: Ayurvedic principles, food combinations, timing according to dosha
- ACCURATE CLIENT DATA REFLECTION: Always reference the exact client details provided in the prompt, including actual skin type, hair type, and health conditions. Do not show "Not specified" in the final plan when data is provided.`;

    const userPrompt = `Create a highly personalized detailed lifestyle plan.

${customPrompt ? `━━━ NUTRITIONIST INSTRUCTIONS — READ THESE FIRST, FOLLOW EXACTLY ━━━
${customPrompt}

COMPLIANCE RULES FOR THE ABOVE INSTRUCTIONS:
1. Every instruction above is MANDATORY. Do not skip, modify, or partially apply any of them.
2. MEAL STRUCTURE: If the above specifies meal names, number of meals, or an eating window — use ONLY that structure. Do NOT add the default 8-meal structure on top of it.
3. TIMING: If specific meal times or an eating window is mentioned — apply them EXACTLY. Remove any meals that fall outside the specified window.
4. FOOD RESTRICTIONS: Any ingredient or food group mentioned as restricted must be COMPLETELY absent from every meal and alternative.
5. These instructions override ALL defaults including default meal times, number of meals, and regional variety requirements.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}
**CLIENT PROFILE:**
- Name: ${clientDetails.name}
- Goal: ${goalText}
- Height: ${clientDetails.height} cm
- Weight: ${clientDetails.weight} kg
- Age: ${clientDetails.age} years
- Gender: ${clientDetails.gender}
- Diet Preference: ${clientDetails.dietPreference}

**PHYSICAL CHARACTERISTICS:**
- Skin Type: ${clientDetails.skinType}
- Hair Type: ${clientDetails.hairType}

**HEALTH CONDITIONS & CONCERNS (use to inform food choices, do not override nutritionist instructions):**
${clientDetails.healthConditions.length > 0 ? clientDetails.healthConditions.map(condition => `- ${condition}`).join('\n') : 'None specified'}

**SUPPLEMENTS & MEDICATIONS:**
${clientDetails.supplements ? `- Current supplements: ${clientDetails.supplements}` : 'None specified'}

**IMPORTANT CLIENT DATA HANDLING:**
- If any field shows "Not specified" - DO NOT make assumptions or provide generic recommendations
- For "Not specified" skin/hair types - provide general healthy eating advice without specific skin/hair focus
- If health conditions show "None specified" - focus on general wellness and preventive nutrition
- DO NOT guess or assume client preferences - stick to explicitly provided information

**DIETARY RESTRICTIONS FROM PROFILE:**
Analyze the diet preference field for restrictions:
- If "no wheat" appears - USE ZERO wheat products, substitute with ragi, jowar, bajra, quinoa, millets
- If "no dairy" appears - USE ZERO dairy, substitute with almond milk, coconut milk, tofu, plant-based alternatives
- If "vegan" appears - USE ZERO animal products including dairy, eggs, honey
- If "gluten-free" appears - USE ZERO gluten grains, use certified gluten-free alternatives
- If "no sugar" appears - USE ZERO added sugars, use natural sweeteners like stevia, dates, figs
- If "Jain" appears - EXCLUDE all root vegetables, onions, garlic

**PLAN REQUIREMENTS:**
- Duration: ${numberOfDays} days starting from ${startDate || new Date().toLocaleDateString()}
- Days: ${dayGroups.map(g => g.label).join(', ')}
- ${useDayGrouping ? 'Grouped mode: days in the same group share meals; each group must feature DIFFERENT regional Indian cuisine' : `Individual mode: EVERY day has fully unique meals — absolutely NO meal repetition across all ${numberOfDays} days`}
- Each day/group must feature DIFFERENT regional Indian cuisine (unless nutritionist instructions say otherwise)
- Every meal must have exact quantities and preparation instructions
- Include traditional superfoods and Ayurvedic principles
- Consider seasonal availability and local market access
- Provide creative alternatives for restricted ingredients

Create a comprehensive lifestyle plan that strictly follows the nutritionist's instructions above, adheres to all dietary restrictions, and maximises variety, nutrition, and cultural authenticity.`;

    // Enhanced error handling with retry logic
    let completion;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.5,
          response_format: { type: "json_object" },
          max_tokens: 4000,
        });
        break; // Success, exit retry loop
      } catch (apiError) {
        retryCount++;
        console.warn(`API attempt ${retryCount} failed:`, apiError.message);
        
        if (retryCount >= maxRetries) {
          throw apiError; // Re-throw if all retries failed
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
    
    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    let dietPlan;
    try {
      // Try to parse as JSON directly first
      dietPlan = JSON.parse(content.trim());
    } catch (parseError) {
      // If that fails, try to extract JSON from code blocks
      try {
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
        const jsonString = jsonMatch ? jsonMatch[1] : content;
        dietPlan = JSON.parse(jsonString.trim());
      } catch (secondParseError) {
        console.error("Failed to parse AI response:", content);
        throw new Error("Failed to parse diet plan from AI response");
      }
    }

    // Validate the response structure
    if (!dietPlan || typeof dietPlan !== 'object') {
      throw new Error("Invalid AI response format");
    }

    // Strip alternatives if toggle is off — enforce server-side regardless of AI output
    if (!includeAlternatives && dietPlan.dayGroups) {
      dietPlan.dayGroups = dietPlan.dayGroups.map(group => ({
        ...group,
        meals: (group.meals || []).map(meal => ({ ...meal, alternative: '' })),
      }));
    }

    // Notes are filled in manually by the nutritionist while editing, never
    // by the AI — clear them server-side even if the model ignored the prompt.
    if (dietPlan.dayGroups) {
      dietPlan.dayGroups = dietPlan.dayGroups.map(group => ({
        ...group,
        meals: (group.meals || []).map(meal => ({ ...meal, notes: '' })),
      }));
    }

    res.json({ dietPlan });
  } catch (error) {
    console.error("Error generating diet plan:", error);
    
    // Ensure we always send JSON response
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    
    if (errorMessage.includes("OpenAI API key")) {
      res.status(500).json({ error: "API configuration error. Please contact support." });
    } else if (errorMessage.includes("quota") || errorMessage.includes("rate limit")) {
      res.status(429).json({ error: "API rate limit exceeded. Please try again later." });
    } else {
      res.status(500).json({ error: errorMessage });
    }
  }
}
