# Deployment Guide

## Manual Changes Required

### 1. Database Column Names Verification

**Status**: ✅ Already correct in code

The codebase uses `firstname` and `lastname` (camelCase) which matches the Supabase schema. No changes needed.

**Verify your Supabase database has:**
- `users.firstname` (not `first_name`)
- `users.lastname` (not `last_name`)

If your database uses snake_case, you'll need to either:
- Update the database schema to use camelCase, OR
- Update the code to use snake_case (not recommended as it's already correct)

### 2. Supabase Database Setup

Ensure the following tables and columns exist:

**`users` table:**
```sql
- id (uuid, primary key)
- email (text, unique)
- firstname (text)  -- Note: camelCase, not first_name
- lastname (text)   -- Note: camelCase, not last_name
- password_hash (text)
- client_id (uuid, foreign key to clients.id)
- role (text: 'ADMIN' | 'USER')
- hubspot_opt_in (boolean, nullable)
```

**`clients` table:**
```sql
- id (uuid, primary key)
- name (text)
- rate_tokens_remaining (integer, default 3)
- rate_tokens_used (integer, default 0)
```

**`quote_requests` table:**
```sql
- id (uuid, primary key)
- client_id (uuid)
- user_id (uuid)
- request_payload_json (jsonb)
- created_at (timestamp)
```

**`rates` table:**
```sql
- id (uuid, primary key)
- quote_request_id (uuid, foreign key)
- rate_id (text)
- carrier_name (text)
- service_name (text)
- transit_days (integer)
- total_cost (numeric)
- currency (text)
- raw_json (jsonb)
```

**`bookings` table:**
```sql
- id (uuid, primary key)
- client_id (uuid)
- user_id (uuid)
- quote_request_id (uuid)
- rate_id (uuid)
- booking_id_external (text)
- confirmation_number (text)
- status (text)
- raw_json (jsonb)
```

**`audit_logs` table:**
```sql
- id (uuid, primary key)
- client_id (uuid)
- user_id (uuid)
- action (text)
- metadata_json (jsonb)
- created_at (timestamp)
```

### 3. Supabase Function for Rate Token Consumption

Create a PostgreSQL function in Supabase:

```sql
CREATE OR REPLACE FUNCTION consume_rate_token(p_client_id uuid)
RETURNS TABLE(rate_tokens_remaining integer, rate_tokens_used integer) AS $$
DECLARE
  v_remaining integer;
  v_used integer;
BEGIN
  -- Get current values
  SELECT rate_tokens_remaining, rate_tokens_used
  INTO v_remaining, v_used
  FROM clients
  WHERE id = p_client_id;

  -- If no tokens remaining, return current values
  IF v_remaining <= 0 THEN
    RETURN QUERY SELECT v_remaining, v_used;
    RETURN;
  END IF;

  -- Decrement remaining and increment used
  UPDATE clients
  SET 
    rate_tokens_remaining = GREATEST(0, rate_tokens_remaining - 1),
    rate_tokens_used = rate_tokens_used + 1
  WHERE id = p_client_id
  RETURNING rate_tokens_remaining, rate_tokens_used
  INTO v_remaining, v_used;

  RETURN QUERY SELECT v_remaining, v_used;
END;
$$ LANGUAGE plpgsql;
```

### 4. Environment Variables Setup

**For Local Development:**
1. Copy `server/env.example` to `server/.env`
2. Fill in all required values (see README.md for details)

**For Vercel Production:**
1. Go to Vercel project settings → Environment Variables
2. Add all variables from `server/env.example`
3. Set `NODE_ENV=production`

## GitHub Deployment Steps

### 1. Verify All Changes Are Committed

```bash
# Check status
git status

# Add all changes
git add .

# Commit with descriptive message
git commit -m "Fix: Add comprehensive logging, fix form validation, update deployment config

- Add detailed logging to rates API and frontend
- Fix QuoteForm to match backend API structure
- Update README with deployment instructions
- Fix React import issues for build
- Add authentication logging"
```

### 2. Push to GitHub

```bash
# If you haven't set up remote yet
git remote add origin https://github.com/DuanPretorius07/s-2-web-app-poc.git

# Push to main branch
git push origin main

# Or if you're on a different branch
git push origin your-branch-name
```

### 3. Verify Build Locally (Optional but Recommended)

```bash
# Install dependencies
npm run install:all

# Build client
cd client && npm run build && cd ..

# Build server
cd server && npm run build && cd ..

# If builds succeed, you're ready to deploy
```

## Vercel Deployment Steps

### 1. Connect Repository to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your GitHub repository: `DuanPretorius07/s-2-web-app-poc`
4. Vercel will auto-detect the project settings

### 2. Configure Build Settings

**Root Directory**: Leave as root (`.`)

**Build Command**: 
```
npm run vercel-build
```

**Output Directory**: 
```
client/dist
```

**Install Command**:
```
npm run install:all
```

### 3. Set Environment Variables

In Vercel project settings → Environment Variables, add:

**Required:**
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
JWT_SECRET=your-jwt-secret
SHIP2PRIMUS_RATES_URL=https://s-2international-api.shipprimus.com/applet/v1/rate/multiple
SHIP2PRIMUS_BOOK_URL=https://s-2international-api.shipprimus.com/api/v1/book
SHIP2PRIMUS_LOGIN_URL=https://s-2international-api.shipprimus.com/api/v1/login
SHIP2PRIMUS_USERNAME=your-username
SHIP2PRIMUS_PASSWORD=your-password
NODE_ENV=production
```

**Optional (for HubSpot integration):**
```
HUBSPOT_PRIVATE_APP_TOKEN=your-hubspot-token
```

**CORS Configuration:**
```
ALLOWED_ORIGINS=http://localhost:3000,https://app.hubspot.com,https://*.hubspot.com
```

### 4. Deploy

1. Click "Deploy"
2. Wait for build to complete
3. Check build logs for any errors
4. Once deployed, test the application

### 5. Post-Deployment Verification

1. **Test Authentication:**
   - Visit your Vercel URL
   - Try to register a new user
   - Try to log in

2. **Test Rate Request:**
   - Log in
   - Fill out the quote form
   - Submit and verify rates are returned
   - Check browser console for logs
   - Check Vercel function logs for backend logs

3. **Check Logs:**
   - Go to Vercel Dashboard → Your Project → Functions
   - Check server logs for:
     - `[Auth]` - Authentication logs
     - `[RATES]` - Rate request logs
     - `[HUBSPOT]` - HubSpot integration logs

## Troubleshooting

### Build Fails on Vercel

**Error: TypeScript errors**
- Check that all TypeScript files compile: `cd client && npm run build`
- Fix any type errors before deploying

**Error: Missing environment variables**
- Ensure all required env vars are set in Vercel
- Check that variable names match exactly (case-sensitive)

**Error: Module not found**
- Run `npm run install:all` locally to verify dependencies
- Check `package.json` files for correct dependency versions

### Rates Not Returning

1. **Check Backend Logs:**
   - Look for `[RATES]` logs in Vercel function logs
   - Verify Ship2Primus API credentials are correct
   - Check if API is being called and what response is received

2. **Check Frontend Logs:**
   - Open browser DevTools → Console
   - Look for `[QuoteForm]` logs
   - Verify request payload is correct
   - Check response status and data

3. **Verify Authentication:**
   - Check `[Auth]` logs in Vercel
   - Ensure user is properly authenticated
   - Verify JWT token is valid

### Database Connection Issues

1. **Check Supabase Connection:**
   - Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
   - Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
   - Test connection in Supabase dashboard

2. **Check Column Names:**
   - Ensure database uses `firstname`/`lastname` (camelCase)
   - Not `first_name`/`last_name` (snake_case)

## Support

For issues or questions:
1. Check Vercel function logs
2. Check browser console logs
3. Review this deployment guide
4. Contact the development team
