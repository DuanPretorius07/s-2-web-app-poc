import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';

const router = Router();
const prisma = new PrismaClient();

const bookingRequestSchema = z.object({
  quoteId: z.string().uuid(),
  selectedRateId: z.string().uuid(),
});

async function callApiGatewayBook(quoteRequest: any, rate: any): Promise<{
  bookingId?: string;
  confirmationNumber?: string;
  status: string;
  details?: any;
}> {
  const apiUrl = process.env.API_GATEWAY_BOOK_URL;
  const apiKey = process.env.PROXY_API_KEY;

  if (!apiUrl || !apiKey) {
    // Mock response for development
    console.warn('API_GATEWAY_BOOK_URL or PROXY_API_KEY not configured, returning mock data');
    return {
      bookingId: `mock-booking-${Date.now()}`,
      confirmationNumber: `CONF-${Math.random().toString(36).substring(2, 11).toUpperCase()}`,
      status: 'confirmed',
      details: {
        carrier: rate.carrierName,
        service: rate.serviceName,
      },
    };
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        quoteRequest: quoteRequest.requestPayloadJson,
        rate: {
          rateId: rate.rateId,
          carrierName: rate.carrierName,
          serviceName: rate.serviceName,
          totalCost: rate.totalCost,
          currency: rate.currency,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`API Gateway returned ${response.status}`);
    }

    const data = await response.json();
    return {
      bookingId: data.bookingId || data.id,
      confirmationNumber: data.confirmationNumber || data.confirmation,
      status: data.status || 'confirmed',
      details: data,
    };
  } catch (error) {
    console.error('API Gateway book error:', error);
    throw error;
  }
}

async function createHubSpotBookingNote(
  contactEmail: string,
  rate: any,
  booking: any,
  dealId?: string
) {
  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!accessToken) {
    return;
  }

  try {
    const searchResponse = await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts/search`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          filterGroups: [{
            filters: [{
              propertyName: 'email',
              operator: 'EQ',
              value: contactEmail,
            }],
          }],
        }),
      }
    );

    if (!searchResponse.ok) {
      return;
    }

    const searchData = await searchResponse.json();
    if (!searchData.results || searchData.results.length === 0) {
      return;
    }

    const contactId = searchData.results[0].id;
    const noteBody = `Shipping Booking Confirmed\n\n` +
      `Carrier: ${rate.carrierName}\n` +
      `Service: ${rate.serviceName}\n` +
      `Total Cost: $${rate.totalCost.toFixed(2)}\n` +
      `Confirmation: ${booking.confirmationNumber || booking.bookingIdExternal || 'N/A'}`;

    const notePayload: any = {
      properties: {
        hs_note_body: noteBody,
      },
      associations: [{
        to: { id: contactId },
        types: [{
          associationCategory: 'HUBSPOT_DEFINED',
          associationTypeId: 214,
        }],
      }],
    };

    if (dealId) {
      notePayload.associations.push({
        to: { id: dealId },
        types: [{
          associationCategory: 'HUBSPOT_DEFINED',
          associationTypeId: 214,
        }],
      });
    }

    await fetch('https://api.hubapi.com/crm/v3/objects/notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(notePayload),
    });
  } catch (error) {
    console.error('HubSpot booking note error:', error);
  }
}

// POST /api/book
router.post('/book', authenticateToken, validateBody(bookingRequestSchema), async (req: AuthRequest, res) => {
  const requestId = crypto.randomUUID();

  try {
    const userId = req.user!.userId;
    const clientId = req.user!.clientId;
    const { quoteId, selectedRateId } = req.body;

    // Verify quote request belongs to user's client
    const quoteRequest = await prisma.quoteRequest.findFirst({
      where: {
        id: quoteId,
        clientId,
      },
      include: {
        rates: true,
      },
    });

    if (!quoteRequest) {
      return res.status(404).json({
        requestId,
        errorCode: 'QUOTE_NOT_FOUND',
        message: 'Quote request not found',
      });
    }

    // Find selected rate
    const rate = quoteRequest.rates.find(r => r.id === selectedRateId);
    if (!rate) {
      return res.status(404).json({
        requestId,
        errorCode: 'RATE_NOT_FOUND',
        message: 'Selected rate not found',
      });
    }

    // Call API Gateway
    let bookingResult;
    try {
      bookingResult = await callApiGatewayBook(quoteRequest, rate);
    } catch (error) {
      console.error('Booking API error:', error);
      return res.status(502).json({
        requestId,
        errorCode: 'UPSTREAM_ERROR',
        message: 'Failed to create booking with shipping provider',
      });
    }

    // Save booking to database
    const booking = await prisma.booking.create({
      data: {
        clientId,
        userId,
        quoteRequestId: quoteId,
        rateId: selectedRateId,
        bookingIdExternal: bookingResult.bookingId,
        confirmationNumber: bookingResult.confirmationNumber,
        status: bookingResult.status,
        rawJson: bookingResult.details as any,
      },
      include: {
        rate: true,
      },
    });

    // Create HubSpot note if configured
    const requestPayload = quoteRequest.requestPayloadJson as any;
    const contactEmail = requestPayload.hubspotContext?.email || requestPayload.contact?.email;
    if (contactEmail) {
      await createHubSpotBookingNote(
        contactEmail,
        rate,
        booking,
        requestPayload.hubspotContext?.dealId
      );
    }

    await prisma.auditLog.create({
      data: {
        clientId,
        userId,
        action: 'CREATE_BOOKING',
        metadataJson: {
          bookingId: booking.id,
          quoteRequestId: quoteId,
          rateId: selectedRateId,
        },
      },
    });

    res.json({
      requestId,
      bookingId: booking.id,
      confirmationNumber: booking.confirmationNumber,
      status: booking.status,
      rate: {
        carrierName: booking.rate.carrierName,
        serviceName: booking.rate.serviceName,
        totalCost: booking.rate.totalCost,
        currency: booking.rate.currency,
      },
    });
  } catch (error) {
    console.error('Book endpoint error:', error);
    res.status(500).json({
      requestId,
      errorCode: 'INTERNAL_ERROR',
      message: 'Failed to process booking',
    });
  }
});

export default router;
