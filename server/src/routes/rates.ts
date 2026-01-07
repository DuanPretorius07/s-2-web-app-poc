import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { RateRequest, NormalizedRate } from '../types.js';

const router = Router();
const prisma = new PrismaClient();

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

async function callApiGatewayRates(request: RateRequest): Promise<NormalizedRate[]> {
  const apiUrl = process.env.API_GATEWAY_RATES_URL;
  const apiKey = process.env.PROXY_API_KEY;

  if (!apiUrl || !apiKey) {
    // Mock response for development
    console.warn('API_GATEWAY_RATES_URL or PROXY_API_KEY not configured, returning mock data');
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
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`API Gateway returned ${response.status}`);
    }

    const data = await response.json();
    
    // Normalize the response - adjust this based on your API Gateway response format
    if (Array.isArray(data.rates)) {
      return data.rates.map((rate: any) => ({
        rateId: rate.id || rate.rateId,
        carrierName: rate.carrier || rate.carrierName,
        serviceName: rate.service || rate.serviceName,
        transitDays: rate.transitDays || rate.transit_days,
        totalCost: rate.cost || rate.totalCost || rate.total,
        currency: rate.currency || 'USD',
        rawJson: rate,
      }));
    }

    // Fallback normalization
    return [{
      rateId: data.rateId,
      carrierName: data.carrierName || 'Unknown',
      serviceName: data.serviceName || 'Standard',
      transitDays: data.transitDays,
      totalCost: data.totalCost || data.cost,
      currency: data.currency || 'USD',
      rawJson: data,
    }];
  } catch (error) {
    console.error('API Gateway rates error:', error);
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

    const searchData = await searchResponse.json();
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
    const quoteRequest = await prisma.quoteRequest.create({
      data: {
        clientId,
        userId,
        requestPayloadJson: requestPayload as any,
      },
    });

    // Call API Gateway
    let rates: NormalizedRate[];
    try {
      rates = await callApiGatewayRates(requestPayload);
    } catch (error) {
      console.error('Rates API error:', error);
      return res.status(502).json({
        requestId,
        errorCode: 'UPSTREAM_ERROR',
        message: 'Failed to fetch rates from shipping provider',
      });
    }

    // Save rates to database
    const savedRates = await Promise.all(
      rates.map(rate =>
        prisma.rate.create({
          data: {
            quoteRequestId: quoteRequest.id,
            rateId: rate.rateId,
            carrierName: rate.carrierName,
            serviceName: rate.serviceName,
            transitDays: rate.transitDays,
            totalCost: rate.totalCost,
            currency: rate.currency,
            rawJson: rate.rawJson as any,
          },
        })
      )
    );

    // Create HubSpot note if configured
    if (requestPayload.hubspotContext?.email || requestPayload.contact.email) {
      await createHubSpotNote(
        requestPayload.hubspotContext?.email || requestPayload.contact.email,
        rates,
        requestPayload.hubspotContext?.dealId
      );
    }

    await prisma.auditLog.create({
      data: {
        clientId,
        userId,
        action: 'GET_RATES',
        metadataJson: {
          quoteRequestId: quoteRequest.id,
          ratesCount: rates.length,
        },
      },
    });

    res.json({
      requestId,
      quoteId: quoteRequest.id,
      rates: savedRates.map(r => ({
        id: r.id,
        rateId: r.rateId,
        carrierName: r.carrierName,
        serviceName: r.serviceName,
        transitDays: r.transitDays,
        totalCost: r.totalCost,
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
