// Vercel serverless function entry point
// Keep this file CommonJS-friendly so Vercel can require it without ESM errors.

if (!process.env.VERCEL) {
  process.env.VERCEL = '1';
}

let cachedAppPromise;

module.exports = async (req, res) => {
  try {
    // Lazily import the ESM Express app. Dynamic import works in CJS on Vercel.
    if (!cachedAppPromise) {
      cachedAppPromise = import('../server/dist/server.js')
        .then(mod => {
          if (!mod || !mod.default) {
            const availableExports = mod ? Object.keys(mod).join(', ') : 'none';
            throw new Error(`Express app not found in server.js export. Available exports: ${availableExports}`);
          }
          return mod.default;
        })
        .catch(err => {
          console.error('[SERVERLESS] Failed to import Express app:', err);
          console.error('[SERVERLESS] Error details:', {
            message: err.message,
            code: err.code,
            stack: err.stack?.substring(0, 500),
          });
          cachedAppPromise = null; // Reset cache on error
          throw err;
        });
    }

    const app = await cachedAppPromise;
    
    if (!app) {
      throw new Error('Express app is null or undefined after import');
    }
    
    // Handle the request with Express app
    // Express app(req, res) is the correct way to invoke Express in serverless
    return app(req, res);
  } catch (error) {
    console.error('[SERVERLESS] Error handling request:', error);
    console.error('[SERVERLESS] Request details:', {
      method: req.method,
      url: req.url,
      path: req.path,
      headers: Object.keys(req.headers || {}),
    });
    
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to process request',
        ...(process.env.NODE_ENV === 'development' && { 
          stack: error.stack,
          details: error.toString(),
        }),
      });
    }
  }
};
