import { Request, Response, NextFunction } from 'express';

/**
 * Express middleware for geo-restriction
 * Only allows access from Canada (CA) and United States (US)
 * 
 * Uses Vercel's geo headers when available, falls back to allowing all in development
 * 
 * Developer bypass: Add ?dev=true to the URL to bypass restrictions
 */
const ALLOWED_COUNTRIES = ['US', 'CA'];

export function geoRestriction(req: Request, res: Response, next: NextFunction) {
  // ALWAYS allow dev bypass FIRST (before any other checks)
  if (req.query.dev === 'true') {
    console.log('[Geo] Dev bypass activated for:', req.path);
    return next();
  }

  // Skip geo-restriction for API routes (they should work from anywhere)
  if (req.path.startsWith('/api/')) {
    return next();
  }

  // If already on /restricted route, serve the page (don't redirect)
  if (req.path === '/restricted') {
    return next();
  }

  // Get country from Vercel headers or IP
  const country = 
    (req.headers['x-vercel-ip-country'] as string) ||
    (req as any).geo?.country ||
    null;

  console.log('[Geo] Request from country:', country, 'IP:', req.ip, 'Path:', req.path);

  // Allow in development mode
  if (process.env.NODE_ENV === 'development') {
    console.log('[Geo] Development mode - access allowed');
    return next();
  }

  // If country is allowed, proceed
  if (country && ALLOWED_COUNTRIES.includes(country.toUpperCase())) {
    console.log('[Geo] Access allowed for country:', country);
    return next();
  }

  // Block access - redirect to restricted page
  console.log('[Geo] Access blocked - redirecting to /restricted');
  return res.redirect('/restricted');
}
