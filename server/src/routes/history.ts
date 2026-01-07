import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validation.js';

const router = Router();
const prisma = new PrismaClient();

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

    const where: any = {
      clientId,
    };

    // USER role can only see their own quotes; ADMIN can see all client quotes
    if (role === 'USER') {
      where.userId = userId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // Filter by origin/destination postal code (requires JSON filtering)
    if (originPostal || destinationPostal || carrier) {
      // This is a simplified filter; in production, you might want to add indexed fields
      // For now, we'll filter in memory after fetching
    }

    const quotes = await prisma.quoteRequest.findMany({
      where,
      include: {
        rates: true,
        user: {
          select: {
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    // Apply postal code and carrier filters
    let filteredQuotes = quotes;
    if (originPostal || destinationPostal || carrier) {
      filteredQuotes = quotes.filter(quote => {
        const payload = quote.requestPayloadJson as any;
        if (originPostal && payload.origin?.postalCode !== originPostal) {
          return false;
        }
        if (destinationPostal && payload.destination?.postalCode !== destinationPostal) {
          return false;
        }
        if (carrier) {
          const hasCarrier = quote.rates.some(r => 
            r.carrierName.toLowerCase().includes(carrier.toLowerCase())
          );
          if (!hasCarrier) {
            return false;
          }
        }
        return true;
      });
    }

    res.json({
      quotes: filteredQuotes.map(quote => {
        const payload = quote.requestPayloadJson as any;
        return {
          id: quote.id,
          createdAt: quote.createdAt,
          contact: payload.contact,
          origin: payload.origin,
          destination: payload.destination,
          shipment: payload.shipment,
          ratesCount: quote.rates.length,
          rates: quote.rates.map(r => ({
            id: r.id,
            carrierName: r.carrierName,
            serviceName: r.serviceName,
            transitDays: r.transitDays,
            totalCost: r.totalCost,
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

    const where: any = {
      id: quoteId,
      clientId,
    };

    if (role === 'USER') {
      where.userId = userId;
    }

    const quote = await prisma.quoteRequest.findFirst({
      where,
      include: {
        rates: true,
        bookings: {
          include: {
            rate: true,
          },
        },
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!quote) {
      return res.status(404).json({
        requestId: crypto.randomUUID(),
        errorCode: 'QUOTE_NOT_FOUND',
        message: 'Quote not found',
      });
    }

    const payload = quote.requestPayloadJson as any;
    res.json({
      id: quote.id,
      createdAt: quote.createdAt,
      contact: payload.contact,
      origin: payload.origin,
      destination: payload.destination,
      shipment: payload.shipment,
      accessorials: payload.accessorials,
      rates: quote.rates.map(r => ({
        id: r.id,
        rateId: r.rateId,
        carrierName: r.carrierName,
        serviceName: r.serviceName,
        transitDays: r.transitDays,
        totalCost: r.totalCost,
        currency: r.currency,
      })),
      bookings: quote.bookings.map(b => ({
        id: b.id,
        bookingIdExternal: b.bookingIdExternal,
        confirmationNumber: b.confirmationNumber,
        status: b.status,
        createdAt: b.createdAt,
        rate: {
          carrierName: b.rate.carrierName,
          serviceName: b.rate.serviceName,
          totalCost: b.rate.totalCost,
          currency: b.rate.currency,
        },
      })),
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

    const where: any = {
      clientId,
    };

    if (role === 'USER') {
      where.userId = userId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    if (status) {
      where.status = status;
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        rate: true,
        quoteRequest: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    // Apply postal code and carrier filters
    let filteredBookings = bookings;
    if (originPostal || destinationPostal || carrier) {
      filteredBookings = bookings.filter(booking => {
        const payload = booking.quoteRequest.requestPayloadJson as any;
        if (originPostal && payload.origin?.postalCode !== originPostal) {
          return false;
        }
        if (destinationPostal && payload.destination?.postalCode !== destinationPostal) {
          return false;
        }
        if (carrier && booking.rate.carrierName.toLowerCase() !== carrier.toLowerCase()) {
          return false;
        }
        return true;
      });
    }

    res.json({
      bookings: filteredBookings.map(booking => {
        const payload = booking.quoteRequest.requestPayloadJson as any;
        return {
          id: booking.id,
          bookingIdExternal: booking.bookingIdExternal,
          confirmationNumber: booking.confirmationNumber,
          status: booking.status,
          createdAt: booking.createdAt,
          carrierName: booking.rate.carrierName,
          serviceName: booking.rate.serviceName,
          totalCost: booking.rate.totalCost,
          currency: booking.rate.currency,
          origin: payload.origin,
          destination: payload.destination,
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

    const where: any = {
      id: bookingId,
      clientId,
    };

    if (role === 'USER') {
      where.userId = userId;
    }

    const booking = await prisma.booking.findFirst({
      where,
      include: {
        rate: true,
        quoteRequest: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({
        requestId: crypto.randomUUID(),
        errorCode: 'BOOKING_NOT_FOUND',
        message: 'Booking not found',
      });
    }

    const payload = booking.quoteRequest.requestPayloadJson as any;
    res.json({
      id: booking.id,
      bookingIdExternal: booking.bookingIdExternal,
      confirmationNumber: booking.confirmationNumber,
      status: booking.status,
      createdAt: booking.createdAt,
      rate: {
        id: booking.rate.id,
        carrierName: booking.rate.carrierName,
        serviceName: booking.rate.serviceName,
        transitDays: booking.rate.transitDays,
        totalCost: booking.rate.totalCost,
        currency: booking.rate.currency,
      },
      quoteRequest: {
        id: booking.quoteRequest.id,
        contact: payload.contact,
        origin: payload.origin,
        destination: payload.destination,
        shipment: payload.shipment,
        accessorials: payload.accessorials,
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
