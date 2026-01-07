import request from 'supertest';
import express from 'express';
import ratesRoutes from '../routes/rates.js';
import { authenticateToken } from '../middleware/auth.js';
import { PrismaClient } from '@prisma/client';

// Mock auth middleware
jest.mock('../middleware/auth.js', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = {
      userId: 'user-1',
      clientId: 'client-1',
      email: 'test@example.com',
      role: 'USER',
    };
    next();
  },
}));

const app = express();
app.use(express.json());
app.use('/api', ratesRoutes);

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    quoteRequest: {
      create: jest.fn(),
    },
    rate: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mockPrisma),
  };
});

// Mock fetch
global.fetch = jest.fn();

describe('Rates Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.API_GATEWAY_RATES_URL = '';
    process.env.PROXY_API_KEY = '';
  });

  describe('POST /api/rates', () => {
    it('should return normalized rates', async () => {
      const mockQuoteRequest = {
        id: 'quote-1',
        clientId: 'client-1',
        userId: 'user-1',
        requestPayloadJson: {},
        createdAt: new Date(),
      };

      const mockRate = {
        id: 'rate-1',
        quoteRequestId: 'quote-1',
        rateId: 'rate-ext-1',
        carrierName: 'FedEx',
        serviceName: 'Ground',
        transitDays: 3,
        totalCost: 45.99,
        currency: 'USD',
        createdAt: new Date(),
      };

      const PrismaClientMock = PrismaClient as jest.MockedClass<typeof PrismaClient>;
      const prismaInstance = new PrismaClientMock();
      (prismaInstance.quoteRequest.create as jest.Mock).mockResolvedValue(mockQuoteRequest);
      (prismaInstance.rate.create as jest.Mock).mockResolvedValue(mockRate);
      (prismaInstance.auditLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/api/rates')
        .send({
          contact: {
            fullName: 'John Doe',
            email: 'john@example.com',
          },
          origin: {
            countryCode: 'US',
            postalCode: '10001',
          },
          destination: {
            countryCode: 'US',
            postalCode: '90210',
          },
          shipment: {
            pieces: 1,
            totalWeight: 10,
            weightUnit: 'LB',
          },
          accessorials: {
            residentialDelivery: false,
            liftgatePickup: false,
            liftgateDelivery: false,
            insidePickup: false,
            insideDelivery: false,
            limitedAccessPickup: false,
            limitedAccessDelivery: false,
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.quoteId).toBe('quote-1');
      expect(response.body.rates).toBeDefined();
    });
  });
});
