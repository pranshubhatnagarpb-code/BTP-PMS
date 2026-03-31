export default async function handler(req, res) {
  try {
    console.log('Diet plan function called successfully');
    
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { clientDetails } = req.body;
    
    if (!clientDetails) {
      return res.status(400).json({ error: 'clientDetails is required' });
    }

    // Return a simple mock response to test the structure
    res.status(200).json({ 
      dietPlan: {
        planName: `Food Plan for ${clientDetails.name || 'Client'}`,
        introMessage: "This is a test to verify the API structure is working.",
        test: true
      }
    });
  } catch (error) {
    console.error('Diet plan function error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
