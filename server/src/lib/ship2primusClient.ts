/**
 * Ship2Primus API Client
 * Handles authentication and API calls to Ship2Primus shipping services
 */

interface Ship2PrimusAuthResponse {
  token?: string;
  access_token?: string;
  authToken?: string;
  [key: string]: any;
}

let cachedToken: string | null = null;
let tokenExpiry: number = 0;
const TOKEN_CACHE_DURATION = 50 * 60 * 1000; // 50 minutes (refresh before 1 hour expiry)

/**
 * Authenticate with Ship2Primus API and get access token
 * Token is cached to avoid excessive login requests
 */
export async function getShip2PrimusToken(): Promise<string> {
  const now = Date.now();
  
  // Return cached token if still valid
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  const loginUrl = process.env.SHIP2PRIMUS_LOGIN_URL;
  const username = process.env.SHIP2PRIMUS_USERNAME;
  const password = process.env.SHIP2PRIMUS_PASSWORD;

  if (!loginUrl || !username || !password) {
    throw new Error(
      'Ship2Primus authentication not configured. ' +
      'Please set SHIP2PRIMUS_LOGIN_URL, SHIP2PRIMUS_USERNAME, and SHIP2PRIMUS_PASSWORD in environment variables.'
    );
  }

  try {
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Ship2Primus login failed with status ${response.status}: ${errorText}`
      );
    }

    const data = await response.json() as Ship2PrimusAuthResponse;

    // Handle different possible response formats
    // Known formats:
    // - { token }
    // - { access_token }
    // - { authToken }
    // - { data: { accessToken } }  // Ship2Primus current login response
    const nestedAccessToken = (data as any)?.data?.accessToken;
    const token = data.token || data.access_token || data.authToken || nestedAccessToken;
    
    if (!token) {
      throw new Error('No authentication token received from Ship2Primus API');
    }

    // Cache the token
    cachedToken = token;
    tokenExpiry = now + TOKEN_CACHE_DURATION;

    return token;
  } catch (error) {
    console.error('Ship2Primus authentication error:', error);
    throw error;
  }
}

/**
 * Make an authenticated request to Ship2Primus API
 */
export async function ship2PrimusRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getShip2PrimusToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        sessionId:'debug-session',
        runId:'pre-fix',
        hypothesisId:'H-AUTH-STATUS',
        location:'ship2primusClient.ts:ship2PrimusRequest:nonOk',
        message:'Ship2Primus non-OK HTTP status',
        data:{
          status:response.status,
          statusText:response.statusText
        },
        timestamp:Date.now()
      })
    }).catch(()=>{});
    // #endregion

    // If unauthorized, clear token cache and retry once
    if (response.status === 401 && cachedToken) {
      cachedToken = null;
      tokenExpiry = 0;
      const newToken = await getShip2PrimusToken();
      
      const retryResponse = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${newToken}`,
          ...options.headers,
        },
      });

      if (!retryResponse.ok) {
        const errorText = await retryResponse.text();
        throw new Error(
          `Ship2Primus API request failed with status ${retryResponse.status}: ${errorText}`
        );
      }

      return retryResponse.json() as T;
    }

    const errorText = await response.text();
    throw new Error(
      `Ship2Primus API request failed with status ${response.status}: ${errorText}`
    );
  }

  return response.json() as T;
}

/**
 * Clear cached authentication token (useful for testing or forced re-auth)
 */
export function clearShip2PrimusToken(): void {
  cachedToken = null;
  tokenExpiry = 0;
}
