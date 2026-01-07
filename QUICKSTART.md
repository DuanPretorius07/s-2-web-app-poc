# Quick Start Guide

Get the ShipPrimus Portal up and running in 5 minutes.

## 1. Install Dependencies

```bash
npm run install:all
```

## 2. Set Up Database

Create a PostgreSQL database, then:

```bash
cd server
cp env.example .env
# Edit .env with your DATABASE_URL
```

Example `.env`:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/shipprimus?schema=public"
JWT_SECRET="change-this-to-a-random-secret-in-production"
```

## 3. Run Database Migrations

```bash
cd server
npm run prisma:generate
npm run prisma:migrate
```

When prompted, name your migration: `init`

## 4. Create Your First User

The app will auto-create a client when you register. Start the app:

```bash
npm run dev
```

Then visit `http://localhost:3000` and click "Register" to create your first account.

## 5. Test the Flow

1. Login with your new account
2. Fill out the rates form
3. Click "Get Rates" (will use mock data if API Gateway not configured)
4. Click "Book" on a rate
5. View history at `/history`

## Mock Mode

If `API_GATEWAY_RATES_URL` and `PROXY_API_KEY` are not set, the app will return mock rates for testing.

## Next Steps

- Configure your API Gateway endpoints in `server/.env`
- Set up HubSpot integration (optional)
- Deploy to production

See `README.md` for full documentation.
