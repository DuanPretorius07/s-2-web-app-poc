import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    clientId: string;
    email: string;
    role: 'ADMIN' | 'USER';
  };
}

export async function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        requestId: crypto.randomUUID(),
        errorCode: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, secret) as {
      userId: string;
      clientId: string;
      email: string;
      role: 'ADMIN' | 'USER';
    };

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { client: true },
    });

    if (!user || user.clientId !== decoded.clientId) {
      return res.status(401).json({
        requestId: crypto.randomUUID(),
        errorCode: 'UNAUTHORIZED',
        message: 'Invalid token',
      });
    }

    req.user = {
      userId: decoded.userId,
      clientId: decoded.clientId,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      requestId: crypto.randomUUID(),
      errorCode: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
    });
  }
}

export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({
      requestId: crypto.randomUUID(),
      errorCode: 'FORBIDDEN',
      message: 'Admin access required',
    });
  }
  next();
}
