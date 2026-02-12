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

/**
 * Request to book (save quote/rate) - This saves the quote and notifies S2 team
 * Note: This does NOT create a booking, it only saves the quote for S2 processing
 */
async function callShip2PrimusSave(quoteRequest: any, rate: any, userInfo?: { email?: string; firstname?: string; lastname?: string; phone?: string }): Promise<{
  savedQuoteId?: string;
  confirmationNumber?: string;
  status: string;
  details?: any;
}> {
  const apiUrl = process.env.SHIP2PRIMUS_SAVE_URL || process.env.SHIP2PRIMUS_BOOK_URL;

  if (!apiUrl) {
    // Mock response for development
    console.warn('SHIP2PRIMUS_SAVE_URL not configured, returning mock data');
    return {
      savedQuoteId: `mock-saved-${Date.now()}`,
      confirmationNumber: `SAVED-${Math.random().toString(36).substring(2, 11).toUpperCase()}`,
      status: 'saved',
      details: {
        carrier: rate.carrierName,
        service: rate.serviceName,
      },
    };
  }

  try {
    // Construct save payload matching Postman format:
    // { rateId, carrierName, serviceName, totalCost, currency, shipper, recipient, packages }
    const originalPayload = quoteRequest.requestPayloadJson || {};
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'book.ts:callShip2PrimusSave:entry',message:'Constructing save payload',data:{hasOriginalPayload:!!originalPayload,originalPayloadKeys:originalPayload?Object.keys(originalPayload):[],rateId:rate.rateId,carrierName:rate.carrierName,hasUserInfo:!!userInfo,userEmail:userInfo?.email},timestamp:Date.now(),runId:'pre-fix',hypothesisId:'H1,H2'})}).catch(()=>{});
    // #endregion

    // Extract origin/destination from original payload
    const originCity = originalPayload.originCity || '';
    const originState = originalPayload.originState || '';
    const originZipcode = originalPayload.originZipcode || '';
    const originCountry = originalPayload.originCountry || 'US';
    const destinationCity = originalPayload.destinationCity || '';
    const destinationState = originalPayload.destinationState || '';
    const destinationZipcode = originalPayload.destinationZipcode || '';
    const destinationCountry = originalPayload.destinationCountry || 'US';
    
    // Extract freight info for packages
    const freightInfo = Array.isArray(originalPayload.freightInfo) && originalPayload.freightInfo.length > 0
      ? originalPayload.freightInfo[0]
      : {};
    
    // Construct shipper object (origin)
    const shipperName = userInfo?.firstname && userInfo?.lastname
      ? `${userInfo.firstname} ${userInfo.lastname}`
      : userInfo?.email?.split('@')[0] || 'Shipper';
    
    // Construct recipient object (destination) - using same info for now
    // In a real scenario, recipient might be different, but for POC we'll use same user
    const recipientName = shipperName;
    
    // Build packages array from freightInfo
    const packages = [{
      weight: freightInfo.weight || 0,
      weightUnit: 'LB',
      length: freightInfo.length || 0,
      width: freightInfo.width || 0,
      height: freightInfo.height || 0,
      dimensionUnit: 'IN',
    }];
    
    // Construct payload matching Postman format
    const savePayload = {
      rateId: rate.rateId, // Top-level rateId (required by API)
      carrierName: rate.carrierName,
      serviceName: rate.serviceName,
      totalCost: rate.totalCost,
      currency: rate.currency || 'USD',
      shipper: {
        name: shipperName,
        address: '', // Not available in current form, leave empty
        city: originCity,
        state: originState,
        postalCode: originZipcode,
        country: originCountry,
        phone: userInfo?.phone || '',
        email: userInfo?.email || '',
      },
      recipient: {
        name: recipientName,
        address: '', // Not available in current form, leave empty
        city: destinationCity,
        state: destinationState,
        postalCode: destinationZipcode,
        country: destinationCountry,
        phone: userInfo?.phone || '',
        email: userInfo?.email || '',
      },
      packages: packages,
    };

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'book.ts:callShip2PrimusSave:payload',message:'Save payload constructed',data:{rateId:savePayload.rateId,hasShipper:!!savePayload.shipper,hasRecipient:!!savePayload.recipient,packagesCount:savePayload.packages.length,shipperCity:savePayload.shipper.city,recipientCity:savePayload.recipient.city},timestamp:Date.now(),runId:'pre-fix',hypothesisId:'H1,H2'})}).catch(()=>{});
    // #endregion

    console.log('[SAVE] Request to book payload:', JSON.stringify(savePayload, null, 2));

    const data = await ship2PrimusRequest<any>(apiUrl, {
      method: 'POST',
      body: JSON.stringify(savePayload),
    });

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'book.ts:callShip2PrimusSave:success',message:'Save API call successful',data:{hasData:!!data,dataKeys:data?Object.keys(data):[],savedQuoteId:data?.id||data?.savedQuoteId||data?.quoteId,confirmationNumber:data?.confirmationNumber||data?.confirmation_number||data?.confirmation},timestamp:Date.now(),runId:'pre-fix',hypothesisId:'H1,H2'})}).catch(()=>{});
    // #endregion

    return {
      savedQuoteId: data.id || data.savedQuoteId || data.quoteId,
      confirmationNumber: data.confirmationNumber || data.confirmation_number || data.confirmation,
      status: data.status || 'saved',
      details: data,
    };
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'book.ts:callShip2PrimusSave:error',message:'Save API call failed',data:{errorName:error?.name,errorMessage:error?.message,errorStack:error?.stack?.substring(0,500)},timestamp:Date.now(),runId:'pre-fix',hypothesisId:'H1,H2'})}).catch(()=>{});
    // #endregion
    console.error('Ship2Primus save API error:', error);
    throw error;
  }
}

/**
 * Create HubSpot note for request to book (saves quote/rate)
 * Note: This is called when user requests to book, not when booking is confirmed
 */
async function createHubSpotRequestToBookNote(
  contactEmail: string,
  rate: any,
  saveResult: any,
  dealId?: string
) {
  const accessToken = process.env.HUBSPOT_PRIVATE_APP_TOKEN || process.env.HUBSPOT_ACCESS_TOKEN;
  if (!accessToken) {
    console.log('[HubSpot] Skipping request to book note - no token configured');
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
    const noteBody = `Request to Book - Quote/Rate Saved\n\n` +
      `Carrier: ${rate.carrierName}\n` +
      `Service: ${rate.serviceName}\n` +
      `Total Cost: $${rate.totalCost.toFixed(2)}\n` +
      `Confirmation: ${saveResult.confirmationNumber || saveResult.savedQuoteId || 'N/A'}`;

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
// Request to book - Saves quote/rate and notifies S2 team (does NOT create actual booking)
// Accepts either quoteId/selectedRateId (database flow) or rate data directly (POC flow)
router.post('/book', authenticateToken, validateBody(bookingRequestSchema), async (req: AuthRequest, res) => {
  const requestId = crypto.randomUUID();

  try {
    const userId = req.user!.userId;
    const clientId = req.user!.clientId;
    const userEmail = req.user!.email;
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

    // Fetch user details for shipper/recipient info
    let userInfo: { email?: string; firstname?: string; lastname?: string; phone?: string } = {
      email: userEmail,
    };
    
    try {
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('firstname, lastname, phone')
        .eq('id', userId)
        .single();
      
      if (userData) {
        userInfo.firstname = userData.firstname || undefined;
        userInfo.lastname = userData.lastname || undefined;
        userInfo.phone = userData.phone || undefined;
      }
    } catch (userError) {
      console.warn('[BOOK] Could not fetch user details, using email only:', userError);
    }

    // Call Ship2Primus Save API (saves quote and notifies S2 team)
    let saveResult;
    try {
      saveResult = await callShip2PrimusSave(
        { requestPayloadJson: originalRequestPayload },
        rateData,
        userInfo
      );
    } catch (error: any) {
      console.error('[BOOK] Save API error:', error);
      return res.status(502).json({
        requestId,
        errorCode: 'UPSTREAM_ERROR',
        message: 'Failed to save quote/rate request',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }

    // Save booking to database (optional - try to save if quoteId exists)
    // Note: We don't save to bookings table since this is a "request to book" not an actual booking
    // The save endpoint handles notification to S2 team
    
    // Create HubSpot note for request to book (non-blocking)
    if (userEmail) {
      createHubSpotRequestToBookNote(
        userEmail,
        rateData,
        saveResult
      ).catch((err) => {
        console.error('[BOOK] HubSpot note creation failed (non-blocking):', err);
      });
    }

    // Audit log for request to book
    try {
      await supabaseAdmin.from('audit_logs').insert({
        client_id: clientId,
        user_id: userId,
        action: 'REQUEST_TO_BOOK',
        metadata_json: {
          quoteRequestId: quoteId || null,
          rateId: selectedRateId || rateData.rateId,
          savedQuoteId: saveResult.savedQuoteId,
          confirmationNumber: saveResult.confirmationNumber,
        },
      });
    } catch (dbError) {
      console.warn('[BOOK] Audit log failed (non-critical):', dbError);
    }

    res.json({
      requestId,
      savedQuoteId: saveResult.savedQuoteId,
      confirmationNumber: saveResult.confirmationNumber,
      status: saveResult.status,
      message: 'Quote/rate request saved successfully. S2 team will be notified.',
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
      message: 'Failed to process request to book',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

export default router;
