/**
 * Vercel Edge Middleware for geo-restriction
 * Only allows access from Canada (CA) and United States (US)
 * 
 * This runs at the edge before your Express server, so it's fast and free.
 * 
 * Developer bypass: Add ?dev=true to the URL to bypass restrictions
 */

export default function middleware(req: Request): Response {
  // Get country from Vercel's geo headers
  const country = (req as any).geo?.country || 'UNKNOWN';
  
  // Allowed countries (added ZA for demo purposes)
  const allowedCountries = ['CA', 'US', 'ZA'];
  
  // Developer bypass via query parameter
  const url = new URL(req.url);
  const bypassKey = url.searchParams.get('dev');
  
  // Allow in development mode or with bypass key
  if (process.env.NODE_ENV === 'development' || bypassKey === 'true') {
    return new Response(null, { status: 200 });
  }
  
  // Check if country is allowed
  if (allowedCountries.includes(country)) {
    return new Response(null, { status: 200 });
  }
  
  // Block access - redirect to restricted page
  return Response.redirect(new URL('/restricted', req.url), 302);
}

// Configure which routes this middleware applies to
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (handled by Express serverless function)
     * - static assets (images, fonts, etc.)
     * - restricted page itself
     */
    '/((?!api|restricted|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
};
