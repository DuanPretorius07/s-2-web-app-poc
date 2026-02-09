import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabaseClient.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { NormalizedRate } from '../types.js';
import { getShip2PrimusToken, ship2PrimusRequest } from '../lib/ship2primusClient.js';

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
  // Prefer direct Ship2Primus URL; fall back to legacy API Gateway only if Ship2Primus is not configured
  const apiGatewayUrl = process.env.API_GATEWAY_RATES_URL;
  const ship2PrimusUrl = process.env.SHIP2PRIMUS_RATES_URL;

  const apiUrl = ship2PrimusUrl || apiGatewayUrl;

  if (!apiUrl) {
    // Mock response for development - matching existing JS response format
    console.warn('[RATES] API urls not configured; returning mock data (no Ship2Primus call).');
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

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        sessionId:'debug-session',
        runId:'pre-fix',
        hypothesisId:'H-AUTH-VENDOR-RATETYPES',
        location:'rates.ts:callRatesAPI:entry',
        message:'callRatesAPI enhancedBody summary',
        data:{
          hasVendorIdList:Array.isArray((requestBody as any)?.vendorIdList) && (requestBody as any).vendorIdList.length>0,
          vendorIdListLength:Array.isArray((requestBody as any)?.vendorIdList)?(requestBody as any).vendorIdList.length:null,
          rateTypesListLength:Array.isArray((requestBody as any)?.rateTypesList)?(requestBody as any).rateTypesList.length:null,
          hasFreightInfo:Array.isArray((requestBody as any)?.freightInfo),
          ship2PrimusUrlConfigured:!!process.env.SHIP2PRIMUS_RATES_URL
        },
        timestamp:Date.now()
      })
    }).catch(()=>{});
    // #endregion

    // Use Ship2Primus client if configured, otherwise fall back to legacy API Gateway
    if (ship2PrimusUrl) {
      console.log('[RATES] Calling Ship2Primus directly:', {
        url: ship2PrimusUrl,
      });

      // Ship2Primus /applet/v1/rate/multiple expects a GET with querystring params,
      // not a JSON POST body. Build the querystring similarly to the original Lambda.
      const { freightInfo, rateTypesList, ...rest } = enhancedBody as any;

      const qs = new URLSearchParams();
      // Basic scalar fields
      Object.entries(rest).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        qs.set(key, String(value));
      });
      // Freight info as JSON string
      if (freightInfo) {
        qs.set('freightInfo', JSON.stringify(freightInfo));
      }
      // Rate types list as repeated params: rateTypesList[]=LTL&rateTypesList[]=SP
      if (Array.isArray(rateTypesList)) {
        rateTypesList.forEach((rt: string) => {
          if (rt) qs.append('rateTypesList[]', rt);
        });
      }

      const urlWithQuery =
        ship2PrimusUrl.includes('?')
          ? `${ship2PrimusUrl}&${qs.toString()}`
          : `${ship2PrimusUrl}?${qs.toString()}`;

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          sessionId:'debug-session',
          runId:'pre-fix',
          hypothesisId:'H-VENDOR-QUERYSTRING',
          location:'rates.ts:callRatesAPI:Ship2PrimusURL',
          message:'Ship2Primus GET URL + query characteristics',
          data:{
            urlLength:urlWithQuery.length,
            hasVendorIdListParam:qs.has('vendorIdList[]'),
            rateTypesListParamCount:qs.getAll('rateTypesList[]').length,
            hasFreightInfoParam:qs.has('freightInfo')
          },
          timestamp:Date.now()
        })
      }).catch(()=>{});
      // #endregion

      const data = await ship2PrimusRequest<any>(urlWithQuery, {
        method: 'GET',
      });

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          sessionId:'debug-session',
          runId:'rates-ship2primus',
          hypothesisId:'H1',
          location:'rates.ts:callRatesAPI:Ship2Primus',
          message:'Ship2Primus raw response meta',
          data:{
            hasData: !!data,
            topLevelKeys: data ? Object.keys(data) : [],
            hasNestedData: !!(data as any)?.data,
            hasResults: !!(data as any)?.data?.results,
            ratesLength: Array.isArray((data as any)?.data?.results?.rates) ? (data as any).data.results.rates.length : null
          },
          timestamp:Date.now()
        })
      }).catch(()=>{});
      // #endregion

      // Handle Ship2Primus response format
      const rates = data?.data?.results?.rates;
      if (rates) {
        return { rates };
      }
      return data;
    } else if (apiGatewayUrl) {
      console.log('[RATES] Calling legacy API Gateway proxy for rates:', {
        url: apiGatewayUrl,
      });
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

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        sessionId:'debug-session',
        runId:'pre-fix',
        hypothesisId:'H-SOCKET-ERROR',
        location:'rates.ts:callRatesAPI:catch',
        message:'callRatesAPI caught error',
        data:{
          name:error?.name || null,
          code:error?.code || error?.cause?.code || null,
          message:error?.message || null
        },
        timestamp:Date.now()
      })
    }).catch(()=>{});
    // #endregion

    throw error;
  }
}

/**
 * Upsert (create or update) a HubSpot contact record when the user has opted in.
 * - Uses email as the unique key
 * - Never blocks the main flow; all errors are logged and swallowed
 */
async function upsertHubSpotContactIfOptedIn(user: {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  hubspot_opt_in?: boolean | null;
}) {
  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      sessionId:'debug-session',
      runId:'hubspot-pre',
      hypothesisId:'H-HUBSPOT-CONDITION',
      location:'rates.ts:upsertHubSpotContactIfOptedIn:entry',
      message:'HubSpot upsert helper invoked',
      data:{
        hasToken:!!accessToken,
        hubspotOptIn:!!user?.hubspot_opt_in,
        hasEmail:!!user?.email
      },
      timestamp:Date.now()
    })
  }).catch(()=>{});
  // #endregion

  // If HubSpot is not configured or user has not opted in, do nothing
  if (!accessToken || !user?.hubspot_opt_in) {
    return;
  }

  const email = user.email;
  const firstName = user.first_name || undefined;
  const lastName = user.last_name || undefined;

  if (!email) {
    console.warn('[HUBSPOT] Skipping contact upsert: missing email');
    return;
  }

  try {
    // STEP 1: Search for existing contact by email
    const searchResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'email',
                operator: 'EQ',
                value: email,
              },
            ],
          },
        ],
      }),
    });

    if (!searchResponse.ok) {
      console.warn('[HUBSPOT] Contact search failed', { status: searchResponse.status });
      return;
    }

    const searchData = await searchResponse.json() as any;
    const existingContact = Array.isArray(searchData.results) && searchData.results.length > 0
      ? searchData.results[0]
      : null;

    const baseProperties: Record<string, string> = {
      email,
    };
    if (firstName) baseProperties.firstname = firstName;
    if (lastName) baseProperties.lastname = lastName;

    // STEP 2: Update existing contact or create new one
    if (existingContact) {
      const contactId = existingContact.id;
      await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ properties: baseProperties }),
      });
    } else {
      await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ properties: baseProperties }),
      });
    }
  } catch (error) {
    // HubSpot failures must never block rates; log and continue
    console.error('[HUBSPOT] Contact upsert error (non-blocking):', error);
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

    // Load user and client metadata needed for HubSpot and rate token enforcement
    let dbUser: any = null;
    let clientMeta: any = null;
    try {
      const [{ data: userRow, error: userError }, { data: clientRow, error: clientError }] = await Promise.all([
        supabaseAdmin
          .from('users')
          .select('id, email, first_name, last_name, hubspot_opt_in')
          .eq('id', userId)
          .single(),
        supabaseAdmin
          .from('clients')
          .select('id, rate_tokens_remaining, rate_tokens_used')
          .eq('id', clientId)
          .single(),
      ]);

      if (userError) {
        console.warn('[RATES] Failed to load user metadata for HubSpot', { userId, error: userError.message });
      } else {
        dbUser = userRow;
      }

      if (clientError) {
        console.warn('[RATES] Failed to load client token metadata', { clientId, error: clientError.message });
      } else {
        clientMeta = clientRow;
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          sessionId:'debug-session',
          runId:'hubspot-pre',
          hypothesisId:'H-HUBSPOT-META',
          location:'rates.ts:/rates:metaLoaded',
          message:'Loaded user/client metadata for HubSpot + tokens',
          data:{
            hasDbUser:!!dbUser,
            hubspotOptIn:dbUser?.hubspot_opt_in ?? null,
            hasClientMeta:!!clientMeta,
            rateTokensRemaining:clientMeta?.rate_tokens_remaining ?? null,
            rateTokensUsed:clientMeta?.rate_tokens_used ?? null
          },
          timestamp:Date.now()
        })
      }).catch(()=>{});
      // #endregion
    } catch (metaError) {
      console.warn('[RATES] Metadata preload failed (non-critical):', metaError);
    }

    // Enforce token-based rate search limit strictly from the backend
    const configuredRemaining =
      typeof clientMeta?.rate_tokens_remaining === 'number'
        ? clientMeta.rate_tokens_remaining
        : 3; // default starting allowance when column is unset

    if (configuredRemaining <= 0) {
      return res.status(403).json({
        requestId,
        errorCode: 'RATE_LIMIT_REACHED',
        message: 'You have used all 3 rate searches. Please contact Ship2Primus directly.',
      });
    }

    console.log('[RATES] Incoming request', {
      requestId,
      userId,
      clientId,
      originZipcode: requestPayload.originZipcode,
      destinationZipcode: requestPayload.destinationZipcode,
      pickupDate: requestPayload.pickupDate,
      modes: requestPayload.rateTypesList,
    });

    // Forward request to Ship2Primus (or legacy proxy) - payload forwarded UNCHANGED (per requirements)
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

    // At this point we have at least one valid rate; consume exactly one token atomically.
    // This uses a Postgres function (consume_rate_token) for strict, server-enforced limits.
    let rateTokensRemaining: number | null = null;
    let rateTokensUsed: number | null = null;
    try {
      const { data: tokenResult, error: tokenError } = await supabaseAdmin
        .rpc('consume_rate_token', { p_client_id: clientId });

      if (tokenError) {
        console.warn('[RATES] Failed to consume rate token (non-blocking):', tokenError.message);
      } else if (tokenResult) {
        rateTokensRemaining = (tokenResult as any).rate_tokens_remaining ?? null;
        rateTokensUsed = (tokenResult as any).rate_tokens_used ?? null;
      }
    } catch (tokenRpcError) {
      console.warn('[RATES] Token RPC error (non-blocking):', tokenRpcError);
    }

    // Fire HubSpot contact upsert for opted-in users; never block the response
    if (dbUser) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          sessionId:'debug-session',
          runId:'hubspot-pre',
          hypothesisId:'H-HUBSPOT-INVOKE',
          location:'rates.ts:/rates:invokeUpsert',
          message:'Invoking HubSpot upsert after successful rates',
          data:{
            hasDbUser:true,
            hubspotOptIn:dbUser?.hubspot_opt_in ?? null,
            hasToken:!!process.env.HUBSPOT_ACCESS_TOKEN
          },
          timestamp:Date.now()
        })
      }).catch(()=>{});
      // #endregion

      // Intentionally not awaited with try/catch here, as upsertHubSpotContactIfOptedIn
      // already encapsulates its own error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      upsertHubSpotContactIfOptedIn(dbUser);
    }

    // Sort rates cheapest first (matching Lambda behavior)
    rates.sort((a, b) => (a.total ?? a.totalCost ?? Infinity) - (b.total ?? b.totalCost ?? Infinity));

    // Save quote request and rates to database (optional - for tracking)
    let quoteId: string | null = null;
    const rateIdMap = new Map<string, string>(); // Map external rate_id to database id
    
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
        quoteId = quoteRequest.id;
        
        // Save rates to database - use same normalization logic
        const ratesToInsert = rates.map((rate: any) => {
          const carrierName = rate.name || 
                             rate.carrierName || 
                             rate.carrier_name || 
                             rate.carrier || 
                             rate.companyName || 
                             rate.company_name ||
                             rate.company ||
                             rate.provider ||
                             rate.providerName ||
                             'Unknown';

          const serviceName = rate.serviceName || 
                             rate.service_name || 
                             rate.service || 
                             rate.serviceLevel || 
                             rate.service_level ||
                             rate.serviceType ||
                             'Standard';

          const externalRateId = rate.id || rate.rateId || rate.rate_id || crypto.randomUUID();

          return {
            quote_request_id: quoteRequest.id,
            rate_id: externalRateId,
            carrier_name: carrierName,
            service_name: serviceName,
            transit_days: rate.transitDays || rate.transit_days || rate.transitTime || rate.transit_time || null,
            total_cost: rate.total || rate.totalCost || rate.total_cost || rate.cost || rate.price || rate.amount || 0,
            currency: rate.currency || rate.currencyCode || 'USD',
            raw_json: rate as any,
          };
        });

        const { data: insertedRates, error: insertError } = await supabaseAdmin
          .from('rates')
          .insert(ratesToInsert)
          .select('id, rate_id');

        if (!insertError && insertedRates) {
          // Create a map of external rate_id to database id for frontend
          insertedRates.forEach((dbRate: any) => {
            if (dbRate.rate_id) {
              rateIdMap.set(dbRate.rate_id, dbRate.id);
            }
          });
        }

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

    // Normalize rates - extract carrier name from various possible fields
    // Log first rate structure for debugging (only in development)
    if (process.env.NODE_ENV === 'development' && rates.length > 0) {
      console.log('[RATES] Sample rate structure:', JSON.stringify(rates[0], null, 2));
    }

    // Return response matching existing JS expected format, with additional token metadata
    res.json({
      requestId,
      quoteId: quoteId || undefined, // Include quoteId if available for booking
      rateTokensRemaining,
      rateTokensUsed,
      rates: rates.map((rate: any) => {
        // Extract carrier name - check multiple possible field names
        // Priority: name > carrierName > carrier_name > carrier > companyName > company
        const carrierName = rate.name || 
                            rate.carrierName || 
                            rate.carrier_name || 
                            rate.carrier || 
                            rate.companyName || 
                            rate.company_name ||
                            rate.company ||
                            rate.provider ||
                            rate.providerName ||
                            null;

        // Extract service name
        const serviceName = rate.serviceName || 
                           rate.service_name || 
                           rate.service || 
                           rate.serviceLevel || 
                           rate.service_level ||
                           rate.serviceType ||
                           null;

        // Extract cost
        const totalCost = rate.total || 
                         rate.totalCost || 
                         rate.total_cost || 
                         rate.cost || 
                         rate.price ||
                         rate.amount ||
                         0;

        // Extract transit days
        const transitDays = rate.transitDays || 
                           rate.transit_days || 
                           rate.transitTime || 
                           rate.transit_time ||
                           rate.deliveryDays ||
                           rate.delivery_days ||
                           null;

        const externalRateId = rate.id || rate.rateId || rate.rate_id || crypto.randomUUID();
        const dbRateId = rateIdMap.get(externalRateId) || null; // Database ID for booking
        
        return {
          id: externalRateId, // External rate ID
          rateId: externalRateId, // External rate ID (backward compatibility)
          dbId: dbRateId, // Database ID for booking (use this as selectedRateId)
          name: carrierName || 'Unknown', // Internal variable should be 'name' per requirements
          carrierName: carrierName || 'Unknown', // Keep for backward compatibility
          serviceName: serviceName || 'Standard',
          serviceLevel: rate.serviceLevel || rate.service_level || serviceName || 'Standard',
          transitDays: transitDays,
          total: totalCost,
          totalCost: totalCost,
          cost: totalCost,
          currency: rate.currency || rate.currencyCode || 'USD',
          iconUrl: rate.iconUrl || rate.icon_url || rate.logoUrl || rate.logo_url,
          rawJson: rate, // Include raw data for debugging
        };
      }),
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
