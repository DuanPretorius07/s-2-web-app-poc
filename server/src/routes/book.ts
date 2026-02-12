import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabaseClient.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { ship2PrimusRequest } from '../lib/ship2primusClient.js';

const router = Router();

// Accept either quoteId/selectedRateId (existing flow) or rate data directly (POC flow)
const bookingRequestSchema = z.object({
  quoteId: z.string().uuid().optional(),
  selectedRateId: z.string().uuid().optional(),
  rate: z.object({
    rateId: z.string(),
    carrierName: z.string(),
    serviceName: z.string(),
    totalCost: z.number(),
    currency: z.string().optional().default('USD'),
  }).optional(),
}).refine((data) => (data.quoteId && data.selectedRateId) || data.rate, {
  message: "Either (quoteId and selectedRateId) or rate must be provided",
});

async function callShip2PrimusBook(quoteRequest: any, rate: any): Promise<{
  bookingId?: string;
  confirmationNumber?: string;
  status: string;
  details?: any;
}> {
  const apiUrl = process.env.SHIP2PRIMUS_BOOK_URL;

  if (!apiUrl) {
    // Mock response for development
    console.warn('SHIP2PRIMUS_BOOK_URL not configured, returning mock data');
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
    // Construct booking payload according to ShipPrimus API schema
    // The booking endpoint expects the original quote request payload + selected rate ID
    const originalPayload = quoteRequest.requestPayloadJson || {};
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'book.ts:callShip2PrimusBook:before-payload',message:'Building booking payload',data:{hasOriginalPayload:!!originalPayload,originalPayloadKeys:originalPayload?Object.keys(originalPayload):[],originalPayloadSize:originalPayload?JSON.stringify(originalPayload).length:0,rateId:rate.rateId,carrierName:rate.carrierName},timestamp:Date.now(),runId:'debug-booking',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion

    // ShipPrimus booking API expects the original request payload with the selected rate ID
    // Based on API docs, try sending original payload merged with rate ID
    // If originalPayload is empty/null, we need to construct it from rate data
    const bookingPayload: any = originalPayload && Object.keys(originalPayload).length > 0
      ? {
          ...originalPayload,
          selectedRateId: rate.rateId,
        }
      : {
          // Fallback: construct minimal payload if original is missing
          selectedRateId: rate.rateId,
          rate: {
            rateId: rate.rateId,
            carrierName: rate.carrierName,
            serviceName: rate.serviceName,
            totalCost: rate.totalCost,
            currency: rate.currency || 'USD',
          },
        };

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'book.ts:callShip2PrimusBook:payload-ready',message:'Booking payload ready',data:{payloadKeys:Object.keys(bookingPayload),hasOriginCity:!!bookingPayload.originCity,hasDestinationCity:!!bookingPayload.destinationCity,hasSelectedRateId:!!bookingPayload.selectedRateId,payloadSize:JSON.stringify(bookingPayload).length,usingFallback:!originalPayload||Object.keys(originalPayload).length===0},timestamp:Date.now(),runId:'debug-booking',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion

    // Log the outgoing payload for debugging (server-side only)
    console.log('[BOOK] Booking payload:', JSON.stringify(bookingPayload, null, 2));

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'book.ts:callShip2PrimusBook:before-api-call',message:'About to call ShipPrimus booking API',data:{apiUrl,hasPayload:!!bookingPayload,payloadKeys:Object.keys(bookingPayload)},timestamp:Date.now(),runId:'debug-booking',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion

    const data = await ship2PrimusRequest<any>(apiUrl, {
      method: 'POST',
      body: JSON.stringify(bookingPayload),
    });

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'book.ts:callShip2PrimusBook:after-api-call',message:'ShipPrimus booking API response',data:{hasData:!!data,dataKeys:data?Object.keys(data):[],hasBookingId:!!(data?.bookingId||data?.booking_id||data?.id)},timestamp:Date.now(),runId:'debug-booking',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion

    return {
      bookingId: data.bookingId || data.booking_id || data.id,
      confirmationNumber: data.confirmationNumber || data.confirmation_number || data.confirmation,
      status: data.status || 'confirmed',
      details: data,
    };
  } catch (error) {
    console.error('Ship2Primus booking API error:', error);
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
// Accepts either quoteId/selectedRateId (database flow) or rate data directly (POC flow)
router.post('/book', authenticateToken, validateBody(bookingRequestSchema), async (req: AuthRequest, res) => {
  const requestId = crypto.randomUUID();

  try {
    const userId = req.user!.userId;
    const clientId = req.user!.clientId;
    const { quoteId, selectedRateId, rate, originalRequestPayload: providedRequestPayload } = req.body;

    let rateData: any;
    let originalRequestPayload: any = null;

    // Handle two flows: database-based (quoteId) or direct rate (POC)
    if (quoteId && selectedRateId) {
      // Existing database flow: fetch quote and rate from database
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

      const rates = Array.isArray(quoteRequest.rates) ? quoteRequest.rates : [];
      const dbRate = rates.find((r: any) => r.id === selectedRateId);
      if (!dbRate) {
        return res.status(404).json({
          requestId,
          errorCode: 'RATE_NOT_FOUND',
          message: 'Selected rate not found',
        });
      }

      rateData = {
        rateId: dbRate.rate_id,
        carrierName: dbRate.carrier_name,
        serviceName: dbRate.service_name,
        totalCost: parseFloat(dbRate.total_cost.toString()),
        currency: dbRate.currency,
      };
      originalRequestPayload = quoteRequest.request_payload_json;
    } else if (rate) {
      // POC flow: use rate data directly
      rateData = rate;
      // Use provided original request payload if available, otherwise null
      originalRequestPayload = providedRequestPayload || null;
    } else {
      return res.status(400).json({
        requestId,
        errorCode: 'INVALID_REQUEST',
        message: 'Either (quoteId and selectedRateId) or rate must be provided',
      });
    }

    // Call Ship2Primus API
    let bookingResult;
    try {
      bookingResult = await callShip2PrimusBook(
        { requestPayloadJson: originalRequestPayload },
        rateData
      );
    } catch (error: any) {
      console.error('[BOOK] Booking API error:', error);
      return res.status(502).json({
        requestId,
        errorCode: 'UPSTREAM_ERROR',
        message: 'Failed to create booking with shipping provider',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }

    // Save booking to database (optional - try to save if quoteId exists)
    let savedBooking: any = null;
    if (quoteId && selectedRateId) {
      try {
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
          .select('id, booking_id_external, confirmation_number, status')
          .single();

        if (!bookingError && booking) {
          savedBooking = booking;
          
          // Audit log
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
        }
      } catch (dbError) {
        console.warn('[BOOK] Database save failed (non-critical):', dbError);
      }
    }

    res.json({
      requestId,
      bookingId: savedBooking?.id || bookingResult.bookingId,
      confirmationNumber: bookingResult.confirmationNumber,
      status: bookingResult.status,
      rate: {
        carrierName: rateData.carrierName,
        serviceName: rateData.serviceName,
        totalCost: rateData.totalCost,
        currency: rateData.currency || 'USD',
      },
    });
  } catch (error: any) {
    console.error('[BOOK] Endpoint error:', error);
    res.status(500).json({
      requestId,
      errorCode: 'INTERNAL_ERROR',
      message: 'Failed to process booking',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

export default router;
