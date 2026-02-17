# ShipPrimus Portal

A full-stack shipping quote and booking portal web application designed for HubSpot embedding. This application provides multi-tenant support, authentication, rate quoting, booking, and comprehensive location management with GeoNames integration.

## Features

- **Multi-tenant Architecture**: Each client (tenant) has isolated data and users
- **Authentication**: JWT-based auth with HttpOnly cookies, role-based access (ADMIN/USER)
  - **Token Expiration**: Tokens expire after 1 hour of inactivity
  - **Auto-logout**: Automatic session expiration with modal notification and redirect to login
  - **Token Renewal**: Tokens are renewed on each successful login
- **Registration with Password Validation**: Detailed password requirements with real-time feedback
  - Minimum 8 characters
  - At least one letter
  - At least one number
  - Clear error messages for each requirement
- **Location Management**: Full country/state/city/ZIP code selection with GeoNames API
  - Robust retry logic with exponential backoff
  - 7-day caching for improved performance
  - Manual ZIP code entry fallback
  - Error handling with fallback to expired cache
- **Shipping Flow**: Get rates → View results → Book shipment
- **HubSpot Integration**: Embeddable via iframe or script loader with context prefill
- **HubSpot CRM Writeback**: Automatic contact sync and rate request notes (when configured)
  - **Comprehensive Logging**: All rate requests are logged to HubSpot notes (success, no rates, errors)
  - **Status Indicators**: Notes include status indicators (✅ success, ⚠️ no rates, ❌ errors)
  - **Error Logging**: API errors are logged to HubSpot with detailed error messages
  - **Token Tracking**: Notes indicate whether rate tokens were consumed
- **Rate Limiting**: 3 quote requests per email (lifetime) with clear user messaging
- **Hazmat Blocking**: Automatic blocking of hazardous materials with contact S2 guidance
- **UI Improvements**:
  - Static background (no distracting animations)
  - Rate tokens notification with proper z-index layering
  - Improved error messages throughout the application
  - **Freight Type Validation**: Required field - "Please Select" is disabled placeholder
  - **Canadian Postal Code Support**: Auto-formatting for Canadian postal codes (e.g., "R0K 0B8")
  - **Login Error Messages**: Specific error messages for email format, email not found, and incorrect password

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (Supabase) with direct SQL queries
- **Location API**: GeoNames API with retry logic and caching
- **Authentication**: JWT + HttpOnly cookies
- **Testing**: Jest + Supertest (backend), Vitest + React Testing Library (frontend)

## Project Structure

```
.
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── AnimatedBackground.tsx  # Static background (opacity: 0.3)
│   │   │   ├── LocationSelector.tsx    # Country/State/City/ZIP selector
│   │   │   ├── QuoteForm.tsx           # Main quote form
│   │   │   ├── RatesModal.tsx          # Rates display modal
│   │   │   └── RateTokensUsedNotification.tsx  # Token usage notification
│   │   ├── contexts/      # React contexts (Auth)
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   │   └── locationService.ts  # Location API client with retry logic
│   │   └── main.tsx       # Entry point
│   ├── public/            # Static assets + embed files
│   └── package.json
├── server/                 # Express backend
│   ├── src/
│   │   ├── routes/        # API routes
│   │   │   ├── auth.ts    # Authentication endpoints
│   │   │   ├── rates.ts   # Rate quoting and booking
│   │   │   └── locations.ts  # GeoNames API proxy
│   │   ├── services/      # Business logic
│   │   │   ├── geonames.ts  # GeoNames API client with retry logic
│   │   │   └── hubspot.ts   # HubSpot integration
│   │   ├── middleware/    # Express middleware
│   │   │   ├── auth.ts     # JWT authentication
│   │   │   └── validation.ts  # Request validation with Zod
│   │   └── lib/           # Utilities
│   │       └── supabaseClient.ts  # Supabase client
│   ├── supabase/
│   │   └── schema.sql     # Complete database schema
│   └── package.json
├── vercel.json            # Vercel deployment configuration
└── package.json           # Root scripts
```

## Setup

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 12+ (or Supabase account)
- GeoNames API username (free account at geonames.org)
- Git

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd "S-2 Web POC"
   ```

2. **Install dependencies**:
   ```bash
   npm run install:all
   ```

3. **Set up the database**:
   
   **Option A: Using Supabase (Recommended)**
   
   1. Create a Supabase project at https://supabase.com
   2. Run the **complete** SQL schema from `server/supabase/schema.sql` in the Supabase SQL editor
      - **IMPORTANT**: The schema includes a `consume_rate_token()` function that is required for rate token management
      - Make sure to run the entire file, including the function definition at the end
   3. Copy your Supabase credentials

   **Option B: Using Local PostgreSQL**
   
   1. Create a PostgreSQL database
   2. Run `server/supabase/schema.sql` in your database
   3. Set `DATABASE_URL` in your `.env` file

4. **Configure environment variables**:
   
   Create `server/.env`:
   ```env
   # Supabase Configuration (required)
   NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
   SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
   
   # JWT Secret (required)
   JWT_SECRET="your-super-secret-jwt-key-change-in-production"
   
   # Ship2Primus API Configuration (required for production)
   SHIP2PRIMUS_RATES_URL="https://s-2international-api.shipprimus.com/applet/v1/rate/multiple"
   SHIP2PRIMUS_BOOK_URL="https://s-2international-api.shipprimus.com/api/v1/book"
   SHIP2PRIMUS_LOGIN_URL="https://s-2international-api.shipprimus.com/api/v1/login"
   SHIP2PRIMUS_USERNAME="your-ship2primus-username"
   SHIP2PRIMUS_PASSWORD="your-ship2primus-password"
   
   # GeoNames API Configuration (required for location features)
   GEONAMES_USERNAME="your-geonames-username"
   
   # HubSpot Integration (optional - for automatic contact sync and notes)
   # Note: Either HUBSPOT_PRIVATE_APP_TOKEN or HUBSPOT_ACCESS_TOKEN can be used
   HUBSPOT_PRIVATE_APP_TOKEN="your-hubspot-private-app-token"
   # OR
   HUBSPOT_ACCESS_TOKEN="your-hubspot-access-token"
   
   # CORS Configuration
   ALLOWED_ORIGINS="http://localhost:3000,https://app.hubspot.com,https://*.hubspot.com"
   
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   ```

5. **Get GeoNames API Username**:
   - Sign up for a free account at http://www.geonames.org/login
   - Enable the free web service in your account settings
   - Use your username in the `GEONAMES_USERNAME` environment variable

### Running the Application

**Development mode** (runs both server and client):
```bash
npm run dev
```

This starts:
- Backend server on `http://localhost:5000`
- Frontend dev server on `http://localhost:3000`

**Production build**:
```bash
npm run build
npm start
```

The server will serve the built frontend from `client/dist`.

### Running Tests

```bash
npm test
```

Or individually:
```bash
npm run test:server
npm run test:client
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with email and password
  - Returns specific error messages:
    - "Invalid email or password format" for invalid email format
    - "This email address is not registered..." for non-existent emails
    - "Incorrect password..." for wrong passwords
  - Generates new JWT token with 1-hour expiration
  - Clears any existing token cookie before setting new one
- `POST /api/auth/logout` - Logout (clears JWT cookie)
  - Does NOT require authentication (allows logout with expired tokens)
  - Always clears cookie regardless of token validity
- `GET /api/auth/me` - Get current authenticated user
  - Returns 401 with `TOKEN_EXPIRED` error code when token expires
- `POST /api/auth/register` - Register new user/client
  - Validates password requirements (8+ chars, letter, number)
  - Returns detailed validation errors
  - Automatically creates HubSpot contact (when configured)
- `POST /api/auth/invite` - Invite user (ADMIN only)

### Rates & Booking
- `POST /api/rates` - Get shipping rates
  - Requires authentication
  - Enforces 3 quote requests per email (lifetime)
  - Blocks hazmat shipments with contact S2 message
  - Automatically creates HubSpot notes (when configured)
    - Logs all requests: success (✅), no rates (⚠️), and errors (❌)
    - Includes top 3 cheapest rates for successful requests
    - Tracks whether rate tokens were consumed
  - Returns rates sorted by price (cheapest first)
- `POST /api/book` - Book a shipment
  - Requires authentication
  - Creates booking record in database
  - Returns booking confirmation

### Locations (GeoNames Proxy)
- `GET /api/locations/countries` - Get all supported countries (US, CA)
- `GET /api/locations/states?country=US` - Get states/provinces for a country
- `GET /api/locations/cities?country=US&state=CA` - Get cities for a state
- `GET /api/locations/postal-codes?country=US&state=CA&city=Los Angeles` - Get postal codes for a city
- `GET /api/locations/lookup?country=US&postalCode=90210` - Reverse lookup location by postal code

All location endpoints:
- Use retry logic with exponential backoff (3 retries)
- Cache results for 7 days
- Fallback to expired cache on failure
- Return empty array for postal codes on failure (allows manual entry)

## HubSpot Embedding

### Option 1: Iframe Embed

Add this to your HubSpot page:

```html
<iframe 
  src="https://your-domain.com/embed.html?email=contact@example.com&firstname=John&lastname=Doe&dealId=12345"
  width="100%" 
  height="800px" 
  frameborder="0"
  id="shipprimus-iframe">
</iframe>

<script>
  // Auto-height resizing
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'resize') {
      document.getElementById('shipprimus-iframe').style.height = event.data.height + 'px';
    }
  });
</script>
```

### Option 2: Script Loader Embed

Add this to your HubSpot page:

```html
<div id="shipprimus-widget-container"></div>

<script src="https://your-domain.com/embed-loader.js"></script>
<script>
  ShipPrimusWidget.init({
    containerId: 'shipprimus-widget-container',
    context: {
      email: 'contact@example.com',
      firstname: 'John',
      lastname: 'Doe',
      dealId: '12345'
    }
  });
</script>
```

### HubSpot Context Parameters

The widget accepts these optional query parameters or postMessage context:
- `email` - Contact email
- `firstname` - Contact first name
- `lastname` - Contact last name
- `phone` - Contact phone
- `dealId` - HubSpot Deal ID
- `company` - Company name

These values will prefill the form when the user is logged in.

## Database Schema

The complete SQL schema is in `server/supabase/schema.sql`. Key tables:

### `clients` (Tenants)
- `id` (UUID, primary key)
- `name` (TEXT)
- `rate_tokens_remaining` (INTEGER, default 3)
- `rate_tokens_used` (INTEGER, default 0)
- `created_at` (TIMESTAMPTZ)

### `users`
- `id` (UUID, primary key)
- `client_id` (UUID, foreign key)
- `email` (TEXT, unique)
- `password_hash` (TEXT)
- `firstname` (TEXT, camelCase)
- `lastname` (TEXT, camelCase)
- `hubspot_opt_in` (BOOLEAN, default false)
- `role` (user_role enum: 'ADMIN' | 'USER')
- `created_at` (TIMESTAMPTZ)

**Important**: The database uses `firstname` and `lastname` (camelCase), not `first_name` and `last_name` (snake_case).

### `quote_requests`
- `id` (UUID, primary key)
- `client_id` (UUID)
- `user_id` (UUID)
- `request_payload_json` (JSONB)
- `created_at` (TIMESTAMPTZ)

### `rates`
- `id` (UUID, primary key)
- `quote_request_id` (UUID, foreign key)
- `rate_id` (TEXT)
- `carrier_name` (TEXT)
- `service_name` (TEXT)
- `transit_days` (INTEGER)
- `total_cost` (DECIMAL)
- `currency` (TEXT)
- `raw_json` (JSONB)
- `created_at` (TIMESTAMPTZ)

### `bookings`
- `id` (UUID, primary key)
- `client_id` (UUID)
- `user_id` (UUID)
- `quote_request_id` (UUID)
- `rate_id` (UUID)
- `booking_id_external` (TEXT)
- `confirmation_number` (TEXT)
- `status` (TEXT)
- `raw_json` (JSONB)
- `created_at` (TIMESTAMPTZ)

### `audit_logs`
- `id` (UUID, primary key)
- `client_id` (UUID)
- `user_id` (UUID, nullable)
- `action` (TEXT)
- `metadata_json` (JSONB)
- `created_at` (TIMESTAMPTZ)

## Security

- **Passwords**: Hashed with bcrypt (10 rounds)
- **Authentication**: JWT tokens in HttpOnly cookies (1-hour expiration)
  - Tokens automatically expire after 1 hour of inactivity
  - Auto-logout modal appears when token expires (only on actual expiration, not on manual logout)
  - Tokens are renewed on each successful login
  - Logout endpoint does not require authentication (allows logout with expired tokens)
  - Logout endpoint does not require authentication (allows logout with expired tokens)
- **CORS**: Allowlist for HubSpot domains
- **Input Validation**: Zod schemas for all API endpoints
- **Multi-tenant Isolation**: Enforced at database level with client_id filtering
- **Rate Limiting**: 3 quote requests per email (lifetime)
- **Password Requirements**: Enforced on both client and server
  - Minimum 8 characters
  - At least one letter
  - At least one number

## Development

### Backend Development

```bash
cd server
npm run dev  # Uses ts-node with watch mode
```

### Frontend Development

```bash
cd client
npm run dev  # Vite dev server
```

### Database Management

The application uses Supabase directly (not Prisma). To manage the database:

1. Use Supabase Dashboard: https://supabase.com/dashboard
2. Run SQL queries in the SQL Editor
3. Use the Table Editor for manual data entry

### Customization

**Background Opacity**: To change the background opacity, edit `client/src/components/AnimatedBackground.tsx`:
- Line 83: Change `opacity: 0.3` to your desired value (0.0 to 1.0)

**Notification Z-Index**: The rate tokens notification uses `z-[9999]` to appear above modals. To change:
- Edit `client/src/components/RateTokensUsedNotification.tsx`, line 34

## Testing

### Backend Tests

Tests use Jest + Supertest. Mock Supabase and external APIs.

```bash
cd server
npm test
```

### Frontend Tests

Tests use Vitest + React Testing Library.

```bash
cd client
npm test
```

## Deployment

### Environment Variables

Ensure all required environment variables are set in production (see `server/env.example` for full list):

**Required:**
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for backend operations)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key (for client-side)
- `JWT_SECRET` - Strong random secret for JWT signing
- `SHIP2PRIMUS_RATES_URL` - Ship2Primus rates API endpoint
- `SHIP2PRIMUS_BOOK_URL` - Ship2Primus booking API endpoint
- `SHIP2PRIMUS_LOGIN_URL` - Ship2Primus authentication endpoint
- `SHIP2PRIMUS_USERNAME` - Ship2Primus API username
- `SHIP2PRIMUS_PASSWORD` - Ship2Primus API password
- `GEONAMES_USERNAME` - GeoNames API username

**Optional:**
- `HUBSPOT_PRIVATE_APP_TOKEN` - For automatic contact sync and notes
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins
- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Set to `production` in production

### Database Setup

1. **Create Supabase Project**: https://supabase.com
2. **Run Schema**: Copy and paste `server/supabase/schema.sql` into Supabase SQL Editor
3. **Verify Tables**: Ensure all tables are created with correct column names
4. **Set RLS Policies**: The schema includes RLS policies for service role access

### Build for Production

```bash
npm run build
npm start
```

The server will serve the built frontend from `client/dist`.

### Vercel Deployment

See `DEPLOYMENT.md` for detailed Vercel deployment instructions.

**Quick Steps:**
1. Connect GitHub repository to Vercel
2. Set all environment variables in Vercel project settings
3. Build command: `npm run vercel-build`
4. Output directory: `client/dist`
5. Deploy

The application will automatically build and deploy on push to the main branch.

## GeoNames API Reliability

The application includes robust retry logic for GeoNames API calls:

- **Retry Logic**: 3 attempts with exponential backoff (1s, 2s, 4s)
- **Timeout**: 15 seconds per request
- **Caching**: 7-day cache for all location data
- **Fallback**: Uses expired cache if API fails completely
- **Error Handling**: Returns empty array for postal codes (allows manual entry)

This ensures >95% success rate even with GeoNames API instability.

## Required Database Functions

The application requires a PostgreSQL function for rate token management. This function is included in `server/supabase/schema.sql`:

- **`consume_rate_token(p_client_id UUID)`**: Atomically decrements `rate_tokens_remaining` and increments `rate_tokens_used` for a client. Returns the updated token counts.

**IMPORTANT**: When setting up your database, make sure to run the **entire** `server/supabase/schema.sql` file, including the function definition at the end. Without this function, rate token consumption will fail.

## Recent Updates

### Latest Changes (February 2025)

- **Token Expiration Fix**: Fixed token expiration modal appearing incorrectly
  - Modal now only appears when token actually expires (TOKEN_EXPIRED error code)
  - Manual logout properly clears expiration state without showing modal
  - Token expiration checks are more accurate and only trigger on actual expiration
  
- **Database Function**: Added `consume_rate_token()` function to SQL schema
  - Required for rate token management
  - Must be included when running schema.sql in Supabase
  - Function atomically updates token counts
  
- **Audit Log Fix**: Fixed promise handling for audit log inserts
  - Wrapped in async IIFE to prevent `.catch is not a function` errors
  - Non-blocking audit logging that doesn't affect login flow
  
- **Login Flow Improvements**: Enhanced login error handling and token management
  - Clears existing cookies before setting new token
  - Better state management on login/logout
  - Proper token renewal on each login
  - Logout works even with expired tokens

### Previous Updates

### Registration Improvements
- Added detailed password validation with real-time feedback
- Password requirements displayed before submission
- Clear error messages for each validation failure
- Backend validation with structured error responses

### Location Selector Improvements
- Retry logic with exponential backoff
- 7-day caching for improved performance
- Manual ZIP code entry option always available
- Better error messages and loading states

### UI Improvements
- Static background (no animations)
- Background opacity reduced to 0.3 (configurable in `AnimatedBackground.tsx`)
- Rate tokens notification appears above modals (z-index: 9999)
- Removed "Get New Quote" button (form changes reset rates automatically)

## License

MIT

## Support

For issues or questions, please contact the development team.
