# Vercel Deployment Guide

## Quick Deploy Steps

### 1. Push to GitHub (✅ Already Done!)
Your code has been pushed to: `https://github.com/DuanPretorius07/S-2-web-app-POC.git`

### 2. Connect to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"**
3. Import your GitHub repository: `DuanPretorius07/S-2-web-app-POC`
4. Vercel will auto-detect the project

### 3. Configure Build Settings

Vercel should auto-detect, but verify:

- **Framework Preset**: Other (or leave blank)
- **Root Directory**: `./` (root)
- **Build Command**: `npm run vercel-build`
- **Output Directory**: `client/dist`
- **Install Command**: `npm install`

### 4. Add Environment Variables

**CRITICAL:** Add all these environment variables in Vercel Dashboard:

#### Supabase (Required)
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

#### Ship2Primus (Required)
```
SHIP2PRIMUS_RATES_URL=https://s-2international-api.shipprimus.com/applet/v1/rate/multiple
SHIP2PRIMUS_BOOK_URL=https://s-2international-api.shipprimus.com/api/v1/book
SHIP2PRIMUS_LOGIN_URL=https://s-2international-api.shipprimus.com/api/v1/login
SHIP2PRIMUS_USERNAME=your-username
SHIP2PRIMUS_PASSWORD=your-password
```

#### Client (Required - for frontend build)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

#### Other (Required)
```
JWT_SECRET=your-strong-random-secret
AWS_REGION=us-east-1
ALLOWED_ORIGINS=https://your-app.vercel.app,https://app.hubspot.com
NODE_ENV=production
PORT=5000
VERCEL=1
```

**Note:** `VERCEL=1` tells the server not to start listening (Vercel handles that)

### 5. Deploy!

Click **"Deploy"** and wait for the build to complete.

---

## Troubleshooting

### Build Fails

**Error: Cannot find module**
- Make sure all dependencies are in `package.json`
- Check that `npm run install:all` works locally first

**Error: Build command failed**
- Check build logs in Vercel dashboard
- Verify `npm run vercel-build` works locally

### API Routes Return 404

- Check that routes are under `/api/` path
- Verify `vercel.json` rewrites are correct
- Check serverless function logs in Vercel dashboard

### Environment Variables Not Working

- Make sure variables are added in Vercel dashboard (not just `.env`)
- For client variables, use `VITE_` prefix
- Redeploy after adding variables

---

## Alternative: Railway/Render (Easier for Express)

If Vercel gives you issues, consider **Railway** or **Render** which are simpler for Express apps:

### Railway:
1. Go to [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Select your repo
4. Add environment variables
5. Deploy (auto-detects Node.js)

### Render:
1. Go to [render.com](https://render.com)
2. New Web Service → Connect GitHub
3. Set build: `npm run build`
4. Set start: `npm start`
5. Add environment variables
6. Deploy

---

## Post-Deployment Checklist

- [ ] Health endpoint works: `https://your-app.vercel.app/health`
- [ ] Frontend loads: `https://your-app.vercel.app`
- [ ] Can register/login users
- [ ] Supabase connection works (check dashboard)
- [ ] Ship2Primus authentication works (check logs)
- [ ] Can request rates
- [ ] Can book shipments

---

## Current Status

✅ Code pushed to GitHub
✅ Vercel configuration ready
⏳ **Next:** Connect to Vercel and add environment variables
