import { Request, Response, NextFunction } from 'express';

/**
 * Express middleware for geo-restriction
 * Only allows access from Canada (CA) and United States (US)
 * 
 * Uses Vercel's geo headers when available, falls back to allowing all in development
 * 
 * Developer bypass: Add ?dev=true to the URL to bypass restrictions
 */
export function geoRestriction(req: Request, res: Response, next: NextFunction) {
  // Get country from Vercel's geo headers (available in Vercel deployments)
  const country = (req.headers['x-vercel-ip-country'] as string) || 
                  (req as any).geo?.country || 
                  'UNKNOWN';
  
  // Allowed countries
  const allowedCountries = ['CA', 'US'];
  
  // Developer bypass via query parameter
  const bypassKey = req.query.dev;
  
  // Allow in development mode or with bypass key
  if (process.env.NODE_ENV === 'development' || bypassKey === 'true') {
    return next();
  }
  
  // Check if country is allowed
  if (allowedCountries.includes(country)) {
    return next();
  }
  
  // Block access - redirect to restricted page
  return res.redirect('/restricted');
}
