# Deployment Guide

## Vercel Deployment

This guide covers deploying the ShipPrimus Portal to Vercel.

### Prerequisites

1. **Vercel Account**: Sign up at https://vercel.com
2. **GitHub Repository**: Push your code to GitHub
3. **Supabase Project**: Set up your database (see Database Setup below)
4. **Environment Variables**: Gather all required values

### Step 1: Connect Repository to Vercel

1. Log in to Vercel Dashboard
2. Click "Add New Project"
3. Import your GitHub repository
4. Select the repository containing this project

### Step 2: Configure Build Settings

Vercel should auto-detect the configuration from `vercel.json`, but verify:

- **Framework Preset**: Other
- **Root Directory**: `./` (root of repository)
- **Build Command**: `npm run vercel-build`
- **Output Directory**: `client/dist`
- **Install Command**: `npm run install:all` (or leave default)

### Step 3: Set Environment Variables

In Vercel project settings → Environment Variables, add:

#### Required Variables

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# JWT Secret (generate a strong random string)
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Ship2Primus API
SHIP2PRIMUS_RATES_URL=https://s-2international-api.shipprimus.com/applet/v1/rate/multiple
SHIP2PRIMUS_BOOK_URL=https://s-2international-api.shipprimus.com/api/v1/book
SHIP2PRIMUS_LOGIN_URL=https://s-2international-api.shipprimus.com/api/v1/login
SHIP2PRIMUS_USERNAME=your-ship2primus-username
SHIP2PRIMUS_PASSWORD=your-ship2primus-password

# GeoNames API
GEONAMES_USERNAME=your-geonames-username

# Server Configuration
NODE_ENV=production
PORT=5000
```

#### Optional Variables

```env
# HubSpot Integration
HUBSPOT_PRIVATE_APP_TOKEN=your-hubspot-private-app-token

# CORS Configuration
ALLOWED_ORIGINS=https://app.hubspot.com,https://*.hubspot.com,https://your-domain.com
```

**Important**: Set these for **Production**, **Preview**, and **Development** environments as needed.

### Step 4: Database Setup

1. **Create Supabase Project**:
   - Go to https://supabase.com
   - Create a new project
   - Wait for database to be ready

2. **Run Schema**:
   - Go to SQL Editor in Supabase Dashboard
   - Copy entire contents of `server/supabase/schema.sql`
   - Paste and run in SQL Editor
   - Verify all tables are created

3. **Get Credentials**:
   - Go to Project Settings → API
   - Copy:
     - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
     - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY`

### Step 5: Deploy

1. Click "Deploy" in Vercel
2. Wait for build to complete
3. Check build logs for any errors
4. Visit your deployment URL

### Step 6: Verify Deployment

1. **Check Build Logs**:
   - Should see successful build messages
   - No TypeScript errors
   - Frontend build completes successfully

2. **Test Application**:
   - Visit deployment URL
   - Try registering a new user
   - Test location selector (countries/states/cities)
   - Test rate request flow

3. **Check Environment Variables**:
   - Verify all variables are set correctly
   - Check Supabase connection
   - Verify GeoNames API is working

### Common Issues

#### Build Fails: "Cannot find module"

**Solution**: Ensure `npm run install:all` runs before build. Check that all dependencies are in `package.json` files.

#### Build Fails: TypeScript Errors

**Solution**: Fix TypeScript errors locally first. Run `npm run build` locally to catch errors.

#### API Routes Return 404

**Solution**: Check `vercel.json` configuration. Ensure API routes are properly configured.

#### Database Connection Errors

**Solution**: 
- Verify Supabase credentials are correct
- Check that Supabase project is active
- Ensure RLS policies allow service role access

#### GeoNames API Errors

**Solution**:
- Verify `GEONAMES_USERNAME` is set correctly
- Check GeoNames account is active
- Ensure free web service is enabled in GeoNames account

### Updating Deployment

1. **Push Changes to GitHub**:
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```

2. **Vercel Auto-Deploys**:
   - Vercel automatically detects push to main branch
   - Triggers new deployment
   - Builds and deploys automatically

3. **Manual Deployment**:
   - Go to Vercel Dashboard
   - Click "Redeploy" on latest deployment
   - Or create new deployment from specific commit

### Environment-Specific Deployments

You can set different environment variables for:
- **Production**: Main branch deployments
- **Preview**: Pull request deployments
- **Development**: Development branch deployments

Set variables in Vercel Dashboard → Settings → Environment Variables.

### Monitoring

- **Build Logs**: View in Vercel Dashboard → Deployments
- **Function Logs**: View in Vercel Dashboard → Functions
- **Analytics**: Enable in Vercel Dashboard → Analytics

### Rollback

If deployment fails:

1. Go to Vercel Dashboard → Deployments
2. Find last successful deployment
3. Click "..." → "Promote to Production"

### Custom Domain

1. Go to Vercel Dashboard → Settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed
4. Wait for SSL certificate (automatic)

### Performance Optimization

- **Edge Functions**: Consider using Vercel Edge Functions for API routes
- **Caching**: Implement caching headers for static assets
- **CDN**: Vercel automatically uses CDN for static files

## Manual Changes Required

### Database Column Names

The application uses camelCase column names:
- `users.firstname` (not `first_name`)
- `users.lastname` (not `last_name`)

The SQL schema in `server/supabase/schema.sql` is correct. If you're migrating from snake_case, you'll need to:
1. Update database columns, OR
2. Update application code (not recommended)

### Background Opacity

To change background opacity:
1. Edit `client/src/components/AnimatedBackground.tsx`
2. Line 83: Change `opacity: 0.3` to desired value (0.0 to 1.0)
3. Rebuild and redeploy

### Notification Z-Index

The rate tokens notification uses `z-[9999]` to appear above modals. To change:
1. Edit `client/src/components/RateTokensUsedNotification.tsx`
2. Line 34: Change `z-[9999]` to desired value
3. Rebuild and redeploy

## Production Checklist

Before going live:

- [ ] All environment variables set in Vercel
- [ ] Database schema deployed to Supabase
- [ ] Supabase RLS policies configured
- [ ] GeoNames API username configured
- [ ] Ship2Primus API credentials configured
- [ ] HubSpot integration configured (if using)
- [ ] CORS origins configured correctly
- [ ] Custom domain configured (if using)
- [ ] SSL certificate active
- [ ] Test registration flow
- [ ] Test location selector
- [ ] Test rate request flow
- [ ] Test booking flow
- [ ] Monitor error logs

## Support

For deployment issues:
1. Check Vercel build logs
2. Check Supabase logs
3. Verify environment variables
4. Test locally first
5. Contact development team
