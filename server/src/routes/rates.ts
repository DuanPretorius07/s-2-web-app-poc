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
    // - Use defaultCity/defaultState if city/state missing (API REQUIRES these parameters)
    // - Build freight info with auto-calculated freight class
    // Note: API requires city/state parameters, but using placeholders may result in 0 rates
    // TODO: Consider adding ZIP code lookup to get real city/state values
    const enhancedBody = {
      ...requestBody,
      originCity: requestBody.originCity && requestBody.originCity.trim() !== '' ? requestBody.originCity.trim() : 'defaultCity',
      originState: requestBody.originState && requestBody.originState.trim() !== '' ? requestBody.originState.trim() : 'defaultState',
      destinationCity: requestBody.destinationCity && requestBody.destinationCity.trim() !== '' ? requestBody.destinationCity.trim() : 'defaultCity',
      destinationState: requestBody.destinationState && requestBody.destinationState.trim() !== '' ? requestBody.destinationState.trim() : 'defaultState',
      freightInfo: buildFreightInfo(requestBody.freightInfo || []),
    };

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'rates.ts:callRatesAPI:enhancedBody',message:'Enhanced body created',data:{originCity:enhancedBody.originCity,originState:enhancedBody.originState,destinationCity:enhancedBody.destinationCity,destinationState:enhancedBody.destinationState,originZipcode:enhancedBody.originZipcode,destinationZipcode:enhancedBody.destinationZipcode,hasFreightInfo:Array.isArray(enhancedBody.freightInfo),freightInfoLength:Array.isArray(enhancedBody.freightInfo)?enhancedBody.freightInfo.length:0},timestamp:Date.now(),runId:'debug-ship2primus',hypothesisId:'H2,H4'})}).catch(()=>{});
    // #endregion

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

      // OPTIMIZATION: Batch rate types into smaller groups and run in parallel for better performance
      // This reduces the number of concurrent requests while still parallelizing
      const { freightInfo, rateTypesList, ...rest } = enhancedBody as any;
      const rateTypes = Array.isArray(rateTypesList) && rateTypesList.length > 0 ? rateTypesList : ['LTL'];
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'rates.ts:callRatesAPI:strategy',message:'Rate fetching strategy',data:{rateTypesCount:rateTypes.length,rateTypes:rateTypes,willBatch:rateTypes.length>3},timestamp:Date.now(),runId:'timeout-debug',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion

      // If multiple rate types, batch them into groups and run batches in parallel
      // Batch size: 3 rate types per batch (optimal balance between parallelism and API load)
      const BATCH_SIZE = 3;
      if (rateTypes.length > 1) {
        console.log(`[RATES] Processing ${rateTypes.length} rate types with batching (batch size: ${BATCH_SIZE})`);
        
        // Create batches
        const batches: string[][] = [];
        for (let i = 0; i < rateTypes.length; i += BATCH_SIZE) {
          batches.push(rateTypes.slice(i, i + BATCH_SIZE));
        }
        
        console.log(`[RATES] Split into ${batches.length} batches:`, batches.map(b => b.join(', ')));
        
        // Process each batch (batches run sequentially, but rate types within batch run in parallel)
        const allRates: any[] = [];
        const overallStartTime = Date.now();
        
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          console.log(`[RATES] Processing batch ${batchIndex + 1}/${batches.length} with rate types: ${batch.join(', ')}`);
          
          const batchStartTime = Date.now();
          const apiCallPromises = batch.map(async (rateType: string) => {
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
          // Single rate type per request
          qs.append('rateTypesList[]', rateType);

          const urlWithQuery =
            ship2PrimusUrl.includes('?')
              ? `${ship2PrimusUrl}&${qs.toString()}`
              : `${ship2PrimusUrl}?${qs.toString()}`;

            const startTime = Date.now();
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'rates.ts:callRatesAPI:parallelRequest',message:'Starting parallel request',data:{rateType:rateType,startTime:startTime},timestamp:Date.now(),runId:'timeout-debug',hypothesisId:'H1'})}).catch(()=>{});
            // #endregion

          try {
            // Only apply timeout in production (Vercel) - local dev has no timeout limit
            const isProduction = process.env.NODE_ENV === 'production' && process.env.VERCEL === '1';
            let response: any;
            
            if (isProduction) {
              // Production timeout: 28s per request (with parallelization, total should be < 30s)
              const timeoutMs = 28000;
              const timeoutPromise = new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error(`Ship2Primus API request timeout for ${rateType} after 28s`)), timeoutMs)
              );
              response = await Promise.race([
                ship2PrimusRequest<any>(urlWithQuery, { method: 'GET' }),
                timeoutPromise,
              ]);
            } else {
              // Local dev: no timeout
              response = await ship2PrimusRequest<any>(urlWithQuery, { method: 'GET' });
            }

            const duration = Date.now() - startTime;
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'rates.ts:callRatesAPI:parallelResponse',message:'Parallel request completed',data:{rateType:rateType,duration:duration,hasRates:!!response?.data?.results?.rates,ratesCount:Array.isArray(response?.data?.results?.rates)?response.data.results.rates.length:0},timestamp:Date.now(),runId:'timeout-debug',hypothesisId:'H1'})}).catch(()=>{});
            // #endregion

            console.log(`[RATES] Rate type ${rateType} completed in ${duration}ms`);
            return response;
          } catch (error: any) {
            const duration = Date.now() - startTime;
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'rates.ts:callRatesAPI:parallelError',message:'Parallel request failed',data:{rateType:rateType,duration:duration,errorMessage:error?.message},timestamp:Date.now(),runId:'timeout-debug',hypothesisId:'H1'})}).catch(()=>{});
            // #endregion
            console.warn(`[RATES] Rate type ${rateType} failed after ${duration}ms:`, error.message);
            // Return empty result for failed rate type (don't fail entire request)
            return { data: { results: { rates: [] } } };
          }
        });

          // Wait for all requests in this batch to complete
          const batchResponses = await Promise.all(apiCallPromises);
          const batchDuration = Date.now() - batchStartTime;
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'rates.ts:callRatesAPI:batchComplete',message:'Batch completed',data:{batchIndex:batchIndex+1,totalBatches:batches.length,batchDuration:batchDuration,responsesCount:batchResponses.length,successCount:batchResponses.filter(r=>r?.data?.results?.rates?.length>0).length},timestamp:Date.now(),runId:'timeout-debug',hypothesisId:'H1'})}).catch(()=>{});
          // #endregion

          console.log(`[RATES] Batch ${batchIndex + 1}/${batches.length} completed in ${batchDuration}ms`);
          
          // Combine rates from this batch
          batchResponses.forEach((response) => {
            const rates = response?.data?.results?.rates;
            if (Array.isArray(rates) && rates.length > 0) {
              allRates.push(...rates);
            }
          });
        }
        
        const totalDuration = Date.now() - overallStartTime;
        console.log(`[RATES] All ${batches.length} batches completed in ${totalDuration}ms. Combined ${allRates.length} rates from ${rateTypes.length} rate types`);
        return { rates: allRates };
      } else {
        // Single rate type - use original approach
        const qs = new URLSearchParams();
        Object.entries(rest).forEach(([key, value]) => {
          if (value === undefined || value === null) return;
          qs.set(key, String(value));
        });
        if (freightInfo) {
          qs.set('freightInfo', JSON.stringify(freightInfo));
        }
        if (Array.isArray(rateTypesList)) {
          rateTypesList.forEach((rt: string) => {
            if (rt) qs.append('rateTypesList[]', rt);
          });
        }

        const urlWithQuery =
          ship2PrimusUrl.includes('?')
            ? `${ship2PrimusUrl}&${qs.toString()}`
            : `${ship2PrimusUrl}?${qs.toString()}`;

        console.log('[RATES] Ship2Primus API call - URL:', urlWithQuery.substring(0, 200) + (urlWithQuery.length > 200 ? '...' : ''));
        console.log('[RATES] Ship2Primus API call - Request payload summary:', {
          originZipcode: enhancedBody.originZipcode,
          destinationZipcode: enhancedBody.destinationZipcode,
          pickupDate: enhancedBody.pickupDate,
          rateTypesList: enhancedBody.rateTypesList,
          freightInfoCount: Array.isArray(enhancedBody.freightInfo) ? enhancedBody.freightInfo.length : 0,
        });

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'rates.ts:callRatesAPI:beforeShip2PrimusRequest',message:'About to call ship2PrimusRequest (single)',data:{method:'GET',urlLength:urlWithQuery.length,rateTypesCount:rateTypesList?.length||1},timestamp:Date.now(),runId:'timeout-debug',hypothesisId:'H1'})}).catch(()=>{});
        // #endregion

        let data: any;
        try {
          // Only apply timeout in production (Vercel) - local dev has no timeout limit
          const isProduction = process.env.NODE_ENV === 'production' && process.env.VERCEL === '1';
          const startTime = Date.now();
          
          if (isProduction) {
            // Production timeout: 28s for single request
            const timeoutMs = 28000;
            const timeoutPromise = new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Ship2Primus API request timeout after 28s')), timeoutMs)
            );
            data = await Promise.race([
              ship2PrimusRequest<any>(urlWithQuery, {
                method: 'GET',
              }),
              timeoutPromise,
            ]);
          } else {
            // Local dev: no timeout
            data = await ship2PrimusRequest<any>(urlWithQuery, {
              method: 'GET',
            });
          }
          const duration = Date.now() - startTime;
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'rates.ts:callRatesAPI:singleRequestComplete',message:'Single request completed',data:{duration:duration,hasRates:!!data?.data?.results?.rates,ratesCount:Array.isArray(data?.data?.results?.rates)?data.data.results.rates.length:0},timestamp:Date.now(),runId:'timeout-debug',hypothesisId:'H1'})}).catch(()=>{});
          // #endregion
          console.log(`[RATES] Single request completed in ${duration}ms`);
          
          // Handle Ship2Primus response format
          const rates = data?.data?.results?.rates;
          if (rates) {
            console.log('[RATES] Ship2Primus returned', rates.length, 'rates');
            if (rates.length === 0) {
              console.warn('[RATES] Ship2Primus returned 0 rates. Possible causes: invalid placeholders (defaultCity/defaultState), no matching carriers, or invalid request parameters');
            }
            return { rates };
          }
          console.log('[RATES] Ship2Primus response format unexpected, returning full data');
          return data;
        } catch (error: any) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'rates.ts:callRatesAPI:singleRequestError',message:'Single request failed',data:{errorName:error?.name,errorMessage:error?.message,errorCode:error?.code},timestamp:Date.now(),runId:'timeout-debug',hypothesisId:'H1'})}).catch(()=>{});
          // #endregion
          throw error;
        }
      }
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

      console.log('[RATES] API Gateway response status:', response.status, response.statusText);
      const data = await response.json() as any;
      console.log('[RATES] API Gateway response data:', {
        hasData: !!data,
        topLevelKeys: data ? Object.keys(data) : [],
        ratesLength: Array.isArray(data?.data?.results?.rates) ? data.data.results.rates.length : null,
        fullResponse: process.env.NODE_ENV === 'development' ? JSON.stringify(data, null, 2).substring(0, 1000) : '[truncated in production]',
      });
      // Handle Lambda-style response format: data.results.rates
      const rates = data?.data?.results?.rates;
      if (rates) {
        console.log('[RATES] API Gateway returned', rates.length, 'rates');
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
  firstname?: string | null;
  lastname?: string | null;
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
  const firstName = user.firstname || undefined;
  const lastName = user.lastname || undefined;

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

async function createHubSpotNote(
  contactEmail: string,
  rates: NormalizedRate[],
  requestPayload: any,
  dealId?: string
) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'rates.ts:createHubSpotNote:entry',message:'createHubSpotNote called',data:{contactEmail,ratesCount:rates.length,hasDealId:!!dealId},timestamp:Date.now(),runId:'hubspot-debug',hypothesisId:'H4'})}).catch(()=>{});
  // #endregion
  
  const accessToken = process.env.HUBSPOT_PRIVATE_APP_TOKEN || process.env.HUBSPOT_ACCESS_TOKEN;
  if (!accessToken) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'rates.ts:createHubSpotNote:noToken',message:'No HubSpot token configured',data:{hasPrivateToken:!!process.env.HUBSPOT_PRIVATE_APP_TOKEN,hasAccessToken:!!process.env.HUBSPOT_ACCESS_TOKEN},timestamp:Date.now(),runId:'hubspot-debug',hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
    console.log('[HubSpot] Skipping note creation - no token configured');
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
      const errorText = await searchResponse.text();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'rates.ts:createHubSpotNote:searchFailed',message:'Contact search failed',data:{status:searchResponse.status,errorText:errorText.substring(0,200)},timestamp:Date.now(),runId:'hubspot-debug',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      console.warn('[HubSpot] Contact search failed:', searchResponse.status, errorText);
      return;
    }

    const searchData = await searchResponse.json() as any;
    if (!searchData.results || searchData.results.length === 0) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'rates.ts:createHubSpotNote:contactNotFound',message:'Contact not found',data:{contactEmail,searchDataKeys:Object.keys(searchData)},timestamp:Date.now(),runId:'hubspot-debug',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      console.log(`[HubSpot] Contact not found for email: ${contactEmail}`);
      return; // Contact not found
    }

    const contactId = searchData.results[0].id;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'rates.ts:createHubSpotNote:contactFound',message:'Contact found, creating note',data:{contactId,contactEmail},timestamp:Date.now(),runId:'hubspot-debug',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion

    // Build request summary (lane + key shipment inputs)
    const origin = `${requestPayload.originCity || ''}, ${requestPayload.originState || ''} ${requestPayload.originZipcode || ''}`.trim();
    const destination = `${requestPayload.destinationCity || ''}, ${requestPayload.destinationState || ''} ${requestPayload.destinationZipcode || ''}`.trim();
    const lane = `${origin} → ${destination}`;
    
    const freightInfo = requestPayload.freightInfo?.[0] || {};
    const shipmentDetails = [];
    if (freightInfo.weight) shipmentDetails.push(`Weight: ${freightInfo.weight} lbs`);
    if (freightInfo.length && freightInfo.width && freightInfo.height) {
      shipmentDetails.push(`Dimensions: ${freightInfo.length}" × ${freightInfo.width}" × ${freightInfo.height}"`);
    }
    if (freightInfo.qty || requestPayload.quantity) {
      shipmentDetails.push(`Quantity: ${freightInfo.qty || requestPayload.quantity}`);
    }
    if (freightInfo.dimType || requestPayload.packagingType) {
      shipmentDetails.push(`Packaging: ${freightInfo.dimType || requestPayload.packagingType}`);
    }

    // Get top 3 cheapest rates (already sorted)
    const top3Rates = rates.slice(0, 3).map((r, idx) => {
      const carrier = r.carrierName || 'Unknown';
      const service = r.serviceName || 'Standard';
      const price = r.totalCost?.toFixed(2) || '0.00';
      const transit = r.transitDays ? `${r.transitDays} day${r.transitDays === 1 ? '' : 's'}` : 'N/A';
      return `${idx + 1}. ${carrier} - ${service}: $${price} (${transit})`;
    });

    // Build formatted note body with proper styling
    const noteBody = `📦 Shipping Rate Request

📍 Lane: ${lane}

📋 Shipment Details:
${shipmentDetails.map(detail => `   • ${detail}`).join('\n')}

💰 Top 3 Options:
${top3Rates.map(rate => `   ${rate}`).join('\n')}`;

    // Build note payload according to HubSpot API structure
    // Note: hs_activity_type is NOT a valid property for Notes objects
    const notePayload: any = {
      properties: {
        hs_note_body: noteBody,
        hs_timestamp: new Date().toISOString(),
      },
      associations: [
        {
          to: { id: contactId },
          types: [{
            associationCategory: 'HUBSPOT_DEFINED',
            associationTypeId: 202, // Note to Contact association (202, not 214)
          }],
        },
      ],
    };

    // Add deal association if provided
    if (dealId) {
      notePayload.associations.push({
        to: { id: dealId },
        types: [{
          associationCategory: 'HUBSPOT_DEFINED',
          associationTypeId: 214, // Note to Deal association (214 is correct for deals)
        }],
      });
    }

    const noteResponse = await fetch('https://api.hubapi.com/crm/v3/objects/notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(notePayload),
    });

    if (!noteResponse.ok) {
      const errorText = await noteResponse.text();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'rates.ts:createHubSpotNote:noteFailed',message:'Note creation API failed',data:{status:noteResponse.status,errorText:errorText.substring(0,500),notePayloadKeys:Object.keys(notePayload)},timestamp:Date.now(),runId:'hubspot-debug',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      console.error('[HubSpot] Note creation failed:', noteResponse.status, errorText);
      return;
    }

    const noteResult = await noteResponse.json() as { id?: string };
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'rates.ts:createHubSpotNote:success',message:'Note created successfully',data:{contactId,noteId:noteResult.id},timestamp:Date.now(),runId:'hubspot-debug',hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    console.log(`[HubSpot] ✅ Note created successfully for contact ${contactId}:`, noteResult.id);
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'rates.ts:createHubSpotNote:exception',message:'Exception in createHubSpotNote',data:{errorMessage:error instanceof Error?error.message:String(error),errorName:error instanceof Error?error.name:'Unknown'},timestamp:Date.now(),runId:'hubspot-debug',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    console.error('[HubSpot] Note creation error:', error);
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
          .select('id, email, firstname, lastname, hubspot_opt_in')
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

    console.log('[RATES] Processing API response:', {
      hasRates: !!apiResponse.rates,
      ratesIsArray: Array.isArray(apiResponse.rates),
      hasDataResults: !!apiResponse?.data?.results?.rates,
      dataResultsIsArray: Array.isArray(apiResponse?.data?.results?.rates),
      apiResponseIsArray: Array.isArray(apiResponse),
      hasRate: !!apiResponse.rate,
      topLevelKeys: apiResponse ? Object.keys(apiResponse) : [],
    });

    // Extract rates from response - handle different possible response formats
    // Lambda returns: { rates: [...] } or { data: { results: { rates: [...] } } }
    let rates: any[] = [];
    if (Array.isArray(apiResponse.rates)) {
      rates = apiResponse.rates;
      console.log('[RATES] Extracted rates from apiResponse.rates:', rates.length);
    } else if (apiResponse?.data?.results?.rates && Array.isArray(apiResponse.data.results.rates)) {
      rates = apiResponse.data.results.rates;
      console.log('[RATES] Extracted rates from apiResponse.data.results.rates:', rates.length);
    } else if (Array.isArray(apiResponse)) {
      rates = apiResponse;
      console.log('[RATES] Extracted rates from apiResponse (array):', rates.length);
    } else if (apiResponse.rate) {
      rates = [apiResponse.rate];
      console.log('[RATES] Extracted single rate from apiResponse.rate');
    } else {
      console.warn('[RATES] No rates found in API response. Full response:', JSON.stringify(apiResponse, null, 2).substring(0, 500));
    }
    
    // Filter out empty rate errors (matching Lambda behavior)
    const beforeFilter = rates.length;
    rates = rates.filter((r: any) => !(r?.error && String(r.error).includes('Empty rate')));
    if (beforeFilter !== rates.length) {
      console.log(`[RATES] Filtered out ${beforeFilter - rates.length} empty rate errors`);
    }

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

    // Sort rates cheapest first (matching Lambda behavior) - do this early
    rates.sort((a, b) => (a.total ?? a.totalCost ?? Infinity) - (b.total ?? b.totalCost ?? Infinity));

    // OPTIMIZATION: Start all non-critical operations in parallel, don't await them
    // This prevents timeout issues when dealing with large rate responses
    
    // 1. Consume rate token (critical - must complete before response)
    let rateTokensRemaining: number | null = null;
    let rateTokensUsed: number | null = null;
    const tokenPromise = (async () => {
      try {
        const { data: tokenResult, error: tokenError } = await supabaseAdmin
          .rpc('consume_rate_token', { p_client_id: clientId });
        if (tokenError) {
          console.warn('[RATES] Failed to consume rate token (non-blocking):', tokenError.message);
        } else if (tokenResult) {
          rateTokensRemaining = (tokenResult as any).rate_tokens_remaining ?? null;
          rateTokensUsed = (tokenResult as any).rate_tokens_used ?? null;
        }
      } catch (tokenRpcError: any) {
        console.warn('[RATES] Token RPC error (non-blocking):', tokenRpcError);
      }
    })();

    // 2. Save to database (non-critical - runs in background, doesn't block response)
    // Use a shared object to store quoteId so it's available for response
    const dbState: { quoteId: string | null; rateIdMap: Map<string, string> } = {
      quoteId: null,
      rateIdMap: new Map<string, string>(),
    };
    
    const dbPromise = (async () => {
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
          dbState.quoteId = quoteRequest.id;
          
          // Prepare rates for insertion
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

          // OPTIMIZATION: For large rate sets, batch inserts
          const BATCH_SIZE = 50;
          if (ratesToInsert.length > BATCH_SIZE) {
            console.log(`[RATES] Batching ${ratesToInsert.length} rates into chunks of ${BATCH_SIZE}`);
            const batches = [];
            for (let i = 0; i < ratesToInsert.length; i += BATCH_SIZE) {
              batches.push(ratesToInsert.slice(i, i + BATCH_SIZE));
            }
            
            // Insert batches in parallel
            const insertPromises = batches.map(batch =>
              supabaseAdmin.from('rates').insert(batch).select('id, rate_id')
            );
            
            const results = await Promise.all(insertPromises);
            results.forEach(({ data: insertedRates }) => {
              if (insertedRates) {
                insertedRates.forEach((dbRate: any) => {
                  if (dbRate.rate_id) {
                    dbState.rateIdMap.set(dbRate.rate_id, dbRate.id);
                  }
                });
              }
            });
          } else {
            // Small batch - single insert
            const { data: insertedRates, error: insertError } = await supabaseAdmin
              .from('rates')
              .insert(ratesToInsert)
              .select('id, rate_id');

            if (!insertError && insertedRates) {
              insertedRates.forEach((dbRate: any) => {
                if (dbRate.rate_id) {
                  dbState.rateIdMap.set(dbRate.rate_id, dbRate.id);
                }
              });
            }
          }

          // Audit log (non-blocking)
          (async () => {
            try {
              await supabaseAdmin.from('audit_logs').insert({
                client_id: clientId,
                user_id: userId,
                action: 'GET_RATES',
                metadata_json: {
                  quoteRequestId: quoteRequest.id,
                  ratesCount: rates.length,
                },
              });
            } catch (err: any) {
              console.warn('[RATES] Audit log failed:', err);
            }
          })();
        }
      } catch (dbError) {
        console.warn('[RATES] Database save failed (non-critical):', dbError);
      }
    })();

    // 3. HubSpot operations (completely non-blocking)
    if (dbUser) {
      // On Vercel, ensure the promise is tracked so it completes before function termination
      const contactPromise = upsertHubSpotContactIfOptedIn(dbUser).catch((err) => {
        console.error('[RATES] HubSpot contact upsert error:', err);
      });
      
      // On Vercel, track the promise to ensure it completes
      if (process.env.VERCEL === '1') {
        // Give HubSpot call time to complete (max 5 seconds)
        Promise.race([
          contactPromise,
          new Promise(resolve => setTimeout(resolve, 5000)),
        ]).catch(() => {});
      }
    }

    // Wait for critical operations (token consumption) before responding
    // Don't wait for DB save - it's non-critical
    await tokenPromise;

    // Normalize rates - extract carrier name from various possible fields
    // Log first rate structure for debugging (only in development)
    if (process.env.NODE_ENV === 'development' && rates.length > 0) {
      console.log('[RATES] Sample rate structure:', JSON.stringify(rates[0], null, 2));
    }

    // Create HubSpot note if user exists and rates are available
    if (dbUser?.email && rates.length > 0) {
      // Normalize rates for HubSpot note
      const normalizedRates: NormalizedRate[] = rates.map((rate: any) => {
        const carrierName = rate.name || 
                           rate.carrierName || 
                           rate.carrier_name || 
                           rate.carrier || 
                           'Unknown';
        const serviceName = rate.serviceName || 
                           rate.service_name || 
                           rate.service || 
                           rate.serviceLevel || 
                           'Standard';
        const totalCost = rate.total || 
                         rate.totalCost || 
                         rate.total_cost || 
                         rate.cost || 
                         0;
        const transitDays = rate.transitDays || 
                          rate.transit_days || 
                          rate.transitTime || 
                          null;

        return {
          carrierName,
          serviceName,
          totalCost,
          transitDays,
          currency: rate.currency || 'USD',
        };
      });

      // Extract dealId from request if available (could be in hubspotContext or query params)
      const dealId = req.body.hubspotContext?.dealId || req.query.dealId as string | undefined;
      
      // Fire HubSpot note creation (non-blocking)
      // On Vercel, ensure the promise is tracked so it completes before function termination
      const notePromise = createHubSpotNote(dbUser.email, normalizedRates, requestPayload, dealId).catch((err) => {
        console.error('[RATES] HubSpot note creation error:', err);
      });
      
      // On Vercel, track the promise to ensure it completes
      if (process.env.VERCEL === '1') {
        // Give HubSpot call time to complete (max 5 seconds)
        Promise.race([
          notePromise,
          new Promise(resolve => setTimeout(resolve, 5000)),
        ]).catch(() => {});
      }
    }

    // OPTIMIZATION: Don't wait for DB save - return response immediately
    // DB save will complete in background, quoteId may be null initially
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    dbPromise.catch(() => {}); // Fire and forget

    // Log final response before sending
    console.log('[RATES] Sending response to client:', {
      requestId,
      ratesCount: rates.length,
      firstRate: rates[0] ? {
        carrier: rates[0].name || rates[0].carrierName || 'Unknown',
        service: rates[0].serviceName || rates[0].serviceLevel || 'Unknown',
        price: rates[0].total || rates[0].totalCost || 0,
      } : null,
      rateTokensRemaining,
      rateTokensUsed,
      quoteId: dbState.quoteId || null,
    });

    // Return response matching existing JS expected format, with additional token metadata
    res.json({
      requestId,
      quoteId: dbState.quoteId || undefined, // Include quoteId if available (may be null if DB save still in progress)
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
        const dbRateId = dbState.rateIdMap.get(externalRateId) || null; // Database ID for booking (may be null if DB save still in progress)
        
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
