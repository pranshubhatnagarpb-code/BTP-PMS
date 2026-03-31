import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  
  try {
    const { clientData } = req.body;
    
    const completion = await openai.chat.completions.create({
      model: "google/gemini-flash-exp:free",
      messages: [
        { role: "system", content: "30-day Indian diet JSON..." },
        { role: "user", content: `Client: ${JSON.stringify(clientData)}` }
      ],
    });

    res.status(200).json({ dietPlan: completion.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}