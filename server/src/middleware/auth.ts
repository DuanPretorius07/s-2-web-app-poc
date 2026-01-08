import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../lib/supabaseClient.js';

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
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select(`
        id,
        email,
        role,
        client_id,
        clients (
          id,
          name
        )
      `)
      .eq('id', decoded.userId)
      .single();

    if (userError || !user || user.client_id !== decoded.clientId) {
      return res.status(401).json({
        requestId: crypto.randomUUID(),
        errorCode: 'UNAUTHORIZED',
        message: 'Invalid token',
      });
    }

    // Handle both snake_case and camelCase from database
    const clientId = (user as any).client_id || (user as any).clientId || decoded.clientId;
    
    req.user = {
      userId: decoded.userId,
      clientId: clientId,
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
