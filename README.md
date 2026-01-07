# ShipPrimus Portal

A full-stack shipping quote and booking portal web application designed for HubSpot embedding. This application provides multi-tenant support, authentication, rate quoting, booking, and history management.

## Features

- **Multi-tenant Architecture**: Each client (tenant) has isolated data and users
- **Authentication**: JWT-based auth with HttpOnly cookies, role-based access (ADMIN/USER)
- **Shipping Flow**: Get rates → View results → Book shipment → View history
- **HubSpot Integration**: Embeddable via iframe or script loader with context prefill
- **History Management**: View past quotes and bookings with filtering
- **HubSpot CRM Writeback**: Optional server-side notes creation (when configured)

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT + HttpOnly cookies
- **Testing**: Jest + Supertest (backend), Vitest + React Testing Library (frontend)

## Project Structure

```
.
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── contexts/      # React contexts (Auth)
│   │   ├── pages/         # Page components
│   │   └── main.tsx       # Entry point
│   ├── public/            # Static assets + embed files
│   └── package.json
├── server/                 # Express backend
│   ├── src/
│   │   ├── routes/        # API routes
│   │   ├── middleware/    # Express middleware
│   │   └── types.ts       # TypeScript types
│   ├── prisma/
│   │   └── schema.prisma  # Database schema
│   └── package.json
└── package.json           # Root scripts
```

## Setup

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 12+
- Git

### Installation

1. **Clone the repository** (or use this directory)

2. **Install dependencies**:
   ```bash
   npm run install:all
   ```

3. **Set up the database**:
   ```bash
   cd server
   cp env.example .env
   # Edit .env with your DATABASE_URL and other secrets
   ```

4. **Run Prisma migrations**:
   ```bash
   cd server
   npm run prisma:generate
   npm run prisma:migrate
   ```

5. **Configure environment variables**:
   
   Create `server/.env`:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/shipprimus?schema=public"
   JWT_SECRET="your-super-secret-jwt-key-change-in-production"
   API_GATEWAY_RATES_URL="https://api-gateway.example.com/rates"
   API_GATEWAY_BOOK_URL="https://api-gateway.example.com/book"
   PROXY_API_KEY="your-api-gateway-proxy-key"
   HUBSPOT_ACCESS_TOKEN=""  # Optional
   ALLOWED_ORIGINS="http://localhost:3000,https://app.hubspot.com,https://*.hubspot.com"
   PORT=5000
   NODE_ENV=development
   ```

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
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/register` - Register new user/client
- `POST /api/auth/invite` - Invite user (ADMIN only)

### Rates & Booking
- `POST /api/rates` - Get shipping rates
- `POST /api/book` - Book a shipment

### History
- `GET /api/history/quotes` - List quotes (with filters)
- `GET /api/history/quotes/:quoteId` - Get quote details
- `GET /api/history/bookings` - List bookings (with filters)
- `GET /api/history/bookings/:bookingId` - Get booking details

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

- **Client**: Tenant organization
- **User**: Users belonging to a Client
- **QuoteRequest**: Rate request with full payload
- **Rate**: Individual rate result from API Gateway
- **Booking**: Booked shipment
- **AuditLog**: Activity logging

See `server/prisma/schema.prisma` for full schema.

## Security

- Passwords hashed with bcrypt (10 rounds)
- JWT tokens in HttpOnly cookies
- CORS allowlist for HubSpot domains
- Rate limiting on auth and API endpoints
- Input validation with Zod
- Multi-tenant data isolation enforced at database level

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

```bash
cd server
npm run prisma:studio  # Open Prisma Studio
npm run prisma:migrate  # Create new migration
```

## Testing

### Backend Tests

Tests use Jest + Supertest. Mock Prisma and external APIs.

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

Ensure all required environment variables are set in production:
- `DATABASE_URL`
- `JWT_SECRET` (use a strong random secret)
- `API_GATEWAY_RATES_URL`
- `API_GATEWAY_BOOK_URL`
- `PROXY_API_KEY`
- `ALLOWED_ORIGINS` (include your HubSpot domains)
- `NODE_ENV=production`

### Build for Production

```bash
npm run build
npm start
```

The server will serve the built frontend from `client/dist`.

## License

MIT

## Support

For issues or questions, please contact the development team.
