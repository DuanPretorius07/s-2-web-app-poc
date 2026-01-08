# Ship2Primus API Information

Based on the official API documentation: https://sandbox-api-applet.shipprimus.com/api/v1/docs

## API Endpoints

### Production URLs

| Service | Endpoint | Base URL |
|---------|----------|----------|
| **Rates** | `/applet/v1/rate/multiple` | `https://s-2international-api.shipprimus.com` |
| **Booking** | `/api/v1/book` | `https://s-2international-api.shipprimus.com` |
| **Login** | `/api/v1/login` | `https://s-2international-api.shipprimus.com` |

### Sandbox URLs (for testing)

| Service | Endpoint | Base URL |
|---------|----------|----------|
| **Rates** | `/applet/v1/rate/multiple` | `https://sandbox-api-applet.shipprimus.com` |
| **Booking** | `/api/v1/book` (see docs) | `https://sandbox-api-applet.shipprimus.com` |
| **Login** | `/api/v1/login` | `https://sandbox-api-applet.shipprimus.com` |

## Booking API Details

**Documentation**: https://sandbox-api-applet.shipprimus.com/api/v1/docs#/Booking/APIBusinessAppletBookBookShipment

**Endpoint**: `POST /api/v1/book`

**Authentication**: Bearer token (obtained via login endpoint)

**Request Format**: 
- The booking endpoint expects the quote request payload and selected rate information
- See API documentation for exact request schema

## Environment Variables

### Production
```env
SHIP2PRIMUS_RATES_URL="https://s-2international-api.shipprimus.com/applet/v1/rate/multiple"
SHIP2PRIMUS_BOOK_URL="https://s-2international-api.shipprimus.com/api/v1/book"
SHIP2PRIMUS_LOGIN_URL="https://s-2international-api.shipprimus.com/api/v1/login"
SHIP2PRIMUS_USERNAME="your-username"
SHIP2PRIMUS_PASSWORD="your-password"
```

### Sandbox (for testing)
```env
SHIP2PRIMUS_RATES_URL="https://sandbox-api-applet.shipprimus.com/applet/v1/rate/multiple"
SHIP2PRIMUS_BOOK_URL="https://sandbox-api-applet.shipprimus.com/api/v1/book"
SHIP2PRIMUS_LOGIN_URL="https://sandbox-api-applet.shipprimus.com/api/v1/login"
SHIP2PRIMUS_USERNAME="sandbox-username"
SHIP2PRIMUS_PASSWORD="sandbox-password"
```

## Implementation Notes

1. **Authentication**: The system automatically authenticates using the login endpoint and caches the token
2. **Token Caching**: Tokens are cached for 50 minutes to avoid excessive login requests
3. **Auto-Retry**: If a request fails with 401, the system automatically refreshes the token and retries

## Request/Response Handling

The current implementation normalizes responses to handle different possible response formats:

```typescript
{
  bookingId: data.bookingId || data.booking_id || data.id,
  confirmationNumber: data.confirmationNumber || data.confirmation_number || data.confirmation,
  status: data.status || 'confirmed',
  details: data
}
```

This ensures compatibility even if the API response structure varies.

## Testing

To test with the sandbox:
1. Update environment variables to use sandbox URLs
2. Use sandbox credentials
3. Test the full flow: login → rates → booking
4. Verify responses match the API documentation format

## References

- API Documentation: https://sandbox-api-applet.shipprimus.com/api/v1/docs
- Booking Endpoint: https://sandbox-api-applet.shipprimus.com/api/v1/docs#/Booking/APIBusinessAppletBookBookShipment
