import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

async function startServer() {
  // Load environment variables from .env.local
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  config({ path: join(__dirname, '.env.local/.env.local') });

  // Import the diet plan router
  const dietPlanRoutes = await import('./src/pages/api/diet-plan.js');

  const app = express();
  const PORT = process.env.PORT || 3001;

  // Middleware
  app.use(cors());
  app.use(express.json());

  // API Routes
  app.use('/api', dietPlanRoutes.default);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  // Start server
  app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`OpenAI API Key configured: ${!!process.env.OPENAI_API_KEY}`);
  });
}

startServer().catch(console.error);