# Vercel Deployment Endpoints & URLs

## Production URLs

### Main Application
- **Production URL**: `https://s-2-web-app-poc.vercel.app`
- **Preview URLs**: `https://s-2-web-app-poc-[deployment-id]-[your-username].vercel.app`

### Health Check (No Geo-Restriction)
```
GET https://s-2-web-app-poc.vercel.app/api/health
```
**Response**: `{ status: 'ok', timestamp: '...', env: 'production' }`

### Restricted Page (Geo-Blocked Users)
```
GET https://s-2-web-app-poc.vercel.app/restricted
```
**Note**: Automatically shown to users outside US/CA

### Developer Bypass URLs
Add `?dev=true` to any URL to bypass geo-restriction:

- **Login with bypass**: `https://s-2-web-app-poc.vercel.app/login?dev=true`
- **Home with bypass**: `https://s-2-web-app-poc.vercel.app/?dev=true`
- **Any route with bypass**: `https://s-2-web-app-poc.vercel.app/[route]?dev=true`

## API Endpoints

All API endpoints are prefixed with `/api` and work from any country (geo-restriction bypassed for `/api/*` routes).

### Authentication
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Rates
```
POST /api/rates
GET  /api/rates/:id
```

### Booking (Request to Book)
```
POST /api/book
```

### History
```
GET /api/history
```

### Locations
```
GET /api/locations/countries
GET /api/locations/states?countryCode=US
GET /api/locations/cities?countryCode=US&stateCode=CA
GET /api/locations/postal-codes?countryCode=US&stateCode=CA&city=Los Angeles
GET /api/locations/lookup?postalCode=90210
```

### Testing
```
GET /api/test/supabase
```

## Routing Behavior

### How Routes Are Handled

1. **API Routes** (`/api/*`)
   - Routed to Express serverless function
   - No geo-restriction applied
   - Work from any country

2. **Restricted Page** (`/restricted`)
   - Routed to Express serverless function
   - Served as inline HTML (no file system access needed)
   - Shown to users outside US/CA (unless `?dev=true`)

3. **All Other Routes** (`/*`)
   - Served as React SPA (`index.html`)
   - Geo-restriction applied (redirects to `/restricted` if outside US/CA)
   - Can bypass with `?dev=true` query parameter

## Geo-Restriction Logic

### How It Works

1. **Check `?dev=true` FIRST** - If present, allow access immediately
2. **Check if route is `/api/*`** - API routes are always allowed
3. **Check if route is `/restricted`** - Allow serving the restricted page
4. **Check country from Vercel headers** (`x-vercel-ip-country`)
5. **Allow if country is US or CA**
6. **Otherwise redirect to `/restricted`**

### Developer Bypass

The `?dev=true` query parameter bypasses geo-restriction for:
- Testing from outside US/CA
- Development and debugging
- Internal team access

**Example**: `https://s-2-web-app-poc.vercel.app/login?dev=true`

## Environment Variables Required

Make sure these are set in Vercel Dashboard → Settings → Environment Variables:

```
NODE_ENV=production
DATABASE_URL=your_supabase_url
JWT_SECRET=your_jwt_secret
SUPABASE_SERVICE_ROLE_KEY=your_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
HUBSPOT_PRIVATE_APP_TOKEN=your_token
SHIP2PRIMUS_LOGIN_URL=your_url
SHIP2PRIMUS_RATES_URL=your_url
SHIP2PRIMUS_BOOK_URL=your_url
SHIP2PRIMUS_SAVE_URL=your_url
SHIP2PRIMUS_USERNAME=your_username
SHIP2PRIMUS_PASSWORD=your_password
GEONAMES_USERNAME=your_username
ALLOWED_ORIGINS=https://s-2-web-app-poc.vercel.app,https://*.vercel.app
```

## Troubleshooting

### 404 on `/login?dev=true`
- Wait 2-3 minutes after deployment for it to fully activate
- Clear browser cache
- Check Vercel deployment logs
- Verify the deployment is active in Vercel dashboard

### Blank Screen on `/restricted`
- Should be fixed with inline HTML serving
- Check Vercel function logs for errors
- Verify the route is being handled by Express (not React SPA)

### API Routes Returning 404
- Verify `vercel.json` rewrite rules are correct
- Check that `api/serverless.js` exists
- Verify Express app is exported as default from `server/server.ts`

### Geo-Restriction Not Working
- Check Vercel function logs for geo-restriction middleware logs
- Verify `ENABLE_GEO_RESTRICTION` is not set to `false`
- Check that `x-vercel-ip-country` header is present in logs

## Testing Checklist

After deployment:

- [ ] `/api/health` returns `{ status: 'ok' }`
- [ ] `/restricted` shows the restricted page
- [ ] `/login?dev=true` loads the login page (from outside US/CA)
- [ ] `/api/locations/countries` returns country list
- [ ] Main app loads correctly (if in US/CA or with `?dev=true`)
