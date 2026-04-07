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
    const { clientDetails, customPrompt, numberOfDays = 7, startDate } = req.body;
    
    console.log('Request body received:', { startDate, numberOfDays });
    
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
- Regular pasta → Millet pasta, Red lentil pasta, Zucchini noodles
- Bread → Ragi bread, Jowar bread, Multigrain bread, Lettuce wraps

REGIONAL CUISINE VARIETY REQUIREMENT:
Each day-group must feature different regional Indian cuisine:
- North Indian: Punjabi, Kashmiri, Rajasthani, Uttar Pradesh
- South Indian: Tamil Nadu, Kerala, Karnataka, Andhra
- East Indian: Bengali, Odia, Assamese
- West Indian: Maharashtrian, Gujarati, Rajasthani
- Northeast: Manipuri, Nagaland, Assamese tribal

CRITICAL STRUCTURE: The plan must be organized with these day-groups:
${groupDescriptions}

Each day-group should have DIFFERENT meals from the others to provide variety. Do NOT use "OR" options - give ONE specific meal per period per day-group. For EVERY meal period, also provide ONE alternative option that the client can swap in if they don't like the primary option.

Your response must be a valid JSON object with exactly this structure:
{
  "planName": "Personalized Food Plan for [Client Name]",
  "introMessage": "A personalized 2-3 sentence message about the food plan highlighting regional variety and dietary accommodations.",
  "affirmations": ["3 positive health affirmations tailored to client's goals"],
  "startDate": "${startDate || new Date().toISOString().split('T')[0]}",
  "editable": true,
  "dayGroups": [
${groupJsonExamples}
  ],
  "servingSize": "1 bowl is 250ml, 1 cup 150ml, 1 katori 100ml",
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

ENHANCED FOCUS AREAS:
- STRICT dietary restriction compliance with creative alternatives
- Regional Indian cuisine diversity across day-groups
- Traditional superfoods integration: moringa, ashwagandha, amla, triphala, turmeric, ginger, garlic
- ONE specific meal per period (no OR options) with ONE completely different alternative
- Alternative meals should be different dishes, not variations (e.g., if main is Rajma, alternative could be Chole)
- Progressive meal variety - no repetition across day-groups
- Detailed preparation notes with cooking techniques
- Post-meal practices: Vajrasan after meals, 10-min walks, proper hydration timing
- Seasonal ingredient integration based on current month
- Local market availability - ingredients easily found in Indian sabzi mandi and kirana stores
- Precise quantities and measurements for portion control
- 8 MEALS PER DAY STRUCTURE: Upon waking up (6:30 AM), Early morning (8:00 AM), Breakfast (9:30 AM), Mid Morning (11:00 AM), Lunch (1:30 PM), Evening Snack (5:00 PM), Dinner (8:00 PM), Bedtime (10:00 PM)
- Weekly grocery list organized by category with approximate quantities
- If client provides supplements, include exactly as specified in supplements field as single string
- If no supplements specified, recommend based on health goals, conditions, and dietary restrictions
- Custom prompts must be followed precisely - give them highest priority after dietary restrictions
- Nutritional accuracy with macro balance: 50-60% carbs, 15-20% protein, 20-30% healthy fats
- Include traditional wisdom: Ayurvedic principles, food combinations, timing according to dosha
- ACCURATE CLIENT DATA REFLECTION: Always reference the exact client details provided in the prompt, including actual skin type, hair type, and health conditions. Do not show "Not specified" in the final plan when data is provided.`;

    const userPrompt = `Create a highly personalized detailed food plan for:

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

**IMPORTANT CLIENT DATA HANDLING:**
- If any field shows "Not specified" - DO NOT make assumptions or provide generic recommendations
- For "Not specified" skin/hair types - provide general healthy eating advice without specific skin/hair focus
- If health conditions show "None specified" - focus on general wellness and preventive nutrition
- DO NOT guess or assume client preferences - stick to explicitly provided information

**HEALTH CONDITIONS & CONCERNS:**
${clientDetails.healthConditions.length > 0 ? clientDetails.healthConditions.map(condition => `- ${condition}`).join('\n') : 'None specified'}

**SUPPLEMENTS & MEDICATIONS:**
${clientDetails.supplements ? `- Current supplements: ${clientDetails.supplements}` : 'None specified'}

**CRITICAL DIETARY RESTRICTIONS & PREFERENCES:**
Analyze the diet preference field and any custom instructions below for restrictions:
- If "no wheat" appears anywhere - USE ZERO wheat products, substitute with ragi, jowar, bajra, quinoa, millets
- If "no dairy" appears - USE ZERO dairy, substitute with almond milk, coconut milk, tofu, plant-based alternatives
- If "vegan" appears - USE ZERO animal products including dairy, eggs, honey
- If "gluten-free" appears - USE ZERO gluten grains, use certified gluten-free alternatives
- If "no sugar" appears - USE ZERO added sugars, use natural sweeteners like stevia, dates, figs
- If "Jain" appears - EXCLUDE all root vegetables, onions, garlic

${customPrompt ? `\n**CRITICAL DIETARY RESTRICTIONS & NUTRITIONIST INSTRUCTIONS (HIGHEST PRIORITY):**\n${customPrompt}\n\nCRITICAL COMPLIANCE REQUIRED:\n1. The above dietary restrictions must be followed ABSOLUTELY. If "no bajra" or any other restriction is mentioned, DO NOT include those ingredients under any circumstances.\n2. TIMING INSTRUCTIONS MUST BE FOLLOWED EXACTLY:\n   - If intermittent fasting window is specified, ALL meals must be within that window\n   - If specific meal times are mentioned, use EXACTLY those times\n   - Override default meal time structure with custom timing requirements\n   - Remove or adjust meals that fall outside specified eating windows\n3. Use the creative alternatives specified in the system prompt for restricted ingredients.\n4. Custom timing instructions OVERRIDE the default meal schedule completely.\n\nThese custom instructions override general guidelines unless they conflict with safety/critical dietary restrictions.` : ''}

**PLAN REQUIREMENTS:**
- Duration: ${numberOfDays} days starting from ${startDate || new Date().toLocaleDateString()}
- Day Groups: ${dayGroups.map(g => g.label).join(', ')}
- Each day-group must feature DIFFERENT regional Indian cuisine
- Absolutely NO meal repetition across different day-groups
- Every meal must have exact quantities and preparation instructions
- Include traditional superfoods and Ayurvedic principles
- Consider seasonal availability and local market access
- Provide creative alternatives for restricted ingredients

Create a comprehensive food plan that strictly adheres to all dietary restrictions while maximizing variety, nutrition, and cultural authenticity.`;

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
          temperature: 0.8,
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
