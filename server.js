// server.js
import express from 'express';
import OpenAI from 'openai';
import cors from 'cors';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import { google } from 'googleapis';

// Load environment variables from both files
config({ path: '.env' });
config({ path: '.env.local/.env.local', override: false });

const app = express();
app.use(cors());
app.use(express.json());

// Initialize OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Initialize Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

// Service-role client for admin-only operations (creating/deleting the client
// portal's Supabase Auth users). Never expose SUPABASE_SERVICE_ROLE_KEY to the
// browser — it bypasses RLS entirely. This client is only used server-side.
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

// ---------------------------------------------------------------------------
// Google Calendar / Meet — appointments get auto-scheduled on Dr. Aamit Shah's
// Google account once he does the one-time "Connect Google Calendar" OAuth
// flow (see the Integrations page). We store only his refresh token
// (google_calendar_connections, service-role-only — see the migration) and
// mint a fresh access token per request via that refresh token.
// ---------------------------------------------------------------------------
const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/calendar.events'];
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';
const APPOINTMENT_TYPE_LABELS = {
  consultation: 'Consultation',
  follow_up: 'Follow Up',
  diet_review: 'Diet Review',
  checkup: 'Checkup',
};

function googleOAuthClient() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
    return null;
  }
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// Returns an authenticated OAuth2 client (refresh token loaded), or null if
// nobody has connected a Google account yet.
async function getConnectedGoogleClient() {
  const oauth2Client = googleOAuthClient();
  if (!oauth2Client || !supabaseAdmin) return null;

  const { data: connection } = await supabaseAdmin
    .from('google_calendar_connections')
    .select('refresh_token')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!connection) return null;

  oauth2Client.setCredentials({ refresh_token: connection.refresh_token });
  return oauth2Client;
}

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
  
  // Create day groups with preferred pairing pattern
  // For 7-day plans: Monday-Thursday, Tuesday-Friday, Wednesday-Saturday, Sunday separate
  const pairedGroups = [];
  
  if (numberOfDays === 7) {
    // Find indices for specific days to pair Monday-Thursday, Tuesday-Friday, Wednesday-Saturday
    const dayIndices = {};
    dayGroups.forEach((group, index) => {
      dayIndices[group.dayName.toLowerCase()] = index;
    });
    
    // Pair Monday-Thursday
    if (dayIndices.monday !== undefined && dayIndices.thursday !== undefined) {
      pairedGroups.push({
        label: `${dayGroups[dayIndices.monday].dayName} & ${dayGroups[dayIndices.thursday].dayName}`,
        dates: `${dayGroups[dayIndices.monday].date} & ${dayGroups[dayIndices.thursday].date}`,
        days: [dayGroups[dayIndices.monday], dayGroups[dayIndices.thursday]]
      });
    }
    
    // Pair Tuesday-Friday
    if (dayIndices.tuesday !== undefined && dayIndices.friday !== undefined) {
      pairedGroups.push({
        label: `${dayGroups[dayIndices.tuesday].dayName} & ${dayGroups[dayIndices.friday].dayName}`,
        dates: `${dayGroups[dayIndices.tuesday].date} & ${dayGroups[dayIndices.friday].date}`,
        days: [dayGroups[dayIndices.tuesday], dayGroups[dayIndices.friday]]
      });
    }
    
    // Pair Wednesday-Saturday
    if (dayIndices.wednesday !== undefined && dayIndices.saturday !== undefined) {
      pairedGroups.push({
        label: `${dayGroups[dayIndices.wednesday].dayName} & ${dayGroups[dayIndices.saturday].dayName}`,
        dates: `${dayGroups[dayIndices.wednesday].date} & ${dayGroups[dayIndices.saturday].date}`,
        days: [dayGroups[dayIndices.wednesday], dayGroups[dayIndices.saturday]]
      });
    }
    
    // Keep Sunday separate
    if (dayIndices.sunday !== undefined) {
      pairedGroups.push({
        label: dayGroups[dayIndices.sunday].dayName,
        dates: dayGroups[dayIndices.sunday].date,
        days: [dayGroups[dayIndices.sunday]]
      });
    }
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
  } else if (numberOfDays > 6) {
    // For any number of days > 3, use logical pairing pattern
    const dayIndices = {};
    dayGroups.forEach((group, index) => {
      dayIndices[group.dayName.toLowerCase()] = index;
    });
    
    // Define pairing preferences for common days
    const pairings = [
      { day1: 'monday', day2: 'thursday' },
      { day1: 'tuesday', day2: 'friday' },
      { day1: 'wednesday', day2: 'saturday' },
      { day1: 'sunday', day2: null } // Sunday stays separate
    ];
    
    const usedDays = new Set();
    
    // Create pairs based on preferences
    pairings.forEach(pair => {
      if (pair.day2) {
        // Normal pairing
        if (dayIndices[pair.day1] !== undefined && dayIndices[pair.day2] !== undefined && 
            !usedDays.has(pair.day1) && !usedDays.has(pair.day2)) {
          pairedGroups.push({
            label: `${dayGroups[dayIndices[pair.day1]].dayName} & ${dayGroups[dayIndices[pair.day2]].dayName}`,
            dates: `${dayGroups[dayIndices[pair.day1]].date} & ${dayGroups[dayIndices[pair.day2]].date}`,
            days: [dayGroups[dayIndices[pair.day1]], dayGroups[dayIndices[pair.day2]]]
          });
          usedDays.add(pair.day1);
          usedDays.add(pair.day2);
        }
      } else {
        // Separate day (like Sunday)
        if (dayIndices[pair.day1] !== undefined && !usedDays.has(pair.day1)) {
          pairedGroups.push({
            label: dayGroups[dayIndices[pair.day1]].dayName,
            dates: dayGroups[dayIndices[pair.day1]].date,
            days: [dayGroups[dayIndices[pair.day1]]]
          });
          usedDays.add(pair.day1);
        }
      }
    });
    
    // Add remaining days that weren't paired
    dayGroups.forEach((group) => {
      if (!usedDays.has(group.dayName.toLowerCase())) {
        pairedGroups.push({
          label: group.dayName,
          dates: group.date,
          days: [group]
        });
      }
    });
  } else {
    // For 3 days or fewer, create individual day groups
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

// Recipe Generator API
app.post('/api/generate-recipe', async (req, res) => {
  try {
    const { dishName } = req.body;

    if (!dishName || typeof dishName !== 'string' || dishName.trim().length === 0) {
      return res.status(400).json({ error: 'Please provide a dish name.' });
    }

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key is not configured");
    }

    const systemPrompt = `You are an expert Indian chef and nutritionist. When given a dish name, provide a detailed recipe in JSON format.

Your response must be a valid JSON object with exactly this structure:
{
  "dishName": "Full dish name",
  "description": "1-2 sentence description of the dish",
  "prepTime": "e.g. 15 mins",
  "cookTime": "e.g. 30 mins", 
  "servings": "e.g. 4 servings",
  "difficulty": "Easy / Medium / Hard",
  "calories": "Approximate calories per serving",
  "ingredients": [
    { "item": "Ingredient name", "quantity": "Amount with unit" }
  ],
  "instructions": [
    "Step 1: Detailed instruction",
    "Step 2: Detailed instruction"
  ],
  "nutritionTips": "2-3 sentences about nutritional benefits",
  "variations": ["Alternative ingredient 1", "Alternative ingredient 2"],
  "servingSuggestions": "How to serve the dish"
}

Guidelines:
- Use authentic Indian cooking techniques
- Provide specific quantities and measurements
- Include traditional spices and ingredients
- Make it practical for home cooking
- Include regional variations if applicable
- Focus on nutrition and health benefits`;

    const userPrompt = `Please provide a detailed recipe for: ${dishName.trim()}`;

    // Use gpt-4o with JSON response format for consistency with diet plan API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
      max_tokens: 1500,
    });
    
    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    let recipe;
    try {
      // With response_format: json_object, OpenAI guarantees valid JSON
      recipe = JSON.parse(content.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse recipe from AI response");
    }

    // Validate the response structure
    if (!recipe || typeof recipe !== 'object') {
      throw new Error("Invalid AI response format");
    }

    // Ensure required fields are present
    if (!recipe.dishName || !recipe.ingredients || !recipe.instructions) {
      throw new Error("Recipe missing required fields");
    }
    
    res.status(200).json({ recipe });
  } catch (error) {
    console.error("Error generating recipe:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    
    let statusCode = 500;
    let userMessage = "Failed to generate recipe";
    
    if (errorMessage.includes("OpenAI API key") || errorMessage.includes("API key")) {
      userMessage = "API configuration error. Please contact support.";
    } else if (errorMessage.includes("quota") || errorMessage.includes("rate limit")) {
      statusCode = 429;
      userMessage = "API rate limit exceeded. Please try again later.";
    } else if (errorMessage.includes("ENOENT") || errorMessage.includes("ECONNREFUSED")) {
      userMessage = "Service temporarily unavailable. Please try again later.";
    } else {
      userMessage = errorMessage || "Failed to generate recipe";
    }
    
    // Always return JSON response
    try {
      res.status(statusCode).json({ error: userMessage });
    } catch (jsonError) {
      // If even JSON response fails, send plain text
      res.status(statusCode).setHeader('Content-Type', 'text/plain').send(userMessage);
    }
  }
});


// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Blood Report Extraction API
app.post('/api/extract-blood-report', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const files = req.files;
    console.log(`Received ${files.length} files:`);
    
    // Validate all files are images
    for (const file of files) {
      console.log(`  - ${file.originalname} (${file.mimetype}, ${file.size} bytes)`);
      if (!file.mimetype.startsWith('image/')) {
        return res.status(400).json({ error: `Unsupported file type: ${file.mimetype}. Please upload only image files (JPG, PNG, etc).` });
      }
    }

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not configured');
      return res.status(500).json({ error: "OpenAI API key is not configured" });
    }

    console.log('Processing images for OpenAI Vision API...');
    
    // Convert all images to base64 for OpenAI Vision API
    const imageContents = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const base64Image = file.buffer.toString('base64');
      const dataUrl = `data:${file.mimetype};base64,${base64Image}`;
      imageContents.push({
        type: "image_url",
        image_url: { url: dataUrl }
      });
      console.log(`Image ${i + 1} converted to base64, length: ${base64Image.length}`);
    }

    const MARKER_KEYS = [
      "hemoglobin", "fasting_blood_sugar", "postprandial_blood_sugar", "hba1c",
      "total_cholesterol", "triglycerides", "hdl", "ldl", "vldl",
      "vitamin_d", "vitamin_b12", "tsh", "uric_acid", "creatinine",
      "iron", "ferritin", "calcium"
    ];

    const systemPrompt = `You are a medical lab report analyzer. Extract blood test values from the uploaded report.

IMPORTANT RULES:
- Only extract values that are ACTUALLY present in the report
- NEVER guess, invent, or fill in missing values with "normal" ranges
- Return null for any value not clearly stated in the report
- Include units and reference ranges if visible in the report
- Provide status (low/normal/high) only if explicitly stated in the report

Return a JSON object with this exact structure:
{
  "markers": {
    "hemoglobin": {"value": number|null, "unit": string|null, "reference_range": string|null, "status": "low|normal|high|null"},
    "fasting_blood_sugar": {"value": number|null, "unit": string|null, "reference_range": string|null, "status": "low|normal|high|null},
    "postprandial_blood_sugar": {"value": number|null, "unit": string|null, "reference_range": string|null, "status": "low|normal|high|null},
    "hba1c": {"value": number|null, "unit": string|null, "reference_range": string|null, "status": "low|normal|high|null},
    "total_cholesterol": {"value": number|null, "unit": string|null, "reference_range": string|null, "status": "low|normal|high|null},
    "triglycerides": {"value": number|null, "unit": string|null, "reference_range": string|null, "status": "low|normal|high|null},
    "hdl": {"value": number|null, "unit": string|null, "reference_range": string|null, "status": "low|normal|high|null},
    "ldl": {"value": number|null, "unit": string|null, "reference_range": string|null, "status": "low|normal|high|null},
    "vldl": {"value": number|null, "unit": string|null, "reference_range": string|null, "status": "low|normal|high|null},
    "vitamin_d": {"value": number|null, "unit": string|null, "reference_range": string|null, "status": "low|normal|high|null},
    "vitamin_b12": {"value": number|null, "unit": string|null, "reference_range": string|null, "status": "low|normal|high|null},
    "tsh": {"value": number|null, "unit": string|null, "reference_range": string|null, "status": "low|normal|high|null},
    "uric_acid": {"value": number|null, "unit": string|null, "reference_range": string|null, "status": "low|normal|high|null},
    "creatinine": {"value": number|null, "unit": string|null, "reference_range": string|null, "status": "low|normal|high|null},
    "iron": {"value": number|null, "unit": string|null, "reference_range": string|null, "status": "low|normal|high|null},
    "ferritin": {"value": number|null, "unit": string|null, "reference_range": string|null, "status": "low|normal|high|null},
    "calcium": {"value": number|null, "unit": string|null, "reference_range": string|null, "status": "low|normal|high|null}
  },
  "reportDate": "YYYY-MM-DD|null (extract from report if visible)",
  "labName": "string|null (extract lab name if visible)",
  "notes": "string|null (any additional notes from report)",
  "warnings": ["string array (list any issues or concerns)"]
}`;

    console.log('Calling OpenAI Vision API with multiple images...');
    
    // Create message content with text and all images
    const messageContent = [
      { type: "text", text: `Extract all blood test values from these ${files.length} medical report images. Be precise and only include values that are clearly visible. Analyze all images comprehensively and combine the results.` },
      ...imageContents
    ];
    
    // Use OpenAI Vision API for multiple image analysis
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: messageContent }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
      max_tokens: 3000, // Increased for multiple images
    });
    
    console.log('OpenAI API call successful');
    const content = completion.choices[0]?.message?.content;

    if (!content) {
      console.error('No content in AI response');
      throw new Error("No content in AI response");
    }

    let result;
    try {
      result = JSON.parse(content.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse blood report data from AI response");
    }

    // Validate the response structure
    if (!result || typeof result !== 'object') {
      throw new Error("Invalid AI response format");
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Error extracting blood report:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    
    let statusCode = 500;
    let userMessage = "Failed to extract blood report data";
    
    if (errorMessage.includes("OpenAI API key") || errorMessage.includes("API key")) {
      userMessage = "API configuration error. Please contact support.";
    } else if (errorMessage.includes("quota") || errorMessage.includes("rate limit")) {
      statusCode = 429;
      userMessage = "API rate limit exceeded. Please try again later.";
    } else if (errorMessage.includes("ENOENT") || errorMessage.includes("ECONNREFUSED")) {
      userMessage = "Service temporarily unavailable. Please try again later.";
    } else {
      userMessage = errorMessage || "Failed to extract blood report data";
    }
    
    // Always return JSON response
    try {
      res.status(statusCode).json({ error: userMessage });
    } catch (jsonError) {
      res.status(statusCode).setHeader('Content-Type', 'text/plain').send(userMessage);
    }
  }
});

// ---------------------------------------------------------------------------
// Client portal access — creates/removes the Supabase Auth login a client
// uses to sign into the client-pwa. Requires the service-role key because
// creating an auth user with a password is an admin-only operation.
// ---------------------------------------------------------------------------
app.post('/api/portal/enable', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({
      error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server. Add it to .env and restart.',
    });
  }

  const { clientId, email, password } = req.body || {};
  if (!clientId || !email || !password) {
    return res.status(400).json({ error: 'clientId, email, and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    // Use the service-role client here: this request has no logged-in Supabase
    // session, so the anon-key client would run as the `anon` role, which the
    // RLS policies (scoped `TO authenticated`) correctly give zero rows to.
    const { data: client, error: clientErr } = await supabaseAdmin
      .from('clients')
      .select('id, email')
      .eq('id', clientId)
      .single();
    if (clientErr || !client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const { data: existingLink } = await supabaseAdmin
      .from('client_portal_users')
      .select('id')
      .eq('client_id', clientId)
      .maybeSingle();
    if (existingLink) {
      return res.status(409).json({ error: 'Portal access is already enabled for this client' });
    }

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr) {
      return res.status(400).json({ error: createErr.message });
    }

    const { error: linkErr } = await supabaseAdmin.from('client_portal_users').insert({
      user_id: created.user.id,
      client_id: clientId,
    });
    if (linkErr) {
      // Roll back the auth user so we don't leave an orphaned login.
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      return res.status(500).json({ error: linkErr.message });
    }

    // Keep the client's email on record in sync with the login email.
    if (client.email !== email) {
      await supabaseAdmin.from('clients').update({ email }).eq('id', clientId);
    }

    res.status(200).json({ success: true, userId: created.user.id });
  } catch (error) {
    console.error('Error enabling portal access:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to enable portal access' });
  }
});

app.post('/api/portal/disable', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({
      error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server. Add it to .env and restart.',
    });
  }

  const { clientId } = req.body || {};
  if (!clientId) {
    return res.status(400).json({ error: 'clientId is required' });
  }

  try {
    const { data: link, error: linkErr } = await supabaseAdmin
      .from('client_portal_users')
      .select('id, user_id')
      .eq('client_id', clientId)
      .maybeSingle();
    if (linkErr) throw linkErr;
    if (!link) {
      return res.status(404).json({ error: 'Portal access is not enabled for this client' });
    }

    await supabaseAdmin.from('client_portal_users').delete().eq('id', link.id);
    await supabaseAdmin.auth.admin.deleteUser(link.user_id);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error disabling portal access:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to disable portal access' });
  }
});

app.post('/api/portal/reset-password', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({
      error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server. Add it to .env and restart.',
    });
  }

  const { clientId, password } = req.body || {};
  if (!clientId || !password) {
    return res.status(400).json({ error: 'clientId and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const { data: link, error: linkErr } = await supabaseAdmin
      .from('client_portal_users')
      .select('user_id')
      .eq('client_id', clientId)
      .maybeSingle();
    if (linkErr) throw linkErr;
    if (!link) {
      return res.status(404).json({ error: 'Portal access is not enabled for this client' });
    }

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(link.user_id, { password });
    if (updErr) throw updErr;

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error resetting portal password:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to reset password' });
  }
});

// ---------------------------------------------------------------------------
// Google Calendar / Meet endpoints
// ---------------------------------------------------------------------------

// Redirect the admin's browser straight to Google's consent screen.
app.get('/api/google/connect', (req, res) => {
  const oauth2Client = googleOAuthClient();
  if (!oauth2Client) {
    return res.status(500).send(
      'Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in .env and restart the server.'
    );
  }
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // force a refresh_token every time, even on reconnect
    scope: GOOGLE_SCOPES,
  });
  res.redirect(url);
});

// Google redirects back here with ?code=... after the admin grants access.
app.get('/api/google/oauth/callback', async (req, res) => {
  const oauth2Client = googleOAuthClient();
  if (!oauth2Client || !supabaseAdmin) {
    return res.status(500).send('Google OAuth or Supabase service role is not configured.');
  }
  const { code, error } = req.query;
  if (error) {
    return res.redirect(`${FRONTEND_URL}/integrations?google_error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return res.redirect(`${FRONTEND_URL}/integrations?google_error=missing_code`);
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) {
      // Happens if the user had already granted access before and Google
      // didn't re-issue one — prompt=consent above should prevent this, but
      // guard anyway rather than silently storing nothing usable.
      return res.redirect(`${FRONTEND_URL}/integrations?google_error=no_refresh_token`);
    }
    oauth2Client.setCredentials(tokens);

    let connectedEmail = null;
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const { data: userInfo } = await oauth2.userinfo.get();
      connectedEmail = userInfo.email ?? null;
    } catch {
      // Non-fatal — we can still operate without knowing the email to display.
    }

    // Single active connection: replace whatever was there before.
    await supabaseAdmin.from('google_calendar_connections').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const { error: insertErr } = await supabaseAdmin.from('google_calendar_connections').insert({
      refresh_token: tokens.refresh_token,
      connected_email: connectedEmail,
    });
    if (insertErr) throw insertErr;

    res.redirect(`${FRONTEND_URL}/integrations?google_connected=1`);
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    res.redirect(`${FRONTEND_URL}/integrations?google_error=${encodeURIComponent(err.message || 'unknown')}`);
  }
});

app.get('/api/google/status', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(200).json({ connected: false });
  }
  const { data: connection } = await supabaseAdmin
    .from('google_calendar_connections')
    .select('connected_email')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  res.status(200).json({ connected: !!connection, email: connection?.connected_email ?? null });
});

app.post('/api/google/disconnect', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase service role is not configured' });
  }
  await supabaseAdmin.from('google_calendar_connections').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  res.status(200).json({ success: true });
});

// Creates a Google Calendar event (with a Meet link) for an appointment and
// writes google_event_id/meet_link back onto the appointments row.
app.post('/api/google/calendar/create-event', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase service role is not configured' });
  }
  const { appointmentId } = req.body || {};
  if (!appointmentId) {
    return res.status(400).json({ error: 'appointmentId is required' });
  }

  try {
    const authClient = await getConnectedGoogleClient();
    if (!authClient) {
      return res.status(409).json({
        error: 'Google Calendar is not connected yet. Connect it from the Integrations page first.',
      });
    }

    const { data: appointment, error: apptErr } = await supabaseAdmin
      .from('appointments')
      .select('id, appointment_date, appointment_time, appointment_type, notes, clients(name, email)')
      .eq('id', appointmentId)
      .single();
    if (apptErr || !appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const typeLabel = APPOINTMENT_TYPE_LABELS[appointment.appointment_type] || appointment.appointment_type;
    const clientName = appointment.clients?.name ?? 'Client';
    const clientEmail = appointment.clients?.email || null;

    const startDateTime = `${appointment.appointment_date}T${appointment.appointment_time}`;
    const startDate = new Date(startDateTime);
    const endDate = new Date(startDate.getTime() + 30 * 60 * 1000); // 30-minute default

    const calendar = google.calendar({ version: 'v3', auth: authClient });
    const { data: event } = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      sendUpdates: clientEmail ? 'all' : 'none',
      requestBody: {
        summary: `${typeLabel} — ${clientName} (From Monday)`,
        description: appointment.notes || undefined,
        start: { dateTime: startDate.toISOString(), timeZone: 'Asia/Kolkata' },
        end: { dateTime: endDate.toISOString(), timeZone: 'Asia/Kolkata' },
        attendees: clientEmail ? [{ email: clientEmail }] : undefined,
        conferenceData: {
          createRequest: {
            requestId: `appt-${appointment.id}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      },
    });

    const meetLink = event.hangoutLink || null;
    await supabaseAdmin
      .from('appointments')
      .update({ google_event_id: event.id, meet_link: meetLink })
      .eq('id', appointmentId);

    res.status(200).json({ success: true, meetLink, eventId: event.id });
  } catch (error) {
    console.error('Error creating Google Calendar event:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create calendar event' });
  }
});

app.post('/api/google/calendar/delete-event', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase service role is not configured' });
  }
  const { appointmentId } = req.body || {};
  if (!appointmentId) {
    return res.status(400).json({ error: 'appointmentId is required' });
  }

  try {
    const { data: appointment } = await supabaseAdmin
      .from('appointments')
      .select('google_event_id')
      .eq('id', appointmentId)
      .maybeSingle();

    if (appointment?.google_event_id) {
      const authClient = await getConnectedGoogleClient();
      if (authClient) {
        const calendar = google.calendar({ version: 'v3', auth: authClient });
        try {
          await calendar.events.delete({ calendarId: 'primary', eventId: appointment.google_event_id, sendUpdates: 'all' });
        } catch (err) {
          // Event may already be gone (e.g. deleted manually in Google Calendar) — not fatal.
          console.warn('Could not delete Google Calendar event (continuing):', err.message);
        }
      }
    }

    await supabaseAdmin
      .from('appointments')
      .update({ google_event_id: null, meet_link: null })
      .eq('id', appointmentId);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting Google Calendar event:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete calendar event' });
  }
});

app.listen(3000, () => console.log('Backend: http://localhost:3000'));