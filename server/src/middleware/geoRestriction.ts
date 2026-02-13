import { Request, Response, NextFunction } from 'express';

// Allowed countries for production
const ALLOWED_COUNTRIES = ['US', 'CA', 'ZA']; // ZA added for testing

/**
 * Geo-restriction middleware
 * Blocks access from countries not in the allowed list
 * Supports ?dev=true bypass for development/testing
 */
export function geoRestriction(req: Request, res: Response, next: NextFunction) {
  // Debug: Log everything about query params
  console.log('[Geo] DEBUG - Request details:', {
    path: req.path,
    url: req.url,
    originalUrl: req.originalUrl,
    queryObject: req.query,
    queryKeys: Object.keys(req.query || {}),
    devParam: req.query.dev,
    devParamValue: String(req.query.dev),
    devParamType: typeof req.query.dev,
    devCheck: req.query.dev === 'true',
    country: req.headers['x-vercel-ip-country'],
  });

  // STEP 1: Check dev bypass FIRST
  if (req.query.dev === 'true' || req.query.dev === true) {
    console.log('[Geo] ✅ Dev bypass activated for:', req.path);
    return next();
  }

  // STEP 2: Skip specific routes
  if (req.path === '/restricted' || req.path === '/api/health') {
    console.log('[Geo] ℹ️ Skipping geo-check for:', req.path);
    return next();
  }

  // STEP 3: Get country
  const country = (req.headers['x-vercel-ip-country'] as string)?.toUpperCase();

  // STEP 4: Check if allowed
  if (country && ALLOWED_COUNTRIES.includes(country)) {
    console.log('[Geo] ✅ Access allowed for country:', country);
    return next();
  }

  // STEP 5: Block
  console.log('[Geo] ❌ Access blocked for country:', country || 'UNKNOWN');
  res.redirect('/restricted');
}
