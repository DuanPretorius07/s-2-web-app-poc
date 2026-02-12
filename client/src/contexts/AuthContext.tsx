import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'USER';
  clientId: string;
  clientName: string;
  firstName?: string;
  lastName?: string;
  // Remaining rate search tokens for this account (server source of truth)
  rateTokensRemaining?: number | null;
  // Total consumed rate search tokens
  rateTokensUsed?: number | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    companyName?: string;
    hubspotOptIn: boolean;
  }) => Promise<void>;
  // Allow pages (e.g. rates) to update token counts after a successful search
  updateRateTokens: (remaining: number | null | undefined, used: number | null | undefined) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.tsx:checkAuth:start',message:'Starting auth check',data:{timestamp:Date.now()},timestamp:Date.now(),runId:'debug-blank-screen',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.tsx:checkAuth:response',message:'Auth check response received',data:{status:response.status,ok:response.ok,statusText:response.statusText},timestamp:Date.now(),runId:'debug-blank-screen',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      if (response.ok) {
        const data = await response.json();
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.tsx:checkAuth:success',message:'Auth check successful',data:{hasUser:!!data.user,userEmail:data.user?.email},timestamp:Date.now(),runId:'debug-blank-screen',hypothesisId:'H1'})}).catch(()=>{});
        // #endregion
        setUser(data.user);
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.tsx:checkAuth:notOk',message:'Auth check failed - not authenticated',data:{status:response.status,statusText:response.statusText},timestamp:Date.now(),runId:'debug-blank-screen',hypothesisId:'H1'})}).catch(()=>{});
        // #endregion
      }
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.tsx:checkAuth:error',message:'Auth check exception',data:{errorName:error?.name,errorMessage:error?.message,errorStack:error?.stack?.substring(0,500)},timestamp:Date.now(),runId:'debug-blank-screen',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      console.error('Auth check failed:', error);
    } finally {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.tsx:checkAuth:finally',message:'Auth check complete - setting loading to false',data:{timestamp:Date.now()},timestamp:Date.now(),runId:'debug-blank-screen',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    // Get response as text first to handle non-JSON responses
    const responseText = await response.text();

    if (!response.ok) {
      let error;
      try {
        error = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Login failed with status ${response.status}: ${responseText || 'No response body'}`);
      }
      throw new Error(error.message || 'Login failed');
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Failed to parse response: ${responseText || 'Empty response'}`);
    }
    setUser(data.user);
  }

  async function logout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    setUser(null);
  }

  async function register(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    companyName?: string;
    hubspotOptIn: boolean;
  }) {
    const { email, password, firstName, lastName, companyName, hubspotOptIn } = input;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.tsx:70',message:'Register request start',data:{email,hasCompanyName:!!companyName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email,
        password,
        firstName,
        lastName,
        clientName: companyName,
        hubspotOptIn,
      }),
    });

    // #region agent log
    const responseText = await response.text();
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.tsx:80',message:'Register response received',data:{status:response.status,ok:response.ok,hasBody:!!responseText,bodyLength:responseText.length,bodyPreview:responseText.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    if (!response.ok) {
      let error;
      try {
        error = JSON.parse(responseText);
      } catch (e) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.tsx:88',message:'JSON parse error on error response',data:{status:response.status,responseText,parseError:e},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        throw new Error(`Registration failed with status ${response.status}: ${responseText || 'No response body'}`);
      }
      // Preserve structured error information for better error handling
      const errorMessage = error.errorCode === 'VALIDATION_ERROR' && error.errors
        ? `VALIDATION_ERROR: ${JSON.stringify(error)}`
        : error.message || 'Registration failed';
      const err = new Error(errorMessage);
      (err as any).errorData = error;
      throw err;
    }

    let data;
    try {
      data = JSON.parse(responseText);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.tsx:98',message:'Register success',data:{hasUser:!!data.user},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    } catch (e) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.tsx:102',message:'JSON parse error on success response',data:{status:response.status,responseText,parseError:e},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      throw new Error(`Failed to parse response: ${responseText || 'Empty response'}`);
    }
    setUser(data.user);
  }

  // Centralized helper so pages can update token counts while keeping server as source of truth
  function updateRateTokens(remaining: number | null | undefined, used: number | null | undefined) {
    setUser((prev) =>
      prev
        ? {
            ...prev,
            rateTokensRemaining: typeof remaining === 'number' ? remaining : prev.rateTokensRemaining ?? remaining ?? null,
            rateTokensUsed: typeof used === 'number' ? used : prev.rateTokensUsed ?? used ?? null,
          }
        : prev
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, updateRateTokens }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
