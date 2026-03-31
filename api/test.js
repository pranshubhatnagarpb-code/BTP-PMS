export default function handler(req, res) {
  try {
    console.log('Function called with method:', req.method);
    res.status(200).json({ 
      message: 'API function is working!',
      method: req.method,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Function error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
