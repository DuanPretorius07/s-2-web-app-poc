// Vercel serverless function entry point
// Keep this file CommonJS-friendly so Vercel can require it without ESM errors.

if (!process.env.VERCEL) {
  process.env.VERCEL = '1';
}

let cachedAppPromise;

module.exports = async (req, res) => {
  // Lazily import the ESM Express app. Dynamic import works in CJS on Vercel.
  if (!cachedAppPromise) {
    cachedAppPromise = import('../server/dist/server.js').then(mod => mod.default);
  }

  const app = await cachedAppPromise;
  return app(req, res);
};
