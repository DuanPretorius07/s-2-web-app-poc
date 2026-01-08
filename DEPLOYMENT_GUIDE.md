# Deployment Guide - ShipPrimus POC

## 🎯 Quick Answer: Is it Ready?

**YES** - The code is ready for deployment with these prerequisites:

✅ **Code is complete and functional**
✅ **Supabase integration is ready** (needs database schema execution)
✅ **Ship2Primus integration is complete** (needs credentials)
⚠️ **Vercel deployment needs configuration adjustment**

---

## 📋 Pre-Deployment Checklist

### 1. Supabase Setup (REQUIRED)

**Steps:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create/select your project
3. Go to **SQL Editor**
4. Copy entire contents of `server/supabase/schema.sql`
5. Paste and **Run** the SQL
6. Verify tables were created: `clients`, `users`, `quote_requests`, `rates`, `bookings`, `audit_logs`

**Get API Keys:**
1. Go to **Settings** → **API**
2. Copy:
   - **Project URL** → Use for `NEXT_PUBLIC_SUPABASE_URL` and `VITE_SUPABASE_URL`
   - **anon/public key** → Use for `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `VITE_SUPABASE_ANON_KEY`
   - **service_role key** → Use for `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

---

### 2. Ship2Primus Credentials (REQUIRED)

**What you need:**
- Username and Password for Ship2Primus API
- Verify the booking endpoint URL (currently set as `https://s-2international-api.shipprimus.com/api/v1/book`)

**URLs (configured based on API documentation):**
- Rates: `https://s-2international-api.shipprimus.com/applet/v1/rate/multiple`
- Login: `https://s-2international-api.shipprimus.com/api/v1/login`
- Book: `https://s-2international-api.shipprimus.com/api/v1/book`
  - API Docs: https://sandbox-api-applet.shipprimus.com/api/v1/docs#/Booking/APIBusinessAppletBookBookShipment

---

### 3. Environment Variables

#### For Local Testing:

**`server/.env`:**
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# JWT
JWT_SECRET="your-strong-random-secret"

# Ship2Primus
SHIP2PRIMUS_RATES_URL="https://s-2international-api.shipprimus.com/applet/v1/rate/multiple"
SHIP2PRIMUS_BOOK_URL="https://s-2international-api.shipprimus.com/api/v1/book"
SHIP2PRIMUS_LOGIN_URL="https://s-2international-api.shipprimus.com/api/v1/login"
SHIP2PRIMUS_USERNAME="your-username"
SHIP2PRIMUS_PASSWORD="your-password"

# AWS
AWS_REGION="us-east-1"

# CORS
ALLOWED_ORIGINS="http://localhost:3000,https://your-vercel-domain.vercel.app"

# Server
PORT=5000
NODE_ENV=development
```

**`client/.env`:**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

#### For Vercel Deployment:

Add **ALL** the above variables in Vercel Dashboard:
1. Go to your project → **Settings** → **Environment Variables**
2. Add each variable
3. For client variables (`VITE_*`), they're automatically available to the build

---

## 🚀 Deployment Options

### Option A: Deploy to Vercel (Recommended for POC)

**Pros:**
- Free tier
- Automatic HTTPS
- Easy environment variable management
- Good for POCs

**Cons:**
- Needs serverless function configuration
- Cold starts possible

#### Steps:

1. **Update vercel.json** (if using serverless):
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "server/server.ts",
         "use": "@vercel/node"
       },
       {
         "src": "package.json",
         "use": "@vercel/static-build",
         "config": {
           "distDir": "client/dist"
         }
       }
     ],
     "routes": [
       {
         "src": "/api/(.*)",
         "dest": "server/server.ts"
       },
       {
         "src": "/(.*)",
         "dest": "client/dist/$1"
       }
     ]
   }
   ```

2. **OR Use Traditional Build** (simpler):
   - Keep current `vercel.json`
   - Deploy as a Node.js application
   - Vercel will detect it and deploy

3. **Connect to GitHub:**
   - Push code to GitHub
   - Connect repository in Vercel
   - Add environment variables
   - Deploy

**Note:** For Express apps on Vercel, you might want to use **Railway** or **Render** instead (see Option B).

---

### Option B: Deploy to Railway/Render (Easier for Express)

**Pros:**
- Works with current code structure
- No configuration changes needed
- Simpler deployment

**Steps:**

1. **Railway:**
   ```bash
   # Install Railway CLI (optional)
   npm i -g @railway/cli
   
   # Login and deploy
   railway login
   railway init
   railway up
   ```
   
   - Add environment variables in Railway dashboard
   - Railway auto-detects Node.js and runs `npm start`

2. **Render:**
   - Connect GitHub repo
   - Set build command: `npm run build`
   - Set start command: `npm start`
   - Add environment variables
   - Deploy

---

## ✅ Testing Deployment

### Local Testing First:

```bash
# 1. Install dependencies
npm run install:all

# 2. Build
npm run build

# 3. Start (test production build)
npm start

# 4. Test endpoints:
# - http://localhost:5000/health (should return {"status":"ok"})
# - http://localhost:5000 (should show React app)
# - http://localhost:5000/api/auth/me (should return 401 without auth)
```

### After Deployment:

1. **Check Health Endpoint:**
   ```
   GET https://your-domain.com/health
   Expected: {"status":"ok","timestamp":"..."}
   ```

2. **Test Supabase Connection:**
   - Try to register a user
   - Check Supabase dashboard for new user in `users` table

3. **Test Ship2Primus:**
   - Login to app
   - Submit a rates request
   - Check server logs for Ship2Primus API calls

---

## 🔍 Verification Checklist

After deployment, verify:

- [ ] Health endpoint responds: `/health`
- [ ] Frontend loads: Root URL shows React app
- [ ] Supabase connection: Can register/login users
- [ ] Database operations: Users appear in Supabase dashboard
- [ ] Ship2Primus auth: Check logs for successful login
- [ ] Rates API: Can request rates (check logs)
- [ ] Booking API: Can book shipments (check logs)
- [ ] Environment variables: All set correctly in deployment platform

---

## 🐛 Troubleshooting

### "Missing Supabase environment variables"
- Check all `NEXT_PUBLIC_SUPABASE_*` and `SUPABASE_SERVICE_ROLE_KEY` are set
- For Vercel: Make sure client variables have `VITE_` prefix

### "Ship2Primus authentication error"
- Verify `SHIP2PRIMUS_USERNAME` and `SHIP2PRIMUS_PASSWORD` are correct
- Check Ship2Primus API is accessible from deployment platform

### "Database connection error"
- Verify Supabase project is active
- Check SQL schema was executed successfully
- Verify service role key has proper permissions

### "Cannot find module" errors
- Run `npm run install:all` to ensure all dependencies installed
- Check `node_modules` exists in both `server/` and `client/`

### Vercel deployment fails
- Check build logs for specific errors
- Verify `vercel.json` configuration
- Consider using Railway/Render for simpler Express deployment

---

## 📝 Summary

**Ready for POC Deployment:** ✅ YES

**What's Working:**
- ✅ Code is complete
- ✅ Supabase integration ready
- ✅ Ship2Primus integration ready
- ✅ Build process configured

**What Needs Setup:**
- ⚠️ Run Supabase database schema
- ⚠️ Set environment variables
- ⚠️ Choose deployment platform
- ⚠️ Configure Vercel (if using Vercel)

**Estimated Setup Time:** 30-60 minutes

---

## 🎯 Quick Start for POC

1. **Run Supabase Schema** (5 min)
2. **Set Environment Variables** (10 min)
3. **Test Locally** (10 min)
4. **Deploy to Railway/Render** (15 min) OR **Configure Vercel** (30 min)
5. **Test in Production** (10 min)

**Total: ~1 hour to deployed POC**
