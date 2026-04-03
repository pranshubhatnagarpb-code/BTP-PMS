// API endpoint to generate diet plans using OpenAI instead of Lovable Gemini
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const getDayGroupings = (numberOfDays, startDate = new Date()) => {
  const start = new Date(startDate);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  if (numberOfDays <= 1) return [{ 
    label: "Monday", 
    dates: formatDate(start),
    days: ["Monday"] 
  }];
  
  if (numberOfDays === 2) return [
    { label: "Monday", dates: formatDate(start), days: ["Monday"] },
    { label: "Tuesday", dates: formatDate(new Date(start.getTime() + 24 * 60 * 60 * 1000)), days: ["Tuesday"] },
  ];
  
  if (numberOfDays === 3) return [
    { label: "Monday", dates: formatDate(start), days: ["Monday"] },
    { label: "Tuesday", dates: formatDate(new Date(start.getTime() + 24 * 60 * 60 * 1000)), days: ["Tuesday"] },
    { label: "Wednesday", dates: formatDate(new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000)), days: ["Wednesday"] },
  ];
  
  if (numberOfDays === 4) return [
    { label: "Monday & Thursday", dates: `${formatDate(start)} & ${formatDate(new Date(start.getTime() + 3 * 24 * 60 * 60 * 1000))}`, days: ["Monday", "Thursday"] },
    { label: "Tuesday", dates: formatDate(new Date(start.getTime() + 24 * 60 * 60 * 1000)), days: ["Tuesday"] },
    { label: "Wednesday", dates: formatDate(new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000)), days: ["Wednesday"] },
    { label: "Friday", dates: formatDate(new Date(start.getTime() + 4 * 24 * 60 * 60 * 1000)), days: ["Friday"] },
  ];
  
  if (numberOfDays === 5) return [
    { label: "Monday & Thursday", dates: `${formatDate(start)} & ${formatDate(new Date(start.getTime() + 3 * 24 * 60 * 60 * 1000))}`, days: ["Monday", "Thursday"] },
    { label: "Tuesday & Friday", dates: `${formatDate(new Date(start.getTime() + 24 * 60 * 60 * 1000))} & ${formatDate(new Date(start.getTime() + 4 * 24 * 60 * 60 * 1000))}`, days: ["Tuesday", "Friday"] },
    { label: "Wednesday", dates: formatDate(new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000)), days: ["Wednesday"] },
  ];
  
  if (numberOfDays === 6) return [
    { label: "Monday & Thursday", dates: `${formatDate(start)} & ${formatDate(new Date(start.getTime() + 3 * 24 * 60 * 60 * 1000))}`, days: ["Monday", "Thursday"] },
    { label: "Tuesday & Friday", dates: `${formatDate(new Date(start.getTime() + 24 * 60 * 60 * 1000))} & ${formatDate(new Date(start.getTime() + 4 * 24 * 60 * 60 * 1000))}`, days: ["Tuesday", "Friday"] },
    { label: "Wednesday & Saturday", dates: `${formatDate(new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000))} & ${formatDate(new Date(start.getTime() + 5 * 24 * 60 * 60 * 1000))}`, days: ["Wednesday", "Saturday"] },
  ];
  
  // 7 days (full week)
  return [
    { label: "Monday & Thursday", dates: `${formatDate(start)} & ${formatDate(new Date(start.getTime() + 3 * 24 * 60 * 60 * 1000))}`, days: ["Monday", "Thursday"] },
    { label: "Tuesday & Friday", dates: `${formatDate(new Date(start.getTime() + 24 * 60 * 60 * 1000))} & ${formatDate(new Date(start.getTime() + 4 * 24 * 60 * 60 * 1000))}`, days: ["Tuesday", "Friday"] },
    { label: "Wednesday & Saturday", dates: `${formatDate(new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000))} & ${formatDate(new Date(start.getTime() + 5 * 24 * 60 * 60 * 1000))}`, days: ["Wednesday", "Saturday"] },
    { label: "Sunday", dates: formatDate(new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000)), days: ["Sunday"] },
  ];
};

module.exports = async function handler(req, res) {
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
    
    if (!clientDetails) {
      return res.status(400).json({ error: 'clientDetails is required' });
    }

    const goalText = {
      weight_loss: "weight loss / fat loss",
      weight_gain: "weight gain / muscle building",
      maintain: "weight maintenance"
    }[clientDetails.goal] || "general wellness";

    const dayGroups = getDayGroupings(numberOfDays, startDate || new Date());
    const groupDescriptions = dayGroups.map((g, i) => `- Group ${i + 1}: ${g.label} (${g.dates || 'no specific dates'})`).join('\n');
    const groupJsonExamples = dayGroups.map((g, i) => {
      return `    {
      "label": "${g.label}",
      "dates": "${g.dates || ''}",
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

CREATIVE SUBSTITUTION SYSTEM:
- Wheat flour → Ragi flour, Jowar flour, Quinoa flour, Buckwheat flour (NO BAJRA if specified)
- Rice → Quinoa, Millets, Cauliflower rice, Buckwheat
- Dairy → Almond milk, Coconut milk, Tofu, Nut-based alternatives
- Sugar → Stevia, Monk fruit, Dates, Figs

PRIORITY HIERARCHY:
1. CRITICAL dietary restrictions (ABSOLUTE compliance required)
2. Custom nutritionist instructions (HIGH priority)
3. Health conditions and goals
4. General nutritional guidelines

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

    const groupLabels = dayGroups.map(g => g.label).join(', ');

    const userPrompt = `Create a personalized detailed food plan for:

**Client Profile:**
- Name: ${clientDetails.name || 'Client'}
- Goal: ${goalText}
- Height: ${clientDetails.height || '--'} cm
- Weight: ${clientDetails.weight || '--'} kg
- Age: ${clientDetails.age || '--'} years
- Gender: ${clientDetails.gender || 'not specified'}
- Diet Preference: ${clientDetails.dietPreference || 'not specified'}

**Skin & Hair:**
- Skin Type: ${clientDetails.skinType || 'not specified'}
- Hair Type: ${clientDetails.hairType || 'not specified'}

**Health Conditions/Concerns:**
${clientDetails.healthConditions && clientDetails.healthConditions.length > 0 ? clientDetails.healthConditions.join(', ') : 'None specified'}

**Recommended Supplements:**
${clientDetails.supplements || 'None specified'}
${customPrompt ? `\n**CRITICAL DIETARY RESTRICTIONS & NUTRITIONIST INSTRUCTIONS (HIGHEST PRIORITY):**
${customPrompt}

IMPORTANT: The above dietary restrictions must be followed ABSOLUTELY. If "no bajra" or any other restriction is mentioned, DO NOT include those ingredients under any circumstances. Use the creative alternatives specified in the system prompt.` : ''}

Create a comprehensive food plan covering ${numberOfDays} days starting from ${startDate || new Date().toLocaleDateString()} with day-groups (${groupLabels}), each having unique meals. Include oil guidelines and important dietary notes.`;

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key is not configured");
    }

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
          max_tokens: 4000,
          response_format: { type: "json_object" },
        });
        break; // Success, exit retry loop
      } catch (error) {
        retryCount++;
        if (retryCount >= maxRetries) {
          throw error;
        }
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
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

    res.status(200).json({ dietPlan });
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