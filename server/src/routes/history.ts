import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabaseClient.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validation.js';

const router = Router();

const historyFiltersSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  originPostal: z.string().optional(),
  destinationPostal: z.string().optional(),
  carrier: z.string().optional(),
  status: z.string().optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default('50'),
  offset: z.string().transform(Number).pipe(z.number().int().min(0)).optional().default('0'),
});

// GET /api/history/quotes
router.get('/quotes', authenticateToken, validateQuery(historyFiltersSchema), async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.clientId;
    const userId = req.user!.userId;
    const role = req.user!.role;
    const { startDate, endDate, originPostal, destinationPostal, carrier, limit, offset } = req.query as any;

    let query = supabaseAdmin
      .from('quote_requests')
      .select(`
        id,
        request_payload_json,
        created_at,
        rates (
          id,
          carrier_name,
          service_name,
          transit_days,
          total_cost,
          currency
        ),
        users (
          email
        )
      `)
      .eq('client_id', clientId);

    // USER role can only see their own quotes; ADMIN can see all client quotes
    if (role === 'USER') {
      query = query.eq('user_id', userId);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    query = query.order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: quotes, error: quotesError } = await query;

    if (quotesError) {
      throw quotesError;
    }

    // Apply postal code and carrier filters
    let filteredQuotes = quotes || [];
    if (originPostal || destinationPostal || carrier) {
      filteredQuotes = (quotes || []).filter((quote: any) => {
        const payload = quote.request_payload_json;
        if (originPostal && payload.origin?.postalCode !== originPostal) {
          return false;
        }
        if (destinationPostal && payload.destination?.postalCode !== destinationPostal) {
          return false;
        }
        if (carrier) {
          const rates = Array.isArray(quote.rates) ? quote.rates : [];
          const hasCarrier = rates.some((r: any) => 
            r.carrier_name?.toLowerCase().includes(carrier.toLowerCase())
          );
          if (!hasCarrier) {
            return false;
          }
        }
        return true;
      });
    }

    res.json({
      quotes: filteredQuotes.map((quote: any) => {
        const payload = quote.request_payload_json;
        const rates = Array.isArray(quote.rates) ? quote.rates : [];
        
        // Handle both old and new payload structures
        let contact, origin, destination, shipment;
        if (payload?.contact) {
          // Old structure
          contact = payload.contact;
          origin = payload.origin;
          destination = payload.destination;
          shipment = payload.shipment;
        } else if (payload?.originCity !== undefined || payload?.freightInfo) {
          // New structure - transform for frontend
          const freightInfo = Array.isArray(payload.freightInfo) ? payload.freightInfo[0] : {};
          contact = { fullName: '', email: '', phone: '' };
          origin = {
            countryCode: payload.originCountry || 'US',
            postalCode: payload.originZipcode || '',
          };
          destination = {
            countryCode: payload.destinationCountry || 'US',
            postalCode: payload.destinationZipcode || '',
          };
          shipment = {
            pieces: freightInfo.qty || 1,
            totalWeight: freightInfo.weight || 0,
            weightUnit: freightInfo.weightType === 'lbs' ? 'LB' : 'KG',
          };
        } else {
          // Fallback
          contact = { fullName: '', email: '' };
          origin = { countryCode: 'US', postalCode: '' };
          destination = { countryCode: 'US', postalCode: '' };
          shipment = { pieces: 1, totalWeight: 0, weightUnit: 'LB' };
        }
        
        return {
          id: quote.id,
          createdAt: quote.created_at,
          contact,
          origin,
          destination,
          shipment,
          ratesCount: rates.length,
          rates: rates.map((r: any) => ({
            id: r.id,
            carrierName: r.carrier_name,
            serviceName: r.service_name,
            transitDays: r.transit_days,
            totalCost: parseFloat(r.total_cost.toString()),
            currency: r.currency,
          })),
        };
      }),
      total: filteredQuotes.length,
    });
  } catch (error) {
    console.error('History quotes error:', error);
    res.status(500).json({
      requestId: crypto.randomUUID(),
      errorCode: 'INTERNAL_ERROR',
      message: 'Failed to fetch quote history',
    });
  }
});

// GET /api/history/quotes/:quoteId
router.get('/quotes/:quoteId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.clientId;
    const userId = req.user!.userId;
    const role = req.user!.role;
    const { quoteId } = req.params;

    let query = supabaseAdmin
      .from('quote_requests')
      .select(`
        id,
        request_payload_json,
        created_at,
        rates (
          id,
          rate_id,
          carrier_name,
          service_name,
          transit_days,
          total_cost,
          currency
        ),
        bookings (
          id,
          booking_id_external,
          confirmation_number,
          status,
          created_at,
          rates (
            carrier_name,
            service_name,
            total_cost,
            currency
          )
        ),
        users (
          email
        )
      `)
      .eq('id', quoteId)
      .eq('client_id', clientId);

    if (role === 'USER') {
      query = query.eq('user_id', userId);
    }

    const { data: quote, error: quoteError } = await query.single();

    if (quoteError || !quote) {
      return res.status(404).json({
        requestId: crypto.randomUUID(),
        errorCode: 'QUOTE_NOT_FOUND',
        message: 'Quote not found',
      });
    }

    const payload = quote.request_payload_json;
    
    // Handle both old payload structure (contact, origin, destination, shipment) 
    // and new payload structure (originCity, originState, freightInfo)
    let contact, origin, destination, shipment, accessorials;
    
    if (payload.contact) {
      // Old structure
      contact = payload.contact;
      origin = payload.origin;
      destination = payload.destination;
      shipment = payload.shipment;
      accessorials = payload.accessorials || {};
    } else if (payload.originCity !== undefined || payload.freightInfo) {
      // New structure - transform to old format for frontend compatibility
      const freightInfo = Array.isArray(payload.freightInfo) ? payload.freightInfo[0] : {};
      contact = {
        fullName: '',
        email: '',
        phone: '',
      };
      origin = {
        countryCode: payload.originCountry || 'US',
        postalCode: payload.originZipcode || '',
        state: payload.originState || '',
        city: payload.originCity || '',
      };
      destination = {
        countryCode: payload.destinationCountry || 'US',
        postalCode: payload.destinationZipcode || '',
        state: payload.destinationState || '',
        city: payload.destinationCity || '',
      };
      shipment = {
        shipDate: payload.pickupDate || '',
        pieces: freightInfo.qty || 1,
        totalWeight: freightInfo.weight || 0,
        weightUnit: freightInfo.weightType === 'lbs' ? 'LB' : 'KG',
        dimensions: (freightInfo.length && freightInfo.width && freightInfo.height) ? {
          length: freightInfo.length,
          width: freightInfo.width,
          height: freightInfo.height,
          dimUnit: 'IN',
        } : undefined,
      };
      accessorials = {};
    } else {
      // Fallback - empty structure
      contact = { fullName: '', email: '', phone: '' };
      origin = { countryCode: 'US', postalCode: '', state: '', city: '' };
      destination = { countryCode: 'US', postalCode: '', state: '', city: '' };
      shipment = { pieces: 1, totalWeight: 0, weightUnit: 'LB' };
      accessorials = {};
    }
    
    const rates = Array.isArray(quote.rates) ? quote.rates : [];
    const bookings = Array.isArray(quote.bookings) ? quote.bookings : [];
    res.json({
      id: quote.id,
      createdAt: quote.created_at,
      contact,
      origin,
      destination,
      shipment,
      accessorials,
      rates: rates.map((r: any) => ({
        id: r.id,
        rateId: r.rate_id,
        carrierName: r.carrier_name,
        serviceName: r.service_name,
        transitDays: r.transit_days,
        totalCost: parseFloat(r.total_cost.toString()),
        currency: r.currency,
      })),
      bookings: bookings.map((b: any) => {
        const bookingRate = Array.isArray(b.rates) ? b.rates[0] : b.rates;
        return {
          id: b.id,
          bookingIdExternal: b.booking_id_external,
          confirmationNumber: b.confirmation_number,
          status: b.status,
          createdAt: b.created_at,
          rate: {
            carrierName: bookingRate?.carrier_name || '',
            serviceName: bookingRate?.service_name || '',
            totalCost: bookingRate ? parseFloat(bookingRate.total_cost.toString()) : 0,
            currency: bookingRate?.currency || 'USD',
          },
        };
      }),
    });
  } catch (error) {
    console.error('Quote details error:', error);
    res.status(500).json({
      requestId: crypto.randomUUID(),
      errorCode: 'INTERNAL_ERROR',
      message: 'Failed to fetch quote details',
    });
  }
});

// GET /api/history/bookings
router.get('/bookings', authenticateToken, validateQuery(historyFiltersSchema), async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.clientId;
    const userId = req.user!.userId;
    const role = req.user!.role;
    const { startDate, endDate, originPostal, destinationPostal, carrier, status, limit, offset } = req.query as any;

    let query = supabaseAdmin
      .from('bookings')
      .select(`
        id,
        booking_id_external,
        confirmation_number,
        status,
        created_at,
        rates (
          carrier_name,
          service_name,
          total_cost,
          currency
        ),
        quote_requests (
          request_payload_json
        )
      `)
      .eq('client_id', clientId);

    if (role === 'USER') {
      query = query.eq('user_id', userId);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    if (status) {
      query = query.eq('status', status);
    }

    query = query.order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: bookings, error: bookingsError } = await query;

    if (bookingsError) {
      throw bookingsError;
    }

    // Apply postal code and carrier filters
    let filteredBookings = bookings || [];
    if (originPostal || destinationPostal || carrier) {
      filteredBookings = (bookings || []).filter((booking: any) => {
        const quoteRequest = Array.isArray(booking.quote_requests) ? booking.quote_requests[0] : booking.quote_requests;
        const payload = quoteRequest?.request_payload_json;
        if (originPostal && payload?.origin?.postalCode !== originPostal) {
          return false;
        }
        if (destinationPostal && payload?.destination?.postalCode !== destinationPostal) {
          return false;
        }
        if (carrier) {
          const rate = Array.isArray(booking.rates) ? booking.rates[0] : booking.rates;
          if (rate?.carrier_name?.toLowerCase() !== carrier.toLowerCase()) {
            return false;
          }
        }
        return true;
      });
    }

    res.json({
      bookings: filteredBookings.map((booking: any) => {
        const quoteRequest = Array.isArray(booking.quote_requests) ? booking.quote_requests[0] : booking.quote_requests;
        const payload = quoteRequest?.request_payload_json;
        const rate = Array.isArray(booking.rates) ? booking.rates[0] : booking.rates;
        return {
          id: booking.id,
          bookingIdExternal: booking.booking_id_external,
          confirmationNumber: booking.confirmation_number,
          status: booking.status,
          createdAt: booking.created_at,
          carrierName: rate?.carrier_name || '',
          serviceName: rate?.service_name || '',
          totalCost: rate ? parseFloat(rate.total_cost.toString()) : 0,
          currency: rate?.currency || 'USD',
          origin: payload?.origin,
          destination: payload?.destination,
        };
      }),
      total: filteredBookings.length,
    });
  } catch (error) {
    console.error('History bookings error:', error);
    res.status(500).json({
      requestId: crypto.randomUUID(),
      errorCode: 'INTERNAL_ERROR',
      message: 'Failed to fetch booking history',
    });
  }
});

// GET /api/history/bookings/:bookingId
router.get('/bookings/:bookingId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.clientId;
    const userId = req.user!.userId;
    const role = req.user!.role;
    const { bookingId } = req.params;

    let query = supabaseAdmin
      .from('bookings')
      .select(`
        id,
        booking_id_external,
        confirmation_number,
        status,
        created_at,
        rates (
          id,
          carrier_name,
          service_name,
          transit_days,
          total_cost,
          currency
        ),
        quote_requests (
          id,
          request_payload_json
        ),
        users (
          email
        )
      `)
      .eq('id', bookingId)
      .eq('client_id', clientId);

    if (role === 'USER') {
      query = query.eq('user_id', userId);
    }

    const { data: booking, error: bookingError } = await query.single();

    if (bookingError || !booking) {
      return res.status(404).json({
        requestId: crypto.randomUUID(),
        errorCode: 'BOOKING_NOT_FOUND',
        message: 'Booking not found',
      });
    }

    const quoteRequest = Array.isArray(booking.quote_requests) ? booking.quote_requests[0] : booking.quote_requests;
    const payload = quoteRequest?.request_payload_json;
    const rate = Array.isArray(booking.rates) ? booking.rates[0] : booking.rates;
    
    // Handle both old and new payload structures for quoteRequest
    let contact, origin, destination, shipment, accessorials;
    if (payload?.contact) {
      // Old structure
      contact = payload.contact;
      origin = payload.origin;
      destination = payload.destination;
      shipment = payload.shipment;
      accessorials = payload.accessorials || {};
    } else if (payload?.originCity !== undefined || payload?.freightInfo) {
      // New structure - transform to old format
      const freightInfo = Array.isArray(payload.freightInfo) ? payload.freightInfo[0] : {};
      contact = { fullName: '', email: '', phone: '' };
      origin = {
        countryCode: payload.originCountry || 'US',
        postalCode: payload.originZipcode || '',
        state: payload.originState || '',
        city: payload.originCity || '',
      };
      destination = {
        countryCode: payload.destinationCountry || 'US',
        postalCode: payload.destinationZipcode || '',
        state: payload.destinationState || '',
        city: payload.destinationCity || '',
      };
      shipment = {
        shipDate: payload.pickupDate || '',
        pieces: freightInfo.qty || 1,
        totalWeight: freightInfo.weight || 0,
        weightUnit: freightInfo.weightType === 'lbs' ? 'LB' : 'KG',
        dimensions: (freightInfo.length && freightInfo.width && freightInfo.height) ? {
          length: freightInfo.length,
          width: freightInfo.width,
          height: freightInfo.height,
          dimUnit: 'IN',
        } : undefined,
      };
      accessorials = {};
    } else {
      // Fallback
      contact = { fullName: '', email: '', phone: '' };
      origin = { countryCode: 'US', postalCode: '', state: '', city: '' };
      destination = { countryCode: 'US', postalCode: '', state: '', city: '' };
      shipment = { pieces: 1, totalWeight: 0, weightUnit: 'LB' };
      accessorials = {};
    }
    
    res.json({
      id: booking.id,
      bookingIdExternal: booking.booking_id_external,
      confirmationNumber: booking.confirmation_number,
      status: booking.status,
      createdAt: booking.created_at,
      rate: {
        id: rate?.id || '',
        carrierName: rate?.carrier_name || '',
        serviceName: rate?.service_name || '',
        transitDays: rate?.transit_days || null,
        totalCost: rate ? parseFloat(rate.total_cost.toString()) : 0,
        currency: rate?.currency || 'USD',
      },
      quoteRequest: {
        id: quoteRequest?.id || '',
        contact,
        origin,
        destination,
        shipment,
        accessorials,
      },
    });
  } catch (error) {
    console.error('Booking details error:', error);
    res.status(500).json({
      requestId: crypto.randomUUID(),
      errorCode: 'INTERNAL_ERROR',
      message: 'Failed to fetch booking details',
    });
  }
});

export default router;
