# Ship2Primus Integration Setup

This document provides specific instructions for updating your environment variables to use the Ship2Primus API.

## ✅ What Has Been Updated

1. **Code Files Updated:**
   - ✅ Created `server/src/lib/ship2primusClient.ts` - Handles authentication and API requests
   - ✅ Updated `server/src/routes/rates.ts` - Now uses Ship2Primus rates API
   - ✅ Updated `server/src/routes/book.ts` - Now uses Ship2Primus booking API
   - ✅ Updated `server/env.example` - Contains all new environment variables

2. **Environment Configuration:**
   - ✅ `server/env.example` updated with Ship2Primus variables

## 📝 Required Environment Variable Updates

### Update Your `server/.env` File

You need to **add or update** these variables in your `server/.env` file:

```env
# ============================================
# SHIP2PRIMUS API CONFIGURATION (REQUIRED)
# ============================================
SHIP2PRIMUS_RATES_URL="https://s-2international-api.shipprimus.com/applet/v1/rate/multiple"
SHIP2PRIMUS_BOOK_URL="https://s-2international-api.shipprimus.com/api/v1/book"
SHIP2PRIMUS_LOGIN_URL="https://s-2international-api.shipprimus.com/api/v1/login"
SHIP2PRIMUS_USERNAME="your-actual-username-here"
SHIP2PRIMUS_PASSWORD="your-actual-password-here"

# AWS Configuration
AWS_REGION="us-east-1"
```

### Old Variables (Optional - Not Used Anymore)

The following old variables are **no longer used** by the application, but you can keep them if needed:
- `API_GATEWAY_RATES_URL` - Not used (replaced by `SHIP2PRIMUS_RATES_URL`)
- `API_GATEWAY_BOOK_URL` - Not used (replaced by `SHIP2PRIMUS_BOOK_URL`)
- `PROXY_API_KEY` - Not used (replaced by Ship2Primus authentication)

**Note:** Keeping these variables won't cause any issues - they're simply ignored. You can remove them to keep your `.env` cleaner, or keep them for reference/backup purposes.

### Keep Existing Variables

Keep all your existing Supabase and other configuration:
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ✅ `JWT_SECRET`
- ✅ `ALLOWED_ORIGINS`
- ✅ `PORT`
- ✅ `NODE_ENV`
- ✅ `HUBSPOT_ACCESS_TOKEN` (can remain empty)

## 🔑 Getting Your Ship2Primus Credentials

You need to obtain:
1. **Username** - Your Ship2Primus API username
2. **Password** - Your Ship2Primus API password

Contact your Ship2Primus administrator or check your Ship2Primus account settings.

## 🚀 How It Works

1. **Authentication**: The system automatically authenticates with Ship2Primus API using your credentials
2. **Token Caching**: Authentication tokens are cached for 50 minutes to avoid excessive login requests
3. **Auto-Retry**: If authentication fails (401), the system will automatically refresh the token and retry
4. **Rates API**: When users request rates, the system calls Ship2Primus rates endpoint
5. **Booking API**: When users book a shipment, the system calls Ship2Primus booking endpoint

## ⚠️ Important Notes

1. **Booking URL**: Set to `https://s-2international-api.shipprimus.com/api/v1/book` based on official API documentation. 
   - API Documentation: https://sandbox-api-applet.shipprimus.com/api/v1/docs#/Booking/APIBusinessAppletBookBookShipment
   - If you need to use sandbox environment, update to `https://sandbox-api-applet.shipprimus.com/api/v1/book`

2. **Authentication**: The system uses Bearer token authentication. The token is obtained automatically via the login endpoint.

3. **Error Handling**: If Ship2Primus credentials are not configured, the system will return mock data for development/testing purposes.

## 🧪 Testing

After updating your `.env` file:

1. Restart your server:
   ```bash
   npm run dev
   ```

2. Test rates endpoint:
   - Login to the application
   - Navigate to rates form
   - Submit a rate request
   - Check server logs for Ship2Primus API calls

3. Check server logs for:
   - "Ship2Primus authentication error" - means credentials are wrong
   - "SHIP2PRIMUS_RATES_URL not configured" - means URL is missing
   - Successful rate/booking requests

## 📋 Checklist

Before running the application:

- [ ] Updated `server/.env` with Ship2Primus URLs
- [ ] Added `SHIP2PRIMUS_USERNAME` with actual username
- [ ] Added `SHIP2PRIMUS_PASSWORD` with actual password
- [ ] Verified `AWS_REGION="us-east-1"` is set
- [ ] (Optional) Removed old `API_GATEWAY_*` variables if you want a cleaner `.env`
- [ ] Kept all Supabase variables intact
- [ ] Restarted the server after changes

## 🆘 Troubleshooting

### "Ship2Primus authentication not configured"
- Check that `SHIP2PRIMUS_USERNAME` and `SHIP2PRIMUS_PASSWORD` are set in `.env`
- Verify there are no typos in variable names

### "Ship2Primus login failed with status 401"
- Verify your username and password are correct
- Check with Ship2Primus support that your account has API access

### "Unexpected Ship2Primus rates response format"
- The API response format may differ from expected
- Check server logs for the actual response structure
- You may need to adjust the response parsing in `server/src/routes/rates.ts`

### Getting mock data instead of real rates
- Check that `SHIP2PRIMUS_RATES_URL` is set correctly
- Verify authentication is working (check logs for login success)
