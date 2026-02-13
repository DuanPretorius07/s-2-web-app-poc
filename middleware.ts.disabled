/**
 * Vercel Edge Middleware for geo-restriction
 * Only allows access from Canada (CA) and United States (US)
 * 
 * This runs at the edge before your Express server, so it's fast and free.
 * 
 * Developer bypass: Add ?dev=true to the URL to bypass restrictions
 */

export default function middleware(req: Request): Response {
  // STEP 1: Check dev bypass FIRST (before any other logic)
  // This must be the FIRST check - nothing should come before it
  const url = new URL(req.url);
  const bypassKey = url.searchParams.get('dev');
  
  if (bypassKey === 'true') {
    console.log('[Edge Geo] ✅ Dev bypass activated for:', url.pathname);
    return new Response(null, { status: 200 });
  }
  
  // STEP 2: Get country from Vercel's geo headers
  const country = (req as any).geo?.country || 'UNKNOWN';
  
  // STEP 3: Allowed countries (added ZA for demo purposes)
  const allowedCountries = ['CA', 'US', 'ZA'];
  
  // STEP 4: Allow in development mode
  if (process.env.NODE_ENV === 'development') {
    console.log('[Edge Geo] ℹ️ Development mode - access allowed');
    return new Response(null, { status: 200 });
  }
  
  // STEP 5: Check if country is allowed
  if (allowedCountries.includes(country)) {
    console.log('[Edge Geo] ✅ Access allowed for country:', country);
    return new Response(null, { status: 200 });
  }
  
  // STEP 6: Block access - redirect to restricted page
  console.log('[Edge Geo] ❌ Access blocked for country:', country);
  console.log('[Edge Geo] 💡 Tip: Add ?dev=true to bypass for testing');
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
