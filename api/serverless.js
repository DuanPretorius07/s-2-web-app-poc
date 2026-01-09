// Vercel serverless function entry point
// This exports the Express app for Vercel's serverless environment

// Vercel automatically sets VERCEL=1, but we should mark it explicitly for our code
if (!process.env.VERCEL) {
  process.env.VERCEL = '1';
}

// Note: Vercel provides environment variables directly, no need to load .env
// Import the Express app - env vars should be available at import time in Vercel
import app from '../server/dist/server.js';

// Vercel serverless functions expect a default export that handles (req, res)
// Since we're exporting the Express app directly, Vercel will use it as a request handler
export default app;
