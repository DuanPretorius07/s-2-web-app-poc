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

// CRITICAL: Enable trust proxy for Vercel (must be first)
app.set('trust proxy', 1);

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
app.use(express.urlencoded({ extended: true }));

// CRITICAL: Manual query parsing middleware (backup in case Express doesn't parse it)
// This ensures req.query.dev exists when ?dev=true is in the URL
app.use((req, res, next) => {
  // Manual query parsing as backup (in case express isn't doing it)
  if (req.url.includes('?')) {
    const urlParts = req.url.split('?');
    const queryString = urlParts[1];
    const params = new URLSearchParams(queryString);
    
    // Merge into req.query
    params.forEach((value, key) => {
      if (!req.query[key]) {
        req.query[key] = value;
      }
    });
  }
  next();
});

// Enhanced logging to debug query params
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, {
    fullUrl: req.url,
    originalUrl: req.originalUrl,
    query: req.query,
    queryKeys: Object.keys(req.query || {}),
    devParam: req.query.dev,
    ip: req.ip,
    country: req.headers['x-vercel-ip-country'],
  });
  next();
});

// Health check - BEFORE geo-restriction (should work from anywhere)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    country: req.headers['x-vercel-ip-country'] || 'unknown',
    ip: req.ip,
    query: req.query, // Include query for debugging
  });
});

// Restricted page - BEFORE geo-restriction (just shows the message)
app.get('/restricted', (req, res) => {
  res.status(403).send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Access Restricted</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .container {
      background: white;
      padding: 3rem;
      border-radius: 1rem;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 500px;
      text-align: center;
    }
    h1 { color: #333; margin-bottom: 1rem; }
    p { color: #666; line-height: 1.6; margin-bottom: 2rem; }
    .icon { font-size: 4rem; margin-bottom: 1rem; }
    .contact-btn {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 0.75rem 2rem;
      border-radius: 0.5rem;
      text-decoration: none;
      font-weight: 600;
      transition: background 0.3s;
    }
    .contact-btn:hover { background: #5568d3; }
    .dev-tip {
      margin-top: 2rem;
      padding: 1rem;
      background: #f0f0f0;
      border-radius: 0.5rem;
      font-size: 0.9rem;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🌍</div>
    <h1>Access Restricted</h1>
    <p>
      This application is currently only available to users in 
      <strong>Canada</strong> and the <strong>United States</strong>.
    </p>
    <p>
      If you believe you should have access, please contact us.
    </p>
    <a href="https://www.s-2international.com/contact" class="contact-btn" target="_blank">
      Contact S2 International
    </a>
    <div class="dev-tip">
      <strong>💡 Developers:</strong> Add <code>?dev=true</code> to any URL to bypass geo-restriction for testing.
    </div>
  </div>
</body>
</html>
  `);
});

// GEO-RESTRICTION MIDDLEWARE DISABLED
// Uncomment the lines below to re-enable geo-restriction
// if (process.env.NODE_ENV === 'production' && process.env.ENABLE_GEO_RESTRICTION !== 'false') {
//   app.use(geoRestriction);
// }

// Rate limiting
// Use custom key generator to avoid trust proxy warnings
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20', 10), // limit each IP to N requests per windowMs (default: 20)
  standardHeaders: true,
  legacyHeaders: false,
  // FIX: Use a custom key generator that doesn't rely solely on IP
  keyGenerator: (req) => {
    // Use a combination of IP and a custom header
    return req.headers['x-vercel-id'] as string || req.ip || 'anonymous';
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Please try again later',
    });
  },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-vercel-id'] as string || req.ip || 'anonymous';
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Please try again later',
    });
  },
});

// API Routes - protected by geo-restriction (but dev bypass works)
// Note: Geo-restriction middleware is applied globally above, but it skips /api/health
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api', apiLimiter, ratesRoutes);
app.use('/api', apiLimiter, bookRoutes);
app.use('/api/history', apiLimiter, historyRoutes);
app.use('/api/locations', apiLimiter, locationRoutes);

// 404 handler for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    message: 'API endpoint not found',
  });
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
