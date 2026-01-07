import request from 'supertest';
import express from 'express';
import authRoutes from '../routes/auth.js';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    client: {
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

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        role: 'USER',
        clientId: 'client-1',
        client: { name: 'Test Client' },
      };

      const PrismaClientMock = PrismaClient as jest.MockedClass<typeof PrismaClient>;
      const prismaInstance = new PrismaClientMock();
      (prismaInstance.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaInstance.auditLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('test@example.com');
    });

    it('should fail with invalid credentials', async () => {
      const PrismaClientMock = PrismaClient as jest.MockedClass<typeof PrismaClient>;
      const prismaInstance = new PrismaClientMock();
      (prismaInstance.user.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.errorCode).toBe('INVALID_CREDENTIALS');
    });
  });
});
