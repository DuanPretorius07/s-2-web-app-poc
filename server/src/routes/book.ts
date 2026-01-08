import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabaseClient.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';

const router = Router();

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

    const data = await response.json() as any;
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

    const searchData = await searchResponse.json() as any;
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
    const { data: quoteRequest, error: quoteError } = await supabaseAdmin
      .from('quote_requests')
      .select(`
        id,
        request_payload_json,
        rates (
          id,
          rate_id,
          carrier_name,
          service_name,
          transit_days,
          total_cost,
          currency
        )
      `)
      .eq('id', quoteId)
      .eq('client_id', clientId)
      .single();

    if (quoteError || !quoteRequest) {
      return res.status(404).json({
        requestId,
        errorCode: 'QUOTE_NOT_FOUND',
        message: 'Quote request not found',
      });
    }

    // Find selected rate
    const rates = Array.isArray(quoteRequest.rates) ? quoteRequest.rates : [];
    const rate = rates.find((r: any) => r.id === selectedRateId);
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
      bookingResult = await callApiGatewayBook(
        { requestPayloadJson: quoteRequest.request_payload_json },
        {
          rateId: rate.rate_id,
          carrierName: rate.carrier_name,
          serviceName: rate.service_name,
          totalCost: parseFloat(rate.total_cost.toString()),
          currency: rate.currency,
        }
      );
    } catch (error) {
      console.error('Booking API error:', error);
      return res.status(502).json({
        requestId,
        errorCode: 'UPSTREAM_ERROR',
        message: 'Failed to create booking with shipping provider',
      });
    }

    // Save booking to database
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        client_id: clientId,
        user_id: userId,
        quote_request_id: quoteId,
        rate_id: selectedRateId,
        booking_id_external: bookingResult.bookingId,
        confirmation_number: bookingResult.confirmationNumber,
        status: bookingResult.status,
        raw_json: bookingResult.details as any,
      })
      .select(`
        id,
        booking_id_external,
        confirmation_number,
        status,
        rates (
          id,
          carrier_name,
          service_name,
          transit_days,
          total_cost,
          currency
        )
      `)
      .single();

    if (bookingError || !booking) {
      throw new Error('Failed to save booking');
    }

    // Create HubSpot note if configured
    const requestPayload = quoteRequest.request_payload_json as any;
    const contactEmail = requestPayload.hubspotContext?.email || requestPayload.contact?.email;
    if (contactEmail) {
      const bookingRate = Array.isArray(booking.rates) ? booking.rates[0] : booking.rates;
      await createHubSpotBookingNote(
        contactEmail,
        {
          carrierName: bookingRate?.carrier_name || rate.carrier_name,
          serviceName: bookingRate?.service_name || rate.service_name,
          totalCost: bookingRate ? parseFloat(bookingRate.total_cost.toString()) : parseFloat(rate.total_cost.toString()),
        },
        {
          bookingIdExternal: booking.booking_id_external,
          confirmationNumber: booking.confirmation_number,
        },
        requestPayload.hubspotContext?.dealId
      );
    }

    await supabaseAdmin.from('audit_logs').insert({
      client_id: clientId,
      user_id: userId,
      action: 'CREATE_BOOKING',
      metadata_json: {
        bookingId: booking.id,
        quoteRequestId: quoteId,
        rateId: selectedRateId,
      },
    });

    const bookingRate = Array.isArray(booking.rates) ? booking.rates[0] : booking.rates;
    res.json({
      requestId,
      bookingId: booking.id,
      confirmationNumber: booking.confirmation_number,
      status: booking.status,
      rate: {
        carrierName: bookingRate?.carrier_name || '',
        serviceName: bookingRate?.service_name || '',
        totalCost: bookingRate ? parseFloat(bookingRate.total_cost.toString()) : 0,
        currency: bookingRate?.currency || 'USD',
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
