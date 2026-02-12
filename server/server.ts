// CRITICAL: Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env - skip in Vercel environment where env vars are provided directly
if (process.env.VERCEL !== '1') {
  console.log('[SERVER] Loading .env file...');
  console.log('[SERVER] process.cwd():', process.cwd());
  console.log('[SERVER] __dirname:', __dirname);

  const envPaths = [
    path.join(process.cwd(), '.env'),           // server/.env (when running from server dir)
    path.join(__dirname, '.env'),                // dist/.env (production)
    path.join(process.cwd(), '..', 'server', '.env'), // from root (if running from root)
  ];

  console.log('[SERVER] Trying .env paths:', envPaths);

  let envLoaded = false;
  for (const envPath of envPaths) {
    console.log(`[SERVER] Attempting: ${envPath}`);
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      console.log(`[SERVER] ✓ Loaded .env from: ${envPath}`);
      envLoaded = true;
      break;
    } else {
      console.log(`[SERVER] ✗ Failed: ${result.error.message}`);
    }
  }

  if (!envLoaded) {
    // Last resort: try default location
    const defaultResult = dotenv.config();
    if (!defaultResult.error) {
      console.log('[SERVER] ✓ Loaded .env from default location');
      envLoaded = true;
    } else {
      console.warn('[SERVER] ⚠ Could not find .env file (this is OK in Vercel where env vars are provided)');
      console.warn('[SERVER] Tried paths:', envPaths);
    }
  }
} else {
  console.log('[SERVER] Running in Vercel - using environment variables directly');
}

// Verify critical environment variables
console.log('[SERVER] Environment check:', {
  hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 40) + '...' || 'NOT SET',
  geonamesUsername: process.env.GEONAMES_USERNAME || 'NOT SET',
  hasGeonamesUsername: !!process.env.GEONAMES_USERNAME,
});

// #region agent log
fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server.ts:env-check',message:'Environment variables check after dotenv load',data:{geonamesUsername:process.env.GEONAMES_USERNAME||'NOT_SET',hasGeonamesUsername:!!process.env.GEONAMES_USERNAME,usernameType:typeof process.env.GEONAMES_USERNAME,allGeonamesKeys:Object.keys(process.env).filter(k=>k.toLowerCase().includes('geonames')).join(',')},timestamp:Date.now(),runId:'debug-geonames-env',hypothesisId:'H3'})}).catch(()=>{});
// #endregion

// Now import everything else (supabaseClient will use the loaded env vars)
// In Vercel, env vars are available immediately, so static imports are fine
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './src/middleware/errorHandler.js';
import { geoRestriction } from './src/middleware/geoRestriction.js';
import authRoutes from './src/routes/auth.js';
import ratesRoutes from './src/routes/rates.js';
import bookRoutes from './src/routes/book.js';
import historyRoutes from './src/routes/history.js';
import locationRoutes from './src/routes/locations.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy - required for Vercel and other reverse proxies
// This allows Express to correctly identify client IPs and handle X-Forwarded-* headers
if (process.env.VERCEL === '1' || process.env.NODE_ENV === 'production') {
  app.set('trust proxy', true);
}

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, or same-origin requests)
      if (!origin) {
        return callback(null, true);
      }
      
      // Check if origin matches any allowed origin
      const isAllowed = allowedOrigins.some(allowed => {
        // Exact match
        if (origin === allowed) {
          return true;
        }
        
        // Check if origin ends with the allowed domain (for subdomains)
        const allowedDomain = allowed.replace(/^https?:\/\//, '');
        const originDomain = origin.replace(/^https?:\/\//, '');
        
        // Exact domain match
        if (originDomain === allowedDomain) {
          return true;
        }
        
        // Subdomain match (e.g., origin: https://app.vercel.app, allowed: vercel.app)
        if (originDomain.endsWith('.' + allowedDomain)) {
          return true;
        }
        
        // Vercel preview deployments - allow any *.vercel.app origin if we're in Vercel
        if (process.env.VERCEL === '1' && originDomain.endsWith('.vercel.app')) {
          return true;
        }
        
        return false;
      });
      
      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked origin: ${origin}. Allowed origins: ${allowedOrigins.join(', ')}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());

// Geo-restriction middleware (only in production, can be disabled if needed)
// Apply to all routes except API and restricted page
if (process.env.NODE_ENV === 'production' && process.env.ENABLE_GEO_RESTRICTION !== 'false') {
  app.use((req, res, next) => {
    // Skip geo-restriction for API routes and restricted page
    if (req.path.startsWith('/api') || req.path === '/restricted') {
      return next();
    }
    return geoRestriction(req, res, next);
  });
}

// Rate limiting
// keyGenerator uses req.ip which respects trust proxy setting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20', 10), // limit each IP to N requests per windowMs (default: 20)
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api', apiLimiter, ratesRoutes);
app.use('/api', apiLimiter, bookRoutes);
app.use('/api/history', apiLimiter, historyRoutes);
app.use('/api/locations', apiLimiter, locationRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Supabase connection test
app.get('/api/test/supabase', async (req, res) => {
  try {
    console.log('[SUPABASE TEST] ===== Starting Test =====');
    console.log('[SUPABASE TEST] Environment check:', {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 40) + '...' || 'NOT SET',
    });
    
    console.log('[SUPABASE TEST] Using Supabase client...');
    // Import at top level - env vars are already available in Vercel
    const { supabaseAdmin } = await import('./src/lib/supabaseClient.js');
    console.log('[SUPABASE TEST] Client ready');
    
    // Try to query a simple table (clients table should exist)
    const { data, error, count } = await supabaseAdmin
      .from('clients')
      .select('*', { count: 'exact' })
      .limit(1);
    
    if (error) {
      console.error('[SUPABASE TEST] Error:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
        code: error.code,
        details: error,
        timestamp: new Date().toISOString(),
      });
    }
    
    console.log('[SUPABASE TEST] Success! Connected to Supabase');
    res.json({
      success: true,
      message: 'Successfully connected to Supabase',
      tableExists: true,
      clientCount: count || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[SUPABASE TEST] Exception:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      timestamp: new Date().toISOString(),
    });
  }
});

// Serve restricted page
app.get('/restricted', (req, res) => {
  // In Vercel, __dirname is /var/task/server/dist/
  // public/restricted.html is at /var/task/public/restricted.html
  // Try multiple possible paths
  const possiblePaths = [
    path.join(__dirname, '../../public/restricted.html'), // From server/dist/ -> public/
    path.join(__dirname, '../public/restricted.html'),   // Fallback
    path.join(process.cwd(), 'public/restricted.html'), // From root
  ];
  
  // Try to find the file
  let filePath = possiblePaths[0];
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        filePath = p;
        break;
      }
    } catch (err) {
      // Continue to next path
    }
  }
  
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('[RESTRICTED] Error serving restricted.html:', err);
      console.error('[RESTRICTED] Tried paths:', possiblePaths);
      // Fallback: send HTML directly
      res.status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Access Restricted - S2 International</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      padding: 48px;
      max-width: 600px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      text-align: center;
    }
    h1 { color: #1a202c; font-size: 32px; margin-bottom: 16px; }
    p { color: #4a5568; font-size: 18px; line-height: 1.6; margin-bottom: 24px; }
    .icon { font-size: 64px; margin-bottom: 24px; }
    .contact-info {
      background: #f7fafc;
      border-radius: 8px;
      padding: 24px;
      margin-top: 32px;
    }
    a { color: #667eea; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🌍</div>
    <h1>Access Restricted</h1>
    <p>We're sorry, but this shipping portal is currently only available in <strong>Canada</strong> and the <strong>United States</strong>.</p>
    <p>If you're located in one of these countries and believe this is an error, please contact our support team.</p>
    <div class="contact-info">
      <p><strong>Need Assistance?</strong></p>
      <p><a href="https://www.s-2international.com/contact" target="_blank">Contact S2 International</a></p>
    </div>
  </div>
</body>
</html>
      `);
    }
  });
});

// Serve static files in production (only when NOT in Vercel)
// In Vercel, static files are served separately via outputDirectory config
if (process.env.NODE_ENV === 'production' && process.env.VERCEL !== '1') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  
  // Catch-all route for SPA - only for non-API routes and non-Vercel
  app.get('*', (req, res, next) => {
    // Skip API routes - they should be handled by Express routes above
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

app.use(errorHandler);

// Export app for Vercel serverless functions
// Only listen if not in Vercel environment
if (process.env.VERCEL !== '1') {
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
    console.log(`   Supabase test: http://localhost:${PORT}/api/test/supabase`);
  }).on('error', (err: any) => {
    console.error(`❌ Failed to start server on port ${PORT}:`, err.message);
    if (err.code === 'EADDRINUSE') {
      console.error(`   Port ${PORT} is already in use. Close the other application or change PORT in .env`);
    }
    process.exit(1);
  });
}

export default app;
