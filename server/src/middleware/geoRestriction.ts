import { Request, Response, NextFunction } from 'express';

// Allowed countries for production
const ALLOWED_COUNTRIES = ['US', 'CA', 'ZA']; // ZA added for testing

/**
 * Geo-restriction middleware
 * Blocks access from countries not in the allowed list
 * Supports ?dev=true bypass for development/testing
 */
export function geoRestriction(req: Request, res: Response, next: NextFunction) {
  // STEP 1: Check dev bypass FIRST (before any other logic)
  // This must be the FIRST check - nothing should come before it
  if (req.query.dev === 'true') {
    console.log('[Geo] ✅ Dev bypass activated for:', req.path);
    return next();
  }

  // STEP 2: Skip geo-restriction for specific routes
  const skipPaths = ['/restricted', '/api/health'];
  if (skipPaths.includes(req.path)) {
    console.log('[Geo] ℹ️ Skipping geo-check for:', req.path);
    return next();
  }

  // STEP 3: Get country from Vercel headers
  const country = (req.headers['x-vercel-ip-country'] as string)?.toUpperCase();
  
  console.log('[Geo] Request details:', {
    path: req.path,
    ip: req.ip,
    country: country || 'UNKNOWN',
    hasDevParam: req.query.dev === 'true',
    queryString: req.url,
  });

  // STEP 4: Check if country is allowed
  if (country && ALLOWED_COUNTRIES.includes(country)) {
    console.log('[Geo] ✅ Access allowed for country:', country);
    return next();
  }

  // STEP 5: Block and redirect
  console.log('[Geo] ❌ Access blocked for country:', country);
  console.log('[Geo] 💡 Tip: Add ?dev=true to bypass for testing');
  
  res.redirect('/restricted');
}
