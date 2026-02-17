import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

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
  // Token expiration state
  tokenExpired: boolean;
  setTokenExpired: (expired: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenExpired, setTokenExpired] = useState(false);
  const isLoggingOutRef = useRef<boolean>(false);

  useEffect(() => {
    // Only check auth on mount - no periodic checking
    // Token expiration is handled by API calls returning 401 with TOKEN_EXPIRED error code
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setTokenExpired(false);
      } else if (response.status === 401) {
        // Token expired or invalid - check for TOKEN_EXPIRED error code
        try {
          const errorData = await response.json();
          if (errorData.errorCode === 'TOKEN_EXPIRED') {
            // Only show modal if we're not on login page and not logging out
            const isOnLoginPage = window.location.pathname === '/login';
            setUser(null);
            if (!isOnLoginPage && !isLoggingOutRef.current) {
              setTokenExpired(true);
            }
          } else {
            // Other 401 errors - just clear user
            setUser(null);
            setTokenExpired(false);
          }
        } catch (e) {
          // Can't parse error - just clear user
          setUser(null);
          setTokenExpired(false);
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
      // Don't show expiration modal on network errors
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.tsx:login',message:'Login started',data:{email,isLoggingOut:isLoggingOutRef.current},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    
    // Clear any existing token state before login
    setUser(null);
    setTokenExpired(false);
    isLoggingOutRef.current = false; // Reset logout flag
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.tsx:login',message:'Login response received',data:{status:response.status,ok:response.ok,headersSent:response.headersSent},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      // Get response as text first to handle non-JSON responses
      const responseText = await response.text();

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.tsx:login',message:'Login response text parsed',data:{responseTextLength:responseText.length,responseTextPreview:responseText.substring(0,200)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      if (!response.ok) {
        let error;
        try {
          error = JSON.parse(responseText);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.tsx:login',message:'Login error parsed',data:{errorCode:error.errorCode,message:error.message,status:response.status},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
        } catch (e) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.tsx:login',message:'Login error JSON parse failed',data:{status:response.status,responseText,parseError:e},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          throw new Error(`Login failed with status ${response.status}: ${responseText || 'No response body'}`);
        }
        throw new Error(error.message || 'Login failed');
      }

      let data;
      try {
        data = JSON.parse(responseText);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.tsx:login',message:'Login success',data:{hasUser:!!data.user,userId:data.user?.id},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      } catch (e) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.tsx:login',message:'Login success JSON parse failed',data:{status:response.status,responseText,parseError:e},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        throw new Error(`Failed to parse response: ${responseText || 'Empty response'}`);
      }
      
      // Set user and reset token expiration state
      setUser(data.user);
      setTokenExpired(false);
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.tsx:login',message:'Login exception caught',data:{errorMessage:error?.message,errorName:error?.name,hasStack:!!error?.stack},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      throw error; // Re-throw to be handled by Login component
    }
  }

  async function logout() {
    // Set logout flag FIRST to prevent any token expiration checks from interfering
    isLoggingOutRef.current = true;
    
    // Explicitly clear token expiration state FIRST to prevent modal from showing
    setTokenExpired(false);
    
    try {
      // Always try to logout, even if token is expired
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      // Ignore errors - we still want to clear local state
      console.log('[Auth] Logout API call failed (non-critical):', error);
    } finally {
      // Always clear local state regardless of API call success
      setUser(null);
      // Ensure token expiration is cleared (redundant but safe)
      setTokenExpired(false);
      // Reset logout flag after cleanup
      isLoggingOutRef.current = false;
    }
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
    
    // Clear any existing token state before registration
    setUser(null);
    setTokenExpired(false);
    
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
    setTokenExpired(false);
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
    <AuthContext.Provider value={{ user, loading, login, logout, register, updateRateTokens, tokenExpired, setTokenExpired }}>
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
