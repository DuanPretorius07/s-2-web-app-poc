import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env if not already loaded (defensive - should already be loaded by server.ts)
// But this ensures it works even if imported directly
if (!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL) {
  const envPaths = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '..', '.env'),
  ];
  
  for (const envPath of envPaths) {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      break;
    }
  }
}

// Get Supabase configuration from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// Log initialization (only in development)
if (process.env.NODE_ENV !== 'production') {
  console.log('[SUPABASE] Initializing client:', {
    url: supabaseUrl?.substring(0, 40) + '...' || 'NOT SET',
    hasServiceKey: !!supabaseServiceRoleKey,
    hasAnonKey: !!supabaseAnonKey,
  });
}

if (!supabaseUrl) {
  console.error('[SUPABASE] ❌ Missing Supabase URL!');
  console.error('[SUPABASE] Please set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL in server/.env');
  throw new Error('Missing Supabase URL environment variable: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
}

// Use service role key for server-side operations (bypasses RLS)
// Fall back to anon key if service role key is not available (for development)
const supabaseKey = supabaseServiceRoleKey || supabaseAnonKey;

if (!supabaseKey) {
  console.error('[SUPABASE] ❌ Missing Supabase API key!');
  console.error('[SUPABASE] Please set SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY in server/.env');
  throw new Error('Missing Supabase key: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Server-side client with service role key (bypasses Row Level Security)
// This is the primary client for all server-side operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: 'public',
  },
});

// Client for operations that should respect RLS (when using anon key)
// Only use this if you specifically need RLS enforcement
export const supabase = supabaseServiceRoleKey && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : supabaseAdmin;
