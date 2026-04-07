// server.js
import express from 'express';
import OpenAI from 'openai';
import cors from 'cors';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local/.env.local' });

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const getDayGroupings = (numberOfDays, startDate) => {
  console.log('getDayGroupings called with:', { numberOfDays, startDate });
  
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const start = new Date(startDate);
  console.log('Created start date:', { 
    start, 
    startString: start.toString(),
    startISO: start.toISOString(),
    startLocal: start.toLocaleDateString()
  });
  
  const dayGroups = [];
  
  // Generate sequential days starting from the actual start date
  for (let i = 0; i < numberOfDays; i++) {
    const currentDate = new Date(start);
    currentDate.setDate(start.getDate() + i);
    const dayName = days[currentDate.getDay()];
    const dateStr = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    console.log(`Day ${i + 1}:`, {
      i,
      currentDate,
      dayName,
      dateStr,
      fullDate: currentDate.toISOString().split('T')[0]
    });
    
    dayGroups.push({
      dayName,
      date: dateStr,
      fullDate: currentDate.toISOString().split('T')[0]
    });
  }
  
  console.log('Generated dayGroups:', dayGroups);
  
  // Create day groups that respect the actual start date sequence
  // For 7-day plans, create pairs based on the actual sequence
  const pairedGroups = [];
  
  if (numberOfDays === 7) {
    // Pair days 1&2, 3&4, 5&6, and keep day 7 separate
    pairedGroups.push({
      label: `${dayGroups[0].dayName} & ${dayGroups[1].dayName}`,
      dates: `${dayGroups[0].date} & ${dayGroups[1].date}`,
      days: [dayGroups[0], dayGroups[1]]
    });
    pairedGroups.push({
      label: `${dayGroups[2].dayName} & ${dayGroups[3].dayName}`,
      dates: `${dayGroups[2].date} & ${dayGroups[3].date}`,
      days: [dayGroups[2], dayGroups[3]]
    });
    pairedGroups.push({
      label: `${dayGroups[4].dayName} & ${dayGroups[5].dayName}`,
      dates: `${dayGroups[4].date} & ${dayGroups[5].date}`,
      days: [dayGroups[4], dayGroups[5]]
    });
    pairedGroups.push({
      label: dayGroups[6].dayName,
      dates: dayGroups[6].date,
      days: [dayGroups[6]]
    });
  } else if (numberOfDays === 6) {
    // Pair days 1&2, 3&4, 5&6
    pairedGroups.push({
      label: `${dayGroups[0].dayName} & ${dayGroups[1].dayName}`,
      dates: `${dayGroups[0].date} & ${dayGroups[1].date}`,
      days: [dayGroups[0], dayGroups[1]]
    });
    pairedGroups.push({
      label: `${dayGroups[2].dayName} & ${dayGroups[3].dayName}`,
      dates: `${dayGroups[2].date} & ${dayGroups[3].date}`,
      days: [dayGroups[2], dayGroups[3]]
    });
    pairedGroups.push({
      label: `${dayGroups[4].dayName} & ${dayGroups[5].dayName}`,
      dates: `${dayGroups[4].date} & ${dayGroups[5].date}`,
      days: [dayGroups[4], dayGroups[5]]
    });
  } else if (numberOfDays === 5) {
    // Pair days 1&2, 3&4, keep day 5 separate
    pairedGroups.push({
      label: `${dayGroups[0].dayName} & ${dayGroups[1].dayName}`,
      dates: `${dayGroups[0].date} & ${dayGroups[1].date}`,
      days: [dayGroups[0], dayGroups[1]]
    });
    pairedGroups.push({
      label: `${dayGroups[2].dayName} & ${dayGroups[3].dayName}`,
      dates: `${dayGroups[2].date} & ${dayGroups[3].date}`,
      days: [dayGroups[2], dayGroups[3]]
    });
    pairedGroups.push({
      label: dayGroups[4].dayName,
      dates: dayGroups[4].date,
      days: [dayGroups[4]]
    });
  } else if (numberOfDays === 4) {
    // Pair days 1&2, keep days 3&4 separate
    pairedGroups.push({
      label: `${dayGroups[0].dayName} & ${dayGroups[1].dayName}`,
      dates: `${dayGroups[0].date} & ${dayGroups[1].date}`,
      days: [dayGroups[0], dayGroups[1]]
    });
    pairedGroups.push({
      label: dayGroups[2].dayName,
      dates: dayGroups[2].date,
      days: [dayGroups[2]]
    });
    pairedGroups.push({
      label: dayGroups[3].dayName,
      dates: dayGroups[3].date,
      days: [dayGroups[3]]
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

app.post('/api/diet-plan', async (req, res) => {
  try {
    const { clientDetails, customPrompt, numberOfDays = 7, startDate } = req.body;
    
    console.log('Backend received:', { 
      startDate, 
      numberOfDays,
      startDateType: typeof startDate
    });
    
    if (!clientDetails) {
      return res.status(400).json({ error: 'clientDetails is required' });
    }

    const goalText = {
      weight_loss: "weight loss / fat loss",
      weight_gain: "weight gain / muscle building",
      maintain: "weight maintenance"
    }[clientDetails.goal];

    const dayGroups = getDayGroupings(numberOfDays, startDate || new Date());
    const groupDescriptions = dayGroups.map((g, i) => `- Group ${i + 1}: ${g.label} (${g.dates})`).join('\n');
    const groupJsonExamples = dayGroups.map((g, i) => {
      return `    {
      "label": "${g.label}",
      "dates": "${g.dates}",
      "editable": true,
      "meals": [
        { "period": "Upon waking up", "time": "6:30 AM", "foodPlan": "Specific food with quantities", "alternative": "Alternative option with quantities", "notes": "Preparation notes" },
        { "period": "Early morning", "time": "8:00 AM", "foodPlan": "...", "alternative": "...", "notes": "..." },
        { "period": "Breakfast", "time": "9:30 AM", "foodPlan": "...", "alternative": "...", "notes": "..." },
        { "period": "Mid Morning", "time": "11:00 AM", "foodPlan": "...", "alternative": "...", "notes": "..." },
        { "period": "Lunch", "time": "1:30 PM", "foodPlan": "...", "alternative": "...", "notes": "..." },
        { "period": "Evening Snack", "time": "5:00 PM", "foodPlan": "...", "alternative": "...", "notes": "..." },
        { "period": "Dinner", "time": "8:00 PM", "foodPlan": "...", "alternative": "...", "notes": "..." },
        { "period": "Bedtime", "time": "10:00 PM", "foodPlan": "...", "alternative": "...", "notes": "" }
      ]
    }`;
    }).join(',\n');

    const systemPrompt = `You are an expert Indian nutritionist and dietitian specializing in holistic nutrition with deep knowledge of regional cuisines and dietary restrictions. Create a highly personalized, time-based food plan with authentic Indian meals.

CRITICAL DIETARY RESTRICTION ENFORCEMENT:
- If client specifies "no wheat" - ABSOLUTELY NO wheat, maida, sooji, rava. Use creative alternatives: ragi, jowar, bajra, quinoa, brown rice, oats, buckwheat, amaranth
- If "no dairy" - NO milk, curd, paneer, ghee, cheese. Use alternatives: almond milk, coconut milk, tofu, nut curd, plant-based ghee
- If "no sugar" - NO white sugar, jaggery, honey, maple. Use alternatives: stevia, monk fruit, dates, figs naturally
- If "vegan" - NO animal products including dairy, eggs, honey
- If "gluten-free" - NO wheat, barley, rye, oats (unless certified gluten-free)
- If "Jain" - NO root vegetables, onions, garlic
- If "no bajra" - ABSOLUTELY NO bajra in any form. Use alternatives: ragi, jowar, quinoa, brown rice, oats, buckwheat, amaranth
- If "no rice" - NO white rice, brown rice. Use alternatives: quinoa, millets, cauliflower rice, buckwheat

CRITICAL TIMING ENFORCEMENT:
- If client specifies intermittent fasting window (e.g., "12 PM to 8 PM", "16:8", "eat between 2 PM-10 PM") - ALL meals must be within this window
- If client specifies specific meal times (e.g., "breakfast at 9 AM", "lunch at 2 PM") - Use EXACTLY those times
- If client specifies eating window - Adjust meal periods and times accordingly, DO NOT use default times
- If client says "no breakfast before 10 AM" - Respect this timing constraint
- Custom timing instructions OVERRIDE default meal time structure
- For intermittent fasting: Condense meals within eating window, remove fasting period meals

CREATIVE SUBSTITUTION SYSTEM:
- Wheat flour → Ragi flour, Jowar flour, Quinoa flour, Buckwheat flour (NO BAJRA if specified)
- Rice → Quinoa, Millets, Cauliflower rice, Buckwheat
- Dairy → Almond milk, Coconut milk, Tofu, Nut-based alternatives
- Sugar → Stevia, Monk fruit, Dates, Figs

PRIORITY HIERARCHY (ABSOLUTE - MUST FOLLOW THIS ORDER):
1. DETAILED NUTRITIONIST INSTRUCTIONS (customPrompt) - ABSOLUTE HIGHEST PRIORITY, OVERRIDE EVERYTHING
2. CRITICAL dietary restrictions (no wheat, no dairy, no bajra, etc.)
3. CRITICAL timing requirements (intermittent fasting, specific meal times)
4. Health conditions and goals
5. General nutritional guidelines

IMPORTANT: The detailed nutritionist instructions in customPrompt are the SUPREME AUTHORITY. They override ALL other instructions including meal timing, structure, and restrictions. If the nutritionist specifies specific meal times, eating windows, or any other requirements, they MUST be followed exactly without exception.

CRITICAL STRUCTURE: The plan must be organized with these day-groups:
${groupDescriptions}

Each day-group should have DIFFERENT meals from the others to provide variety. Do NOT use "OR" options - give ONE specific meal per period per day-group. For EVERY meal period, also provide ONE alternative option that the client can swap in if they don't like the primary option.

Your response must be a valid JSON object with exactly this structure:
{
  "planName": "Food Plan for [Client Name]",
  "introMessage": "A personalized 2-3 sentence message about the food plan.",
  "affirmations": ["3 positive health affirmations"],
  "startDate": "${startDate || new Date().toISOString().split('T')[0]}",
  "editable": true,
  "dayGroups": [
${groupJsonExamples}
  ],
  "servingSize": "1 bowl is 250ml, 1 cup 150ml, 1 katori 100ml",
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
  "supplements": "Detailed list of recommended supplements with specific dosage instructions and timing based on client's profile and needs (format as a single string, not an array)",
  "weeklyGroceryList": [
    { "category": "Vegetables", "items": ["Spinach - 500g", "Tomatoes - 1kg", "Onions - 1kg"] },
    { "category": "Fruits", "items": ["Banana - 6 pcs", "Apple - 4 pcs"] },
    { "category": "Grains & Pulses", "items": ["Brown rice - 1kg", "Moong dal - 500g"] },
    { "category": "Dairy", "items": ["Curd - 1kg", "Paneer - 200g"] },
    { "category": "Spices & Condiments", "items": ["Haldi powder", "Jeera"] },
    { "category": "Others", "items": ["Jaggery - 200g", "Honey - 1 bottle"] }
  ]
}

Focus on:
- Authentic Indian cuisine with variety (North & South Indian)
- Practical, easily available ingredients with exact quantities
- Include traditional superfoods (haldi, methi, amla, moringa, ashwagandha etc.)
- ONE specific meal per period (no OR options) with ONE alternative option for each meal
- The alternative should be a completely different dish (not a variation) that serves the same nutritional purpose
- Different meals across day-groups for variety
- Detailed preparation notes
- Post-meal instructions (like Vajrasan, walking)
- Proper hydration guidance
- Keep the plan concise enough to fit in 2 pages when printed
- Weekly grocery list with items easily available in Indian markets (local sabzi mandi, kirana stores)
- Categorize grocery items (Vegetables, Fruits, Grains & Pulses, Dairy, Spices & Condiments, Others)
- Include approximate quantities needed for the week
- If client has specified supplements, include them exactly as provided in the supplements field as a single string. If no supplements are specified, recommend appropriate supplements based on their health goals and conditions, formatted as a single string with proper dosage and timing instructions (NOT as an array)`;

    const userPrompt = `${customPrompt ? `**ABSOLUTE HIGHEST PRIORITY - DETAILED NUTRITIONIST INSTRUCTIONS (MUST FOLLOW EXACTLY):**
${customPrompt}

CRITICAL: These instructions are the SUPREME AUTHORITY and override ALL other guidelines, meal structures, timings, and restrictions. Follow these instructions exactly as written without any exceptions.

---

**CLIENT PROFILE (Secondary - Only if not conflicting with above instructions):**` : '**CLIENT PROFILE:**'}

**Name:** ${clientDetails.name || 'Client'}
**Goal:** ${goalText}
**Height:** ${clientDetails.height || '--'} cm
**Weight:** ${clientDetails.weight || '--'} kg
**Age:** ${clientDetails.age || '--'} years
**Gender:** ${clientDetails.gender || 'not specified'}
**Diet Preference:** ${clientDetails.dietPreference || 'not specified'}

**Skin & Hair:**
- Skin Type: ${clientDetails.skinType}
- Hair Type: ${clientDetails.hairType}

**Health Conditions/Concerns:**
${clientDetails.healthConditions.length > 0 ? clientDetails.healthConditions.join(', ') : 'None specified'}

**Recommended Supplements:**
${clientDetails.supplements || 'None specified'}

${!customPrompt ? `
**IMPORTANT NOTES:**
- If you need to specify intermittent fasting, eating windows, or custom meal times, please provide those instructions in the detailed nutritionist instructions field for proper compliance.
- Default meal structure will be used if no specific timing instructions are provided.` : ''}

Create a comprehensive food plan covering ${numberOfDays} days starting from ${startDate || new Date().toLocaleDateString()} with day-groups (${dayGroups.map(g => g.label).join(', ')}), each having unique meals. Include oil guidelines and important dietary notes.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });
    
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
});

app.listen(3000, () => console.log('Backend: http://localhost:3000'));