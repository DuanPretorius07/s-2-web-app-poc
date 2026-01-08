# Environment Variables Setup Guide

This guide clarifies what should be in each environment file for the Supabase-based application.

## 📋 Environment Files Overview

### 1. Server Environment (`server/.env`)

**Location:** `server/.env` (create from `server/env.example`)

**Current Status:** ✅ Already configured with Supabase

**Required Variables:**

```env
# ============================================
# SUPABASE CONFIGURATION (REQUIRED)
# ============================================
# Get these from: https://supabase.com/dashboard/project/[your-project]/settings/api

NEXT_PUBLIC_SUPABASE_URL="https://your-project-id.supabase.co"
# ⚠️ This is the Anon/Public key (safe for frontend, but also used here)
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key-here"
# ⚠️ This is the Service Role key (SECRET - server-side only!)
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"

# ============================================
# AUTHENTICATION
# ============================================
# Used for custom JWT tokens (not Supabase Auth)
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# ============================================
# SHIP2PRIMUS API CONFIGURATION (REQUIRED)
# ============================================
# Ship2Primus API endpoints and authentication
SHIP2PRIMUS_RATES_URL="https://s-2international-api.shipprimus.com/applet/v1/rate/multiple"
SHIP2PRIMUS_BOOK_URL="https://s-2international-api.shipprimus.com/api/v1/book"
SHIP2PRIMUS_LOGIN_URL="https://s-2international-api.shipprimus.com/api/v1/login"
SHIP2PRIMUS_USERNAME="your-ship2primus-username"
SHIP2PRIMUS_PASSWORD="your-ship2primus-password"

# AWS Configuration (if needed for AWS SDK operations)
AWS_REGION="us-east-1"

# ============================================
# HUBSPOT INTEGRATION (OPTIONAL - NOT CONFIGURED YET)
# ============================================
# HubSpot integration is not set up yet, leave empty
HUBSPOT_ACCESS_TOKEN=""

# ============================================
# CORS CONFIGURATION
# ============================================
ALLOWED_ORIGINS="http://localhost:3000,https://app.hubspot.com,https://*.hubspot.com"

# ============================================
# SERVER CONFIGURATION
# ============================================
PORT=5000
NODE_ENV=development
```

**⚠️ DEPRECATED (Old variables - no longer used but harmless if kept):**
- ~~`DATABASE_URL`~~ (replaced by Supabase) - Can be removed
- ~~`MONGODB_URI`~~ (replaced by Supabase) - Can be removed
- ~~`API_GATEWAY_RATES_URL`~~ (replaced by `SHIP2PRIMUS_RATES_URL`) - Optional: keep for reference or remove
- ~~`API_GATEWAY_BOOK_URL`~~ (replaced by `SHIP2PRIMUS_BOOK_URL`) - Optional: keep for reference or remove
- ~~`PROXY_API_KEY`~~ (replaced by Ship2Primus login authentication) - Optional: keep for reference or remove

**Note:** The old API Gateway variables won't cause errors if kept - they're simply not used by the code anymore. Remove them if you want a cleaner environment file, or keep them for backup/reference.

---

### 2. Client Environment (`client/.env`)

**Location:** `client/.env` (needs to be created)

**Current Status:** ❌ Missing - needs to be created

**Required Variables:**

```env
# ============================================
# SUPABASE CONFIGURATION (REQUIRED FOR FRONTEND)
# ============================================
# Note: Vite requires VITE_ prefix for environment variables
# These values should match the Supabase values in server/.env

VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Important Notes:**
- ✅ The `VITE_` prefix is required for Vite to expose these to the frontend
- ✅ Both values come from your Supabase project settings (same as server)
- ✅ `VITE_SUPABASE_ANON_KEY` is safe to expose in frontend code (it's designed for this)
- ❌ Never put `SUPABASE_SERVICE_ROLE_KEY` in the client `.env` (it's secret!)

---

## 🔄 Migration Checklist

### If You See MongoDB/Prisma References:

#### In `server/.env`:
- ❌ Remove: `DATABASE_URL="mongodb://..."` or `DATABASE_URL="postgresql://..."`
- ❌ Remove: `MONGODB_URI=...`
- ✅ Keep/Add: Supabase variables (as shown above)

#### In `client/.env`:
- ✅ Create this file if it doesn't exist
- ✅ Add only the `VITE_SUPABASE_*` variables

#### In Documentation:
- The `README.md` and `QUICKSTART.md` still reference Prisma (documentation only, doesn't affect functionality)
- Consider updating them later for accuracy

---

## 🔍 How to Verify Your Setup

### Step 1: Check Server Environment
```bash
cd server
# Check if .env exists and has Supabase variables
# Should see NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, etc.
```

### Step 2: Check Client Environment
```bash
cd client
# Check if .env exists
# Should see VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

### Step 3: Get Your Supabase Keys

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Go to: **Settings** → **API**
4. Copy:
   - **Project URL** → Use for `NEXT_PUBLIC_SUPABASE_URL` and `VITE_SUPABASE_URL`
   - **anon/public key** → Use for `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `VITE_SUPABASE_ANON_KEY`
   - **service_role key** → Use for `SUPABASE_SERVICE_ROLE_KEY` (server only!)

### Step 4: Configure Ship2Primus API Credentials

1. Contact your Ship2Primus administrator to get:
   - **Username** → Use for `SHIP2PRIMUS_USERNAME`
   - **Password** → Use for `SHIP2PRIMUS_PASSWORD`
2. The API URLs are already set in `env.example`:
   - `SHIP2PRIMUS_RATES_URL` = `https://s-2international-api.shipprimus.com/applet/v1/rate/multiple`
   - `SHIP2PRIMUS_BOOK_URL` = `https://s-2international-api.shipprimus.com/api/v1/book`
   - `SHIP2PRIMUS_LOGIN_URL` = `https://s-2international-api.shipprimus.com/api/v1/login`

---

## 📝 Quick Reference

| Variable | Where | Purpose | Secret? |
|----------|-------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | `server/.env` | Supabase project URL | ❌ Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `server/.env` | Supabase anon key | ❌ Public (designed for frontend) |
| `SUPABASE_SERVICE_ROLE_KEY` | `server/.env` | Supabase service role key | ✅ **SECRET** (server only) |
| `VITE_SUPABASE_URL` | `client/.env` | Same as above, for frontend | ❌ Public |
| `VITE_SUPABASE_ANON_KEY` | `client/.env` | Same as above, for frontend | ❌ Public |
| `SHIP2PRIMUS_RATES_URL` | `server/.env` | Ship2Primus rates API endpoint | ❌ Public URL |
| `SHIP2PRIMUS_BOOK_URL` | `server/.env` | Ship2Primus booking API endpoint | ❌ Public URL |
| `SHIP2PRIMUS_LOGIN_URL` | `server/.env` | Ship2Primus authentication endpoint | ❌ Public URL |
| `SHIP2PRIMUS_USERNAME` | `server/.env` | Ship2Primus API username | ✅ **SECRET** |
| `SHIP2PRIMUS_PASSWORD` | `server/.env` | Ship2Primus API password | ✅ **SECRET** |
| `AWS_REGION` | `server/.env` | AWS region for SDK operations | ❌ Public |

---

## ⚠️ Common Mistakes to Avoid

1. ❌ **Don't put `SUPABASE_SERVICE_ROLE_KEY` in `client/.env`** - It's secret!
2. ❌ **Don't use `DATABASE_URL` anymore** - Use Supabase variables instead
3. ❌ **Don't forget the `VITE_` prefix** in client environment variables
4. ❌ **Don't use old `API_GATEWAY_*` variables** - Use `SHIP2PRIMUS_*` variables instead
5. ❌ **Don't expose `SHIP2PRIMUS_USERNAME` or `SHIP2PRIMUS_PASSWORD`** - Keep them secret in server only
6. ✅ **Do use the same Supabase URL and anon key** in both server and client
7. ✅ **Do keep `SUPABASE_SERVICE_ROLE_KEY` only in server**
8. ✅ **Do ensure Ship2Primus credentials are set** - Required for rates and booking functionality

---

## 🆘 If You're Still Seeing MongoDB References

If you find MongoDB connection strings anywhere:

1. **In `server/.env`**: Replace with Supabase variables (see above)
2. **In code files**: The codebase should already be migrated, but if you see MongoDB imports, they need to be removed
3. **In `package.json`**: Remove MongoDB packages if present (e.g., `mongodb`, `mongoose`)

Run this to search for any remaining MongoDB references:
```bash
grep -r "mongodb\|mongoose\|MongoDB" --exclude-dir=node_modules .
```
