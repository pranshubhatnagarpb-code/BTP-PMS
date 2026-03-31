exports.handler = function (req, res) {
  console.log('Function called with method:', req.method);
  res.status(200).json({ 
    message: 'API function is working!',
    method: req.method,
    timestamp: new Date().toISOString()
  });
};
