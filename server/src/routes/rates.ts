import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabaseClient.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { RateRequest, NormalizedRate } from '../types.js';
import { ship2PrimusRequest } from '../lib/ship2primusClient.js';

const router = Router();

const rateRequestSchema = z.object({
  contact: z.object({
    fullName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
  }),
  origin: z.object({
    countryCode: z.string().min(2).max(2),
    postalCode: z.string().min(1),
    state: z.string().optional(),
    city: z.string().optional(),
  }),
  destination: z.object({
    countryCode: z.string().min(2).max(2),
    postalCode: z.string().min(1),
    state: z.string().optional(),
    city: z.string().optional(),
  }),
  shipment: z.object({
    shipDate: z.string().optional(),
    pieces: z.number().int().min(1),
    totalWeight: z.number().min(0.1),
    weightUnit: z.enum(['LB', 'KG']),
    dimensions: z.object({
      length: z.number().positive(),
      width: z.number().positive(),
      height: z.number().positive(),
      dimUnit: z.enum(['IN', 'CM']),
    }).optional(),
    description: z.string().max(500).optional(),
  }),
  accessorials: z.object({
    residentialDelivery: z.boolean(),
    liftgatePickup: z.boolean(),
    liftgateDelivery: z.boolean(),
    insidePickup: z.boolean(),
    insideDelivery: z.boolean(),
    limitedAccessPickup: z.boolean(),
    limitedAccessDelivery: z.boolean(),
  }),
  hubspotContext: z.object({
    contactId: z.string().optional(),
    dealId: z.string().optional(),
    email: z.string().optional(),
    firstname: z.string().optional(),
    lastname: z.string().optional(),
  }).optional(),
});

async function callShip2PrimusRates(request: RateRequest): Promise<NormalizedRate[]> {
  const apiUrl = process.env.SHIP2PRIMUS_RATES_URL;

  if (!apiUrl) {
    // Mock response for development
    console.warn('SHIP2PRIMUS_RATES_URL not configured, returning mock data');
    return [
      {
        rateId: 'mock-rate-1',
        carrierName: 'FedEx',
        serviceName: 'Ground',
        transitDays: 3,
        totalCost: 45.99,
        currency: 'USD',
      },
      {
        rateId: 'mock-rate-2',
        carrierName: 'UPS',
        serviceName: 'Standard',
        transitDays: 2,
        totalCost: 52.50,
        currency: 'USD',
      },
      {
        rateId: 'mock-rate-3',
        carrierName: 'USPS',
        serviceName: 'Priority Mail',
        transitDays: 1,
        totalCost: 38.75,
        currency: 'USD',
      },
    ];
  }

  try {
    const data = await ship2PrimusRequest<any>(apiUrl, {
      method: 'POST',
      body: JSON.stringify(request),
    });
    
    // Normalize the response - adjust this based on Ship2Primus API response format
    if (Array.isArray(data.rates)) {
      return data.rates.map((rate: any) => ({
        rateId: rate.id || rate.rateId || rate.rate_id,
        carrierName: rate.carrier || rate.carrierName || rate.carrier_name,
        serviceName: rate.service || rate.serviceName || rate.service_name,
        transitDays: rate.transitDays || rate.transit_days,
        totalCost: rate.cost || rate.totalCost || rate.total_cost || rate.total,
        currency: rate.currency || 'USD',
        rawJson: rate,
      }));
    }

    // If response is a single rate object
    if (data.rateId || data.carrierName) {
      return [{
        rateId: data.rateId || data.rate_id || data.id,
        carrierName: data.carrierName || data.carrier_name || data.carrier || 'Unknown',
        serviceName: data.serviceName || data.service_name || data.service || 'Standard',
        transitDays: data.transitDays || data.transit_days,
        totalCost: data.totalCost || data.total_cost || data.cost || data.total,
        currency: data.currency || 'USD',
        rawJson: data,
      }];
    }

    // Fallback: try to extract from root level or return mock
    console.warn('Unexpected Ship2Primus rates response format:', data);
    return [];
  } catch (error) {
    console.error('Ship2Primus rates API error:', error);
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
router.post('/rates', authenticateToken, validateBody(rateRequestSchema), async (req: AuthRequest, res) => {
  const requestId = crypto.randomUUID();
  
  try {
    const userId = req.user!.userId;
    const clientId = req.user!.clientId;
    const requestPayload = req.body as RateRequest;

    // Save quote request
    const { data: quoteRequest, error: quoteError } = await supabaseAdmin
      .from('quote_requests')
      .insert({
        client_id: clientId,
        user_id: userId,
        request_payload_json: requestPayload as any,
      })
      .select('id')
      .single();

    if (quoteError || !quoteRequest) {
      throw new Error('Failed to save quote request');
    }

    // Call Ship2Primus API
    let rates: NormalizedRate[];
    try {
      rates = await callShip2PrimusRates(requestPayload);
    } catch (error) {
      console.error('Rates API error:', error);
      return res.status(502).json({
        requestId,
        errorCode: 'UPSTREAM_ERROR',
        message: 'Failed to fetch rates from shipping provider',
      });
    }

    // Save rates to database
    const ratesToInsert = rates.map(rate => ({
      quote_request_id: quoteRequest.id,
      rate_id: rate.rateId,
      carrier_name: rate.carrierName,
      service_name: rate.serviceName,
      transit_days: rate.transitDays,
      total_cost: rate.totalCost,
      currency: rate.currency,
      raw_json: rate.rawJson as any,
    }));

    const { data: savedRates, error: ratesError } = await supabaseAdmin
      .from('rates')
      .insert(ratesToInsert)
      .select('id, rate_id, carrier_name, service_name, transit_days, total_cost, currency');

    if (ratesError || !savedRates) {
      throw new Error('Failed to save rates');
    }

    // Create HubSpot note if configured
    if (requestPayload.hubspotContext?.email || requestPayload.contact.email) {
      await createHubSpotNote(
        requestPayload.hubspotContext?.email || requestPayload.contact.email,
        rates,
        requestPayload.hubspotContext?.dealId
      );
    }

    await supabaseAdmin.from('audit_logs').insert({
      client_id: clientId,
      user_id: userId,
      action: 'GET_RATES',
      metadata_json: {
        quoteRequestId: quoteRequest.id,
        ratesCount: rates.length,
      },
    });

    res.json({
      requestId,
      quoteId: quoteRequest.id,
      rates: savedRates.map(r => ({
        id: r.id,
        rateId: r.rate_id,
        carrierName: r.carrier_name,
        serviceName: r.service_name,
        transitDays: r.transit_days,
        totalCost: parseFloat(r.total_cost.toString()),
        currency: r.currency,
      })),
    });
  } catch (error) {
    console.error('Rates endpoint error:', error);
    res.status(500).json({
      requestId,
      errorCode: 'INTERNAL_ERROR',
      message: 'Failed to process rates request',
    });
  }
});

export default router;
