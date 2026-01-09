import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabaseClient.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { NormalizedRate } from '../types.js';
import { ship2PrimusRequest } from '../lib/ship2primusClient.js';

const router = Router();

// Schema matching the exact payload structure from existing JavaScript frontend
// This must match the request body shape exactly: originCity, originState, freightInfo, etc.
const rateRequestSchema = z.object({
  originCity: z.string().optional(),
  originState: z.string().optional(),
  originZipcode: z.string().optional(),
  originCountry: z.string().optional().default('US'),
  destinationCity: z.string().optional(),
  destinationState: z.string().optional(),
  destinationZipcode: z.string().optional(),
  destinationCountry: z.string().optional().default('US'),
  UOM: z.string().optional().default('US'),
  pickupDate: z.string().optional(),
  freightInfo: z.array(z.object({
    qty: z.number().int().min(1),
    dimType: z.string().optional(),
    weight: z.number().min(0),
    weightType: z.string().optional(),
    length: z.number().min(0).optional(),
    width: z.number().min(0).optional(),
    height: z.number().min(0).optional(),
    volume: z.number().min(0).optional(),
    hazmat: z.boolean().optional(),
    class: z.number().int().optional(),
    stack: z.boolean().optional(),
    stackAmount: z.number().int().min(1).optional(),
  })).min(1),
  rateTypesList: z.array(z.string()).min(1),
});

/**
 * Calculate freight class based on weight and dimensions (matching Lambda logic)
 */
function calculateFreightClass(weight: number, length: number, width: number, height: number): number {
  if (!weight || !length || !width || !height) return 0;
  
  const volumeCFT = (length * width * height) / 1728;
  if (volumeCFT === 0) return 0;
  
  const density = weight / volumeCFT;
  
  if (density > 50) return 50;
  else if (density > 35) return 55;
  else if (density > 30) return 60;
  else if (density > 22.5) return 65;
  else if (density > 15) return 70;
  else if (density > 13.5) return 77.5;
  else if (density > 12) return 85;
  else if (density > 10.5) return 92.5;
  else if (density > 9) return 100;
  else if (density > 8) return 110;
  else if (density > 7) return 125;
  else if (density > 6) return 150;
  else if (density > 5) return 175;
  else if (density > 4) return 200;
  else if (density > 3) return 250;
  else if (density > 2) return 300;
  else if (density > 1) return 400;
  else return 500;
}

/**
 * Build freight info array matching Lambda logic:
 * - Automatically calculates freight class if not provided
 * - Forces dimType to "PLT" (pallet)
 * - Handles stackable and hazmat properly
 */
function buildFreightInfo(freightInfoArray: any[]): any[] {
  return (freightInfoArray || []).map((item) => {
    const stackable = item.stack === true;
    const hazmat = item.hazmat === true;
    
    // Calculate freight class if dimensions and weight are available
    let freightClass = item.class;
    if (!freightClass && item.weight && item.length && item.width && item.height) {
      freightClass = calculateFreightClass(item.weight, item.length, item.width, item.height);
    }
    
    return {
      qty: item.qty,
      dimType: "PLT", // force pallet (matching Lambda)
      weight: item.weight,
      weightType: (item.weightType || "").toLowerCase(),
      length: item.length,
      width: item.width,
      height: item.height,
      class: freightClass || item.class || 0,
      stack: stackable ? true : undefined,
      ...(stackable && { stackAmount: item.stackAmount }),
      hazmat: hazmat ? true : undefined,
      // Include hazmat details if hazmat is true
      ...(hazmat && {
        UN: item.UN || undefined,
        UNDescription: item.UNDescription || undefined,
        UNHAZClass: item.UNHAZClass || undefined,
        UNPKGGroup: item.UNPKGGroup || undefined,
        UNLabels: item.UNLabels || undefined,
      }),
    };
  });
}

/**
 * Forward request to API Gateway or Ship2Primus - payload forwarded with enhancements
 */
async function callRatesAPI(requestBody: any): Promise<any> {
  // Check if API Gateway URL is configured (for backward compatibility with existing JS frontend)
  const apiGatewayUrl = process.env.API_GATEWAY_RATES_URL;
  const ship2PrimusUrl = process.env.SHIP2PRIMUS_RATES_URL;

  const apiUrl = apiGatewayUrl || ship2PrimusUrl;

  if (!apiUrl) {
    // Mock response for development - matching existing JS response format
    console.warn('API_GATEWAY_RATES_URL or SHIP2PRIMUS_RATES_URL not configured, returning mock data');
    return {
      rates: [
        {
          id: 'mock-rate-1',
          rateId: 'mock-rate-1',
          carrier: 'FedEx',
          carrierName: 'FedEx',
          service: 'Ground',
          serviceName: 'Ground',
          serviceLevel: 'Ground',
          transitDays: 3,
          total: 45.99,
          totalCost: 45.99,
          cost: 45.99,
          currency: 'USD',
        },
        {
          id: 'mock-rate-2',
          rateId: 'mock-rate-2',
          carrier: 'UPS',
          carrierName: 'UPS',
          service: 'Standard',
          serviceName: 'Standard',
          serviceLevel: 'Standard',
          transitDays: 2,
          total: 52.50,
          totalCost: 52.50,
          cost: 52.50,
          currency: 'USD',
        },
        {
          id: 'mock-rate-3',
          rateId: 'mock-rate-3',
          carrier: 'USPS',
          carrierName: 'USPS',
          service: 'Priority Mail',
          serviceName: 'Priority Mail',
          serviceLevel: 'Priority Mail',
          transitDays: 1,
          total: 38.75,
          totalCost: 38.75,
          cost: 38.75,
          currency: 'USD',
        },
      ],
    };
  }

  try {
    // Enhance request body with Lambda-style logic:
    // - Use defaultCity/defaultState if city/state missing (matching Lambda)
    // - Build freight info with auto-calculated freight class
    const enhancedBody = {
      ...requestBody,
      originCity: requestBody.originCity || 'defaultCity',
      originState: requestBody.originState || 'defaultState',
      destinationCity: requestBody.destinationCity || 'defaultCity',
      destinationState: requestBody.destinationState || 'defaultState',
      freightInfo: buildFreightInfo(requestBody.freightInfo || []),
    };

    // Use API Gateway if configured, otherwise use Ship2Primus client (which handles auth)
    if (apiGatewayUrl) {
      const apiKey = process.env.PROXY_API_KEY;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && { 'Authorization': `Bearer ${apiKey}` }),
        },
        body: JSON.stringify(enhancedBody),
      });

      if (!response.ok) {
        throw new Error(`API Gateway returned ${response.status}`);
      }

      const data = await response.json() as any;
      // Handle Lambda-style response format: data.results.rates
      const rates = data?.data?.results?.rates;
      if (rates) {
        return { rates };
      }
      return data;
    } else {
      // Use Ship2Primus client (handles authentication automatically)
      const data = await ship2PrimusRequest<any>(apiUrl, {
        method: 'POST',
        body: JSON.stringify(enhancedBody),
      });
      // Handle Ship2Primus response format
      const rates = data?.data?.results?.rates;
      if (rates) {
        return { rates };
      }
      return data;
    }
  } catch (error: any) {
    console.error('[RATES] API error:', error);
    throw error;
  }
}

async function createHubSpotNote(contactEmail: string, rates: NormalizedRate[], dealId?: string) {
  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!accessToken) {
    return; // Skip if not configured
  }

  try {
    // Find contact by email
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
      console.warn('HubSpot contact search failed');
      return;
    }

    const searchData = await searchResponse.json() as any;
    if (!searchData.results || searchData.results.length === 0) {
      return; // Contact not found
    }

    const contactId = searchData.results[0].id;
    const topRates = rates.slice(0, 3).map(r => 
      `${r.carrierName} ${r.serviceName}: $${r.totalCost.toFixed(2)} (${r.transitDays || 'N/A'} days)`
    ).join('\n');

    const noteBody = `Shipping Rate Request\n\nTop 3 Rates:\n${topRates}`;

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
    console.error('HubSpot note creation error:', error);
    // Don't fail the request if HubSpot fails
  }
}

// POST /api/rates
// Accepts exact payload structure from existing JavaScript frontend and forwards unchanged
router.post('/rates', authenticateToken, validateBody(rateRequestSchema), async (req: AuthRequest, res) => {
  const requestId = crypto.randomUUID();
  
  try {
    const userId = req.user!.userId;
    const clientId = req.user!.clientId;
    // Request body matches exact structure from existing JS: originCity, originState, freightInfo, etc.
    const requestPayload = req.body;

    // Forward request to API Gateway or Ship2Primus - payload forwarded UNCHANGED (per requirements)
    let apiResponse: any;
    try {
      apiResponse = await callRatesAPI(requestPayload);
    } catch (error: any) {
      console.error('[RATES] Upstream API error:', error);
      return res.status(502).json({
        requestId,
        errorCode: 'UPSTREAM_ERROR',
        message: 'Failed to fetch rates from shipping provider',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }

    // Extract rates from response - handle different possible response formats
    // Lambda returns: { rates: [...] } or { data: { results: { rates: [...] } } }
    let rates: any[] = [];
    if (Array.isArray(apiResponse.rates)) {
      rates = apiResponse.rates;
    } else if (apiResponse?.data?.results?.rates && Array.isArray(apiResponse.data.results.rates)) {
      rates = apiResponse.data.results.rates;
    } else if (Array.isArray(apiResponse)) {
      rates = apiResponse;
    } else if (apiResponse.rate) {
      rates = [apiResponse.rate];
    }
    
    // Filter out empty rate errors (matching Lambda behavior)
    rates = rates.filter((r: any) => !(r?.error && String(r.error).includes('Empty rate')));

    // Honor backend no-rates message (matching Lambda behavior)
    if (!rates || rates.length === 0) {
      const rateTypes = requestPayload.rateTypesList || [];
      const userMessage = apiResponse.userMessage || apiResponse.message || 
        (rateTypes.length 
          ? `No ${rateTypes.join(', ')} rates were found for your request. Please adjust your mode or shipment details and try again.`
          : 'No rates were found for your request. Please adjust your shipment details and try again.');
      
      return res.json({
        requestId,
        outcome: 'NO_RATES',
        userMessage,
        selectedModes: rateTypes,
        rates: [],
      });
    }

    // Sort rates cheapest first (matching Lambda behavior)
    rates.sort((a, b) => (a.total ?? a.totalCost ?? Infinity) - (b.total ?? b.totalCost ?? Infinity));

    // Save quote request and rates to database (optional - for tracking)
    try {
      const { data: quoteRequest, error: quoteError } = await supabaseAdmin
        .from('quote_requests')
        .insert({
          client_id: clientId,
          user_id: userId,
          request_payload_json: requestPayload as any,
        })
        .select('id')
        .single();

      if (!quoteError && quoteRequest) {
        // Save rates to database
        const ratesToInsert = rates.map((rate: any) => ({
          quote_request_id: quoteRequest.id,
          rate_id: rate.id || rate.rateId || rate.rate_id || crypto.randomUUID(),
          carrier_name: rate.carrier || rate.carrierName || rate.carrier_name || 'Unknown',
          service_name: rate.service || rate.serviceName || rate.service_name || rate.serviceLevel || 'Standard',
          transit_days: rate.transitDays || rate.transit_days || null,
          total_cost: rate.total || rate.totalCost || rate.total_cost || rate.cost || 0,
          currency: rate.currency || 'USD',
          raw_json: rate as any,
        }));

        await supabaseAdmin.from('rates').insert(ratesToInsert);

        // Audit log
        await supabaseAdmin.from('audit_logs').insert({
          client_id: clientId,
          user_id: userId,
          action: 'GET_RATES',
          metadata_json: {
            quoteRequestId: quoteRequest.id,
            ratesCount: rates.length,
          },
        });
      }
    } catch (dbError) {
      // Don't fail the request if database save fails - just log it
      console.warn('[RATES] Database save failed (non-critical):', dbError);
    }

    // Return response matching existing JS expected format
    res.json({
      requestId,
      rates: rates.map((rate: any) => ({
        id: rate.id || rate.rateId || rate.rate_id,
        rateId: rate.id || rate.rateId || rate.rate_id,
        carrierName: rate.carrier || rate.carrierName || rate.carrier_name,
        serviceName: rate.service || rate.serviceName || rate.service_name || rate.serviceLevel,
        serviceLevel: rate.serviceLevel || rate.service || rate.serviceName || rate.service_name,
        transitDays: rate.transitDays || rate.transit_days,
        total: rate.total || rate.totalCost || rate.total_cost || rate.cost,
        totalCost: rate.total || rate.totalCost || rate.total_cost || rate.cost,
        currency: rate.currency || 'USD',
        iconUrl: rate.iconUrl || rate.icon_url,
      })),
    });
  } catch (error: any) {
    console.error('[RATES] Endpoint error:', error);
    res.status(500).json({
      requestId,
      errorCode: 'INTERNAL_ERROR',
      message: 'Failed to process rates request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

export default router;
