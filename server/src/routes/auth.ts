import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';

const router = Router();
const prisma = new PrismaClient();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'USER']).default('USER'),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  inviteToken: z.string().optional(),
  clientName: z.string().min(1).optional(),
});

function generateToken(user: { id: string; clientId: string; email: string; role: string }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }
  return jwt.sign(
    {
      userId: user.id,
      clientId: user.clientId,
      email: user.email,
      role: user.role,
    },
    secret,
    { expiresIn: '7d' }
  );
}

function setTokenCookie(res: Response, token: string) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

// POST /api/auth/login
router.post('/login', validateBody(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { client: true },
    });

    if (!user) {
      return res.status(401).json({
        requestId: crypto.randomUUID(),
        errorCode: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({
        requestId: crypto.randomUUID(),
        errorCode: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    const token = generateToken(user);
    setTokenCookie(res, token);

    await prisma.auditLog.create({
      data: {
        clientId: user.clientId,
        userId: user.id,
        action: 'LOGIN',
        metadataJson: { email: user.email },
      },
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        clientId: user.clientId,
        clientName: user.client.name,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      requestId: crypto.randomUUID(),
      errorCode: 'INTERNAL_ERROR',
      message: 'Login failed',
    });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, async (req: AuthRequest, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { client: true },
      select: {
        id: true,
        email: true,
        role: true,
        clientId: true,
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        requestId: crypto.randomUUID(),
        errorCode: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        clientId: user.clientId,
        clientName: user.client.name,
      },
    });
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({
      requestId: crypto.randomUUID(),
      errorCode: 'INTERNAL_ERROR',
      message: 'Failed to fetch user',
    });
  }
});

// POST /api/auth/invite (ADMIN only)
router.post(
  '/invite',
  authenticateToken,
  requireAdmin,
  validateBody(inviteSchema),
  async (req: AuthRequest, res) => {
    try {
      const { email, role } = req.body;
      const clientId = req.user!.clientId;

      // Check if user already exists
      const existing = await prisma.user.findUnique({
        where: { email },
      });

      if (existing) {
        return res.status(400).json({
          requestId: crypto.randomUUID(),
          errorCode: 'USER_EXISTS',
          message: 'User with this email already exists',
        });
      }

      // Generate invite token (simple UUID for now; in production, use a proper token system)
      const inviteToken = crypto.randomUUID();
      // In a real app, store this in a separate Invite table with expiration

      await prisma.auditLog.create({
        data: {
          clientId,
          userId: req.user!.userId,
          action: 'INVITE_USER',
          metadataJson: { email, role, inviteToken },
        },
      });

      res.json({
        message: 'Invite created',
        inviteToken, // In production, send via email instead
        email,
        role,
      });
    } catch (error) {
      console.error('Invite error:', error);
      res.status(500).json({
        requestId: crypto.randomUUID(),
        errorCode: 'INTERNAL_ERROR',
        message: 'Failed to create invite',
      });
    }
  }
);

// POST /api/auth/register (with invite token or create new client)
router.post('/register', validateBody(registerSchema), async (req, res) => {
  try {
    const { email, password, inviteToken, clientName } = req.body;

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return res.status(400).json({
        requestId: crypto.randomUUID(),
        errorCode: 'USER_EXISTS',
        message: 'User with this email already exists',
      });
    }

    let clientId: string;

    if (inviteToken) {
      // Find invite by token (simplified; in production use proper invite table)
      // For now, we'll skip invite validation and require clientName
      if (!clientName) {
        return res.status(400).json({
          requestId: crypto.randomUUID(),
          errorCode: 'INVALID_INVITE',
          message: 'Invalid or expired invite token',
        });
      }
      // Create new client
      const client = await prisma.client.create({
        data: { name: clientName },
      });
      clientId = client.id;
    } else if (clientName) {
      // Create new client
      const client = await prisma.client.create({
        data: { name: clientName },
      });
      clientId = client.id;
    } else {
      return res.status(400).json({
        requestId: crypto.randomUUID(),
        errorCode: 'VALIDATION_ERROR',
        message: 'Either inviteToken or clientName is required',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        clientId,
        role: 'ADMIN', // First user is admin
      },
      include: { client: true },
    });

    const token = generateToken(user);
    setTokenCookie(res, token);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        clientId: user.clientId,
        clientName: user.client.name,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      requestId: crypto.randomUUID(),
      errorCode: 'INTERNAL_ERROR',
      message: 'Registration failed',
    });
  }
});

export default router;
