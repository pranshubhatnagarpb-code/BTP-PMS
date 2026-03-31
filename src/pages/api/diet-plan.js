// API endpoint to generate diet plans using OpenAI instead of Lovable Gemini
import express from 'express';
import OpenAI from 'openai';

const router = express.Router();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const getDayGroupings = (numberOfDays) => {
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

router.post('/diet-plan', async (req, res) => {
  try {
    const { clientDetails, customPrompt, numberOfDays = 7 } = req.body;
    
    if (!clientDetails) {
      return res.status(400).json({ error: 'clientDetails is required' });
    }

    const goalText = {
      weight_loss: "weight loss / fat loss",
      weight_gain: "weight gain / muscle building",
      maintain: "weight maintenance"
    }[clientDetails.goal];

    const dayGroups = getDayGroupings(numberOfDays);
    const groupDescriptions = dayGroups.map((g, i) => `- Group ${i + 1}: ${g.label} (same meals for paired days)`).join('\n');
    const groupJsonExamples = dayGroups.map((g, i) => {
      if (i === 0) {
        return `    {
      "label": "${g.label}",
      "meals": [
        { "period": "Upon waking up", "time": "7:00 AM", "foodPlan": "Specific food with quantities", "alternative": "Alternative option with quantities", "notes": "Preparation notes" },
        { "period": "Mid Morning", "time": "9:00 AM", "foodPlan": "...", "alternative": "...", "notes": "..." },
        { "period": "Breakfast", "time": "10:30 AM", "foodPlan": "...", "alternative": "...", "notes": "..." },
        { "period": "Lunch", "time": "1:00 PM", "foodPlan": "...", "alternative": "...", "notes": "..." },
        { "period": "Evening Snack", "time": "5:00 PM", "foodPlan": "...", "alternative": "...", "notes": "..." },
        { "period": "Dinner", "time": "7:30 PM", "foodPlan": "...", "alternative": "...", "notes": "..." },
        { "period": "Bedtime", "time": "9:30 PM", "foodPlan": "...", "alternative": "...", "notes": "" }
      ]
    }`;
      }
      return `    { "label": "${g.label}", "meals": [...] }`;
    }).join(',\n');

    const systemPrompt = `You are an expert Indian nutritionist and dietitian specializing in holistic nutrition. Create a detailed, time-based food plan with authentic Indian meals.

CRITICAL STRUCTURE: The plan must be organized with these day-groups:
${groupDescriptions}

Each day-group should have DIFFERENT meals from the others to provide variety. Do NOT use "OR" options - give ONE specific meal per period per day-group. For EVERY meal period, also provide ONE alternative option that the client can swap in if they don't like the primary option.

Your response must be a valid JSON object with exactly this structure:
{
  "planName": "Food Plan for [Client Name]",
  "introMessage": "A personalized 2-3 sentence message about the food plan.",
  "affirmations": ["3 positive health affirmations"],
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
- Include approximate quantities needed for the week`;

    const groupLabels = dayGroups.map(g => g.label).join(', ');

    const userPrompt = `Create a personalized detailed food plan for:

**Client Profile:**
- Name: ${clientDetails.name}
- Goal: ${goalText}
- Height: ${clientDetails.height} cm
- Weight: ${clientDetails.weight} kg
- Age: ${clientDetails.age} years
- Gender: ${clientDetails.gender}
- Diet Preference: ${clientDetails.dietPreference}

**Skin & Hair:**
- Skin Type: ${clientDetails.skinType}
- Hair Type: ${clientDetails.hairType}

**Health Conditions/Concerns:**
${clientDetails.healthConditions.length > 0 ? clientDetails.healthConditions.join(', ') : 'None specified'}
${customPrompt ? `\n**Additional Instructions from Nutritionist:**\n${customPrompt}` : ''}

Create a comprehensive food plan covering ${numberOfDays} days with day-groups (${groupLabels}), each having unique meals. Include oil guidelines and important dietary notes.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;

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

    res.json({ dietPlan });
  } catch (error) {
    console.error("Error generating diet plan:", error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    });
  }
});

export default router;