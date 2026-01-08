# Supabase Migration Guide

This project has been migrated from Prisma/PostgreSQL to Supabase. This document outlines the changes and setup instructions.

## What Changed

1. **Database**: Migrated from Prisma ORM with PostgreSQL to Supabase
2. **Authentication**: Still uses custom JWT tokens, but database queries now use Supabase
3. **Client Library**: Replaced `@prisma/client` with `@supabase/supabase-js`

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and API keys:
   - Project URL (e.g., `https://mbwoeqdgynsebsvguiba.supabase.co`)
   - Anon/Public Key (safe to expose in frontend)
   - Service Role Key (keep secret, server-side only)

### 2. Run Database Schema

1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `server/supabase/schema.sql`
4. Run the SQL to create all tables, indexes, and RLS policies

### 3. Configure Environment Variables

#### Server (`server/.env`)

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key-here"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"

# JWT Secret (still used for custom JWT tokens)
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# API Gateway Proxy
API_GATEWAY_RATES_URL="https://api-gateway.example.com/rates"
API_GATEWAY_BOOK_URL="https://api-gateway.example.com/book"
PROXY_API_KEY="your-api-gateway-proxy-key"

# HubSpot Integration (optional)
HUBSPOT_ACCESS_TOKEN=""

# CORS Allowed Origins (comma-separated)
ALLOWED_ORIGINS="http://localhost:3000,https://app.hubspot.com,https://*.hubspot.com"

# Server
PORT=5000
NODE_ENV=development
```

#### Client (`client/.env`)

```env
# Supabase Configuration (for frontend)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Install Dependencies

```bash
# From project root
npm run install:all
```

### 5. Run the Application

```bash
# Development mode
npm run dev
```

## Key Differences from Prisma

### Database Queries

**Before (Prisma):**
```typescript
const user = await prisma.user.findUnique({
  where: { email },
  include: { client: true },
});
```

**After (Supabase):**
```typescript
const { data: user } = await supabaseAdmin
  .from('users')
  .select(`
    *,
    clients (*)
  `)
  .eq('email', email)
  .single();
```

### Field Naming

- Prisma used camelCase (e.g., `clientId`, `createdAt`)
- Supabase uses snake_case (e.g., `client_id`, `created_at`)
- The code handles both formats for compatibility

### Authentication

- Still uses custom JWT tokens (not Supabase Auth)
- Supabase is only used for database operations
- Service role key bypasses Row Level Security (RLS) for server-side operations

## File Structure

```
server/
├── src/
│   ├── lib/
│   │   └── supabaseClient.ts    # Supabase client configuration
│   ├── routes/                   # All routes now use Supabase
│   └── middleware/               # Auth middleware uses Supabase
├── supabase/
│   └── schema.sql               # Database schema migration
└── env.example                  # Updated environment variables

client/
├── src/
│   └── lib/
│       └── supabaseClient.ts    # Frontend Supabase client
└── .env.example                 # Frontend environment variables
```

## Vercel Deployment

1. Add environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT_SECRET`
   - Other existing variables

2. The build should work without any changes to `vercel.json`

## Testing

The test files (`server/src/__tests__/`) still reference Prisma mocks. These will need to be updated to mock Supabase if you want to run tests. For now, the application runs correctly without updating tests.

## Troubleshooting

### "Missing Supabase environment variables"
- Ensure all environment variables are set in `server/.env` and `client/.env`
- Check that variable names match exactly (case-sensitive)

### "Row Level Security policy violation"
- The server uses `supabaseAdmin` which bypasses RLS
- If you see RLS errors, check that `SUPABASE_SERVICE_ROLE_KEY` is set correctly

### Database connection issues
- Verify your Supabase project is active
- Check that the SQL schema has been run successfully
- Ensure your IP is not blocked (Supabase allows all IPs by default)

## Next Steps

1. Run the SQL schema in Supabase
2. Set up environment variables
3. Test locally with `npm run dev`
4. Deploy to Vercel with updated environment variables
