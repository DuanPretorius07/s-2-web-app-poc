import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabaseClient.js';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { upsertContact } from '../services/hubspot.js';

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
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  inviteToken: z.string().optional(),
  clientName: z.string().min(1, 'Company name is required').optional(),
});

function isUnknownColumnError(err: any, columnName: string) {
  const msg = typeof err?.message === 'string' ? err.message : '';
  const code = typeof err?.code === 'string' ? err.code : '';
  // Postgres undefined_column is 42703; PostgREST may surface schema-cache messages.
  return code === '42703' || msg.toLowerCase().includes(columnName.toLowerCase());
}

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
      .select(`*, clients ( id, name )`)
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

    const client = Array.isArray((user as any).clients) ? (user as any).clients[0] : (user as any).clients;

    // Get rate tokens from client
    let rateTokensRemaining: number | null = null;
    let rateTokensUsed: number | null = null;
    if (client?.id) {
      const { data: clientData } = await supabaseAdmin
        .from('clients')
        .select('rate_tokens_remaining, rate_tokens_used')
        .eq('id', client.id)
        .single();
      rateTokensRemaining = clientData?.rate_tokens_remaining ?? 3;
      rateTokensUsed = clientData?.rate_tokens_used ?? 0;
    }

    // Sync to HubSpot asynchronously (non-blocking)
    upsertContact({
      email: user.email,
      firstname: (user as any).firstname || (user as any).first_name || '',
      lastname: (user as any).lastname || (user as any).last_name || '',
      company: client?.name || undefined,
    }).catch((err) => {
      console.error('[Login] HubSpot upsert failed (non-blocking):', err);
    });

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

    console.log('[LOGIN] Success, sending response', { userId: user.id });
    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        clientId: user.client_id,
        clientName: client?.name || '',
        firstName: (user as any).firstName || (user as any).firstname || (user as any).first_name || undefined,
        lastName: (user as any).lastName || (user as any).lastname || (user as any).last_name || undefined,
        rateTokensRemaining,
        rateTokensUsed,
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
          name,
          rate_tokens_remaining,
          rate_tokens_used
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
        rateTokensRemaining: client?.rate_tokens_remaining ?? 3,
        rateTokensUsed: client?.rate_tokens_used ?? 0,
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
  try {
    const { email, password, firstName, lastName, inviteToken, clientName } = req.body;

    // #region agent log
    ;(globalThis as any).fetch?.('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre-fix',
        hypothesisId: 'H1,H2,H3,H4',
        location: 'server/src/routes/auth.ts:register',
        message: 'register-start',
        data: {
          hasInviteToken: !!inviteToken,
          hasClientName: !!clientName,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    // Check if user already exists
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    // #region agent log
    ;(globalThis as any).fetch?.('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre-fix',
        hypothesisId: 'H2',
        location: 'server/src/routes/auth.ts:register',
        message: 'register-existing-check',
        data: {
          hasExisting: !!existing,
          hasExistingError: !!existingError,
          existingErrorMessage: existingError ? (existingError as any).message : undefined,
          existingErrorCode: existingError ? (existingError as any).code : undefined,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
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

      // #region agent log
      ;(globalThis as any).fetch?.('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'pre-fix',
          hypothesisId: 'H1',
          location: 'server/src/routes/auth.ts:register',
          message: 'register-client-insert-inviteToken',
          data: {
            hasClient: !!client,
            hasClientError: !!clientError,
            clientErrorMessage: clientError ? (clientError as any).message : undefined,
            clientErrorCode: clientError ? (clientError as any).code : undefined,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

      if (clientError || !client) {
        throw new Error('Failed to create client');
      }
      clientId = client.id;
    } else if (clientName) {
      // Create new client
      const { data: client, error: clientError } = await supabaseAdmin
        .from('clients')
        .insert({ name: clientName })
        .select('id')
        .single();

      // #region agent log
      ;(globalThis as any).fetch?.('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'pre-fix',
          hypothesisId: 'H1',
          location: 'server/src/routes/auth.ts:register',
          message: 'register-client-insert-noInviteToken',
          data: {
            hasClient: !!client,
            hasClientError: !!clientError,
            clientErrorMessage: clientError ? (clientError as any).message : undefined,
            clientErrorCode: clientError ? (clientError as any).code : undefined,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

      if (clientError || !client) {
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

    // #region agent log
    ;(globalThis as any).fetch?.('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre-fix',
        hypothesisId: 'H3',
        location: 'server/src/routes/auth.ts:register',
        message: 'register-before-bcrypt-hash',
        data: {
          hasPassword: typeof password === 'string' && password.length > 0,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    const passwordHash = await bcrypt.hash(password, 10);

    // #region agent log
    ;(globalThis as any).fetch?.('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre-fix',
        hypothesisId: 'H3',
        location: 'server/src/routes/auth.ts:register',
        message: 'register-after-bcrypt-hash',
        data: {
          hashLength: typeof passwordHash === 'string' ? passwordHash.length : null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    // Try camelCase columns (firstname/lastname) first, then fall back to snake_case (first_name/last_name)
    let user: any = null;
    let userError: any = null;

    const attemptInsert = async (mode: 'camel' | 'snake') => {
      const nameFields =
        mode === 'camel'
          ? { firstname: firstName, lastname: lastName }
          : { first_name: firstName, last_name: lastName };

      return await supabaseAdmin
        .from('users')
        .insert({
          email,
          ...nameFields,
          password_hash: passwordHash,
          client_id: clientId,
          role: 'ADMIN', // First user is admin
        })
        .select(`*, clients ( id, name )`)
        .single();
    };

    ({ data: user, error: userError } = await attemptInsert('camel'));
    if (userError && isUnknownColumnError(userError, 'firstname')) {
      ({ data: user, error: userError } = await attemptInsert('snake'));
    }

    console.log('=== USER INSERT RESULT ===');
    console.log('Has user:', !!user);
    console.log('Has error:', !!userError);
    if (userError) {
      console.error('User error (raw):', userError);
      try {
        console.error('User error (json):', JSON.stringify(userError, null, 2));
      } catch {}
    }
    console.log('========================');

    // #region agent log
    ;(globalThis as any).fetch?.('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre-fix',
        hypothesisId: 'H1,H2',
        location: 'server/src/routes/auth.ts:register',
        message: 'register-user-insert-result',
        data: {
          hasUser: !!user,
          hasUserError: !!userError,
          userErrorMessage: userError ? (userError as any).message : undefined,
          userErrorCode: userError ? (userError as any).code : undefined,
          userErrorDetails: userError ? (userError as any).details : undefined,
          userErrorHint: userError ? (userError as any).hint : undefined,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    if (userError || !user) {
      throw new Error(`Failed to create user: ${userError?.message || 'Unknown error'}`);
    }

    const token = generateToken({
      id: user.id,
      client_id: user.client_id,
      email: user.email,
      role: user.role,
    });
    setTokenCookie(res, token);

    const client = Array.isArray((user as any).clients) ? (user as any).clients[0] : (user as any).clients;

    // Sync to HubSpot asynchronously (non-blocking)
    upsertContact({
      email: user.email,
      firstname: firstName,
      lastname: lastName,
      company: client?.name || clientName || undefined,
    }).catch((err) => {
      console.error('[Register] HubSpot upsert failed (non-blocking):', err);
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        clientId: user.client_id,
        clientName: client?.name || '',
        firstName,
        lastName,
      },
    });
  } catch (error: any) {
    console.error('=== REGISTRATION ERROR ===');
    console.error('Error message:', error?.message);
    console.error('Error code:', error?.code);
    console.error('Error details:', error?.details);
    console.error('Error hint:', error?.hint);
    try {
      console.error('Full error object:', JSON.stringify(error, null, 2));
    } catch {
      console.error('Full error object: (non-serializable)', error);
    }
    console.error('Stack trace:', error?.stack);
    console.error('========================');
    
    // Ensure response hasn't been sent
    if (!res.headersSent) {
      res.status(500).json({
        requestId: crypto.randomUUID(),
        errorCode: 'INTERNAL_ERROR',
        message: 'Failed to create user',
        details: error?.message || 'Unknown error',
        supabaseError: error?.code || null,
      });
    } else {
      console.error('[REGISTER] Response already sent, cannot send error response');
    }
  }
});

/*
// Password reset removed - will be implemented in a future phase
// router.post('/forgot-password', ...);
// router.post('/reset-password', ...);
*/

export default router;
