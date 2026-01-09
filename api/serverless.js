// Vercel serverless function entry point
// This exports the Express app for Vercel's serverless environment

// Note: Vercel provides environment variables directly, no need to load .env
import app from '../server/dist/server.js';

// Vercel serverless functions expect a default export that handles (req, res)
// Since we're exporting the Express app directly, Vercel will use it as a request handler
export default app;
