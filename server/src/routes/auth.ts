import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabaseClient.js';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';

const router = Router();

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

function generateToken(user: { id: string; client_id: string; email: string; role: string }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }
  return jwt.sign(
    {
      userId: user.id,
      clientId: user.client_id,
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
  console.log('[LOGIN] Endpoint hit', { email: req.body?.email });
  try {
    const { email, password } = req.body;
    console.log('[LOGIN] Processing login', { email });

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select(`
        id,
        email,
        password_hash,
        role,
        client_id,
        clients (
          id,
          name
        )
      `)
      .eq('email', email)
      .single();

    if (userError || !user) {
      console.log('[LOGIN] User not found or error', { userError: userError?.message, hasUser: !!user });
      return res.status(401).json({
        requestId: crypto.randomUUID(),
        errorCode: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({
        requestId: crypto.randomUUID(),
        errorCode: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    const token = generateToken({
      id: user.id,
      client_id: user.client_id,
      email: user.email,
      role: user.role,
    });
    setTokenCookie(res, token);

    await supabaseAdmin.from('audit_logs').insert({
      client_id: user.client_id,
      user_id: user.id,
      action: 'LOGIN',
      metadata_json: { email: user.email },
    });

    const client = Array.isArray(user.clients) ? user.clients[0] : user.clients;
    console.log('[LOGIN] Success, sending response', { userId: user.id });
    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        clientId: user.client_id,
        clientName: client?.name || '',
      },
    });
  } catch (error: any) {
    console.error('[LOGIN] Error caught:', error);
    console.error('[LOGIN] Error stack:', error?.stack);
    
    // Ensure response hasn't been sent
    if (!res.headersSent) {
      res.status(500).json({
        requestId: crypto.randomUUID(),
        errorCode: 'INTERNAL_ERROR',
        message: error?.message || 'Login failed',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      });
    } else {
      console.error('[LOGIN] Response already sent, cannot send error response');
    }
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
      .eq('id', req.user!.userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        requestId: crypto.randomUUID(),
        errorCode: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    const client = Array.isArray(user.clients) ? user.clients[0] : user.clients;
    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        clientId: user.client_id,
        clientName: client?.name || '',
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
      const { data: existing } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

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

      await supabaseAdmin.from('audit_logs').insert({
        client_id: clientId,
        user_id: req.user!.userId,
        action: 'INVITE_USER',
        metadata_json: { email, role, inviteToken },
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
  console.log('[REGISTER] Endpoint hit', { email: req.body?.email, hasClientName: !!req.body?.clientName });
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:234',message:'Register endpoint hit',data:{email:req.body?.email,hasClientName:!!req.body?.clientName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  try {
    const { email, password, inviteToken, clientName } = req.body;
    console.log('[REGISTER] Processing', { email });

    // Check if user already exists
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:239',message:'Checking existing user',data:{email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:245',message:'Existing user check result',data:{hasExisting:!!existing,existingError:existingError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

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
      const { data: client, error: clientError } = await supabaseAdmin
        .from('clients')
        .insert({ name: clientName })
        .select('id')
        .single();
      
      if (clientError || !client) {
        throw new Error('Failed to create client');
      }
      clientId = client.id;
    } else if (clientName) {
      // Create new client
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:277',message:'Creating client',data:{clientName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      const { data: client, error: clientError } = await supabaseAdmin
        .from('clients')
        .insert({ name: clientName })
        .select('id')
        .single();
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:283',message:'Client creation result',data:{hasClient:!!client,clientError:clientError?.message,clientId:client?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      if (clientError || !client) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:286',message:'Client creation failed',data:{clientError:clientError?.message,details:clientError},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        throw new Error('Failed to create client');
      }
      clientId = client.id;
    } else {
      return res.status(400).json({
        requestId: crypto.randomUUID(),
        errorCode: 'VALIDATION_ERROR',
        message: 'Either inviteToken or clientName is required',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        client_id: clientId,
        role: 'ADMIN', // First user is admin
      })
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
      .single();

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:318',message:'User creation result',data:{hasUser:!!user,userError:userError?.message,userId:user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    if (userError || !user) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:321',message:'User creation failed',data:{userError:userError?.message,details:userError},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      throw new Error('Failed to create user');
    }

    const token = generateToken({
      id: user.id,
      client_id: user.client_id,
      email: user.email,
      role: user.role,
    });
    setTokenCookie(res, token);

    const client = Array.isArray(user.clients) ? user.clients[0] : user.clients;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:335',message:'Sending success response',data:{userId:user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        clientId: user.client_id,
        clientName: client?.name || '',
      },
    });
  } catch (error: any) {
    console.error('[REGISTER] Error caught:', error);
    console.error('[REGISTER] Error stack:', error?.stack);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:348',message:'Register error caught',data:{errorMessage:error?.message,errorStack:error?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    // Ensure response hasn't been sent
    if (!res.headersSent) {
      res.status(500).json({
        requestId: crypto.randomUUID(),
        errorCode: 'INTERNAL_ERROR',
        message: error?.message || 'Registration failed',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      });
    } else {
      console.error('[REGISTER] Response already sent, cannot send error response');
    }
  }
});

export default router;
