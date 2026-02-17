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
      console.log('[Auth] No token found in cookies or headers');
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

    let decoded: {
      userId: string;
      clientId: string;
      email: string;
      role: 'ADMIN' | 'USER';
      exp?: number;
      iat?: number;
    };
    
    try {
      decoded = jwt.verify(token, secret) as typeof decoded;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        console.log('[Auth] Token expired');
        return res.status(401).json({
          requestId: crypto.randomUUID(),
          errorCode: 'TOKEN_EXPIRED',
          message: 'Your session has expired. Please log in again.',
        });
      }
      throw error;
    }
    
    // Additional check: verify expiration manually if exp claim exists
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      console.log('[Auth] Token expired (manual check)');
      return res.status(401).json({
        requestId: crypto.randomUUID(),
        errorCode: 'TOKEN_EXPIRED',
        message: 'Your session has expired. Please log in again.',
      });
    }

    console.log('[Auth] Token decoded:', { userId: decoded.userId, email: decoded.email, clientId: decoded.clientId });

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

    if (userError) {
      console.error('[Auth] User lookup failed:', { userId: decoded.userId, error: userError.message });
      return res.status(401).json({
        requestId: crypto.randomUUID(),
        errorCode: 'UNAUTHORIZED',
        message: 'Invalid token',
      });
    }

    if (!user || user.client_id !== decoded.clientId) {
      console.warn('[Auth] User not found or client mismatch:', { userId: decoded.userId, hasUser: !!user, userClientId: user?.client_id, tokenClientId: decoded.clientId });
      return res.status(401).json({
        requestId: crypto.randomUUID(),
        errorCode: 'UNAUTHORIZED',
        message: 'Invalid token',
      });
    }

    console.log('[Auth] User authenticated:', { id: user.id, email: user.email, clientId: user.client_id });

    // Handle both snake_case and camelCase from database
    const clientId = (user as any).client_id || (user as any).clientId || decoded.clientId;
    
    req.user = {
      userId: decoded.userId,
      clientId: clientId,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error: any) {
    // Check if it's a token expiration error
    if (error?.name === 'TokenExpiredError' || error?.name === 'JsonWebTokenError') {
      console.log('[Auth] Token validation failed:', error.name, error.message);
      return res.status(401).json({
        requestId: crypto.randomUUID(),
        errorCode: error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED',
        message: error.name === 'TokenExpiredError' 
          ? 'Your session has expired. Please log in again.'
          : 'Invalid or expired token',
      });
    }
    
    // Other errors
    console.error('[Auth] Authentication error:', error);
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
