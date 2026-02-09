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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ship2primusClient.ts:getShip2PrimusToken:cached',message:'Using cached token',data:{hasCachedToken:!!cachedToken,tokenExpiry:tokenExpiry,now:now,isValid:now<tokenExpiry},timestamp:Date.now(),runId:'debug-ship2primus',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    return cachedToken;
  }

  const loginUrl = process.env.SHIP2PRIMUS_LOGIN_URL;
  const username = process.env.SHIP2PRIMUS_USERNAME;
  const password = process.env.SHIP2PRIMUS_PASSWORD;

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ship2primusClient.ts:getShip2PrimusToken:entry',message:'Starting authentication',data:{hasLoginUrl:!!loginUrl,hasUsername:!!username,hasPassword:!!password,loginUrl:loginUrl},timestamp:Date.now(),runId:'debug-ship2primus',hypothesisId:'H1'})}).catch(()=>{});
  // #endregion

  if (!loginUrl || !username || !password) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ship2primusClient.ts:getShip2PrimusToken:missingConfig',message:'Missing auth config',data:{hasLoginUrl:!!loginUrl,hasUsername:!!username,hasPassword:!!password},timestamp:Date.now(),runId:'debug-ship2primus',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    throw new Error(
      'Ship2Primus authentication not configured. ' +
      'Please set SHIP2PRIMUS_LOGIN_URL, SHIP2PRIMUS_USERNAME, and SHIP2PRIMUS_PASSWORD in environment variables.'
    );
  }

  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ship2primusClient.ts:getShip2PrimusToken:beforeFetch',message:'About to call login API',data:{loginUrl:loginUrl,method:'POST',hasUsername:!!username},timestamp:Date.now(),runId:'debug-ship2primus',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion

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

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ship2primusClient.ts:getShip2PrimusToken:afterFetch',message:'Login API response received',data:{status:response.status,statusText:response.statusText,ok:response.ok,headers:Object.fromEntries(response.headers.entries())},timestamp:Date.now(),runId:'debug-ship2primus',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion

    if (!response.ok) {
      const errorText = await response.text();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ship2primusClient.ts:getShip2PrimusToken:loginFailed',message:'Login failed',data:{status:response.status,errorText:errorText.substring(0,500)},timestamp:Date.now(),runId:'debug-ship2primus',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      throw new Error(
        `Ship2Primus login failed with status ${response.status}: ${errorText}`
      );
    }

    const data = await response.json() as Ship2PrimusAuthResponse;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ship2primusClient.ts:getShip2PrimusToken:parsedResponse',message:'Parsed login response',data:{hasData:!!data,topLevelKeys:data?Object.keys(data):[],hasToken:!!data.token,hasAccessToken:!!data.access_token,hasAuthToken:!!data.authToken,hasNestedToken:!!(data as any)?.data?.accessToken},timestamp:Date.now(),runId:'debug-ship2primus',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion

    // Handle different possible response formats
    // Known formats:
    // - { token }
    // - { access_token }
    // - { authToken }
    // - { data: { accessToken } }  // Ship2Primus current login response
    const nestedAccessToken = (data as any)?.data?.accessToken;
    const token = data.token || data.access_token || data.authToken || nestedAccessToken;
    
    if (!token) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ship2primusClient.ts:getShip2PrimusToken:noToken',message:'No token in response',data:{responseKeys:Object.keys(data),fullResponse:JSON.stringify(data).substring(0,500)},timestamp:Date.now(),runId:'debug-ship2primus',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      throw new Error('No authentication token received from Ship2Primus API');
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ship2primusClient.ts:getShip2PrimusToken:success',message:'Token obtained successfully',data:{tokenLength:token.length,tokenPrefix:token.substring(0,20)+'...',tokenExpiry:now+TOKEN_CACHE_DURATION},timestamp:Date.now(),runId:'debug-ship2primus',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion

    // Cache the token
    cachedToken = token;
    tokenExpiry = now + TOKEN_CACHE_DURATION;

    return token;
  } catch (error: any) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ship2primusClient.ts:getShip2PrimusToken:catch',message:'Authentication exception',data:{errorName:error?.name,errorMessage:error?.message,errorCode:error?.code,errorCause:error?.cause?.code,hasStack:!!error?.stack},timestamp:Date.now(),runId:'debug-ship2primus',hypothesisId:'H1,H5'})}).catch(()=>{});
    // #endregion
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
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ship2primusClient.ts:ship2PrimusRequest:entry',message:'Starting API request',data:{url:url.substring(0,200),method:options.method||'GET',hasBody:!!options.body,urlLength:url.length},timestamp:Date.now(),runId:'debug-ship2primus',hypothesisId:'H1,H3,H4'})}).catch(()=>{});
  // #endregion

  const token = await getShip2PrimusToken();

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ship2primusClient.ts:ship2PrimusRequest:beforeFetch',message:'About to make fetch call',data:{url:url.substring(0,200),method:options.method||'GET',hasToken:!!token,tokenLength:token?.length,tokenPrefix:token?.substring(0,20)+'...',headers:Object.keys({...options.headers,'Content-Type':'application/json','Authorization':`Bearer ${token}`})},timestamp:Date.now(),runId:'debug-ship2primus',hypothesisId:'H1,H3'})}).catch(()=>{});
  // #endregion

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ship2primusClient.ts:ship2PrimusRequest:afterFetch',message:'Fetch completed',data:{status:response.status,statusText:response.statusText,ok:response.ok,headers:Object.fromEntries(response.headers.entries())},timestamp:Date.now(),runId:'debug-ship2primus',hypothesisId:'H1,H3,H4'})}).catch(()=>{});
    // #endregion

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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ship2primusClient.ts:ship2PrimusRequest:errorResponse',message:'Non-OK response',data:{status:response.status,statusText:response.statusText,errorText:errorText.substring(0,500)},timestamp:Date.now(),runId:'debug-ship2primus',hypothesisId:'H1,H4'})}).catch(()=>{});
    // #endregion
    throw new Error(
      `Ship2Primus API request failed with status ${response.status}: ${errorText}`
    );
  }

  const jsonData = await response.json() as T;
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ship2primusClient.ts:ship2PrimusRequest:success',message:'Request successful',data:{hasData:!!jsonData,topLevelKeys:jsonData?Object.keys(jsonData as any):[],dataType:typeof jsonData},timestamp:Date.now(),runId:'debug-ship2primus',hypothesisId:'H1,H3,H4'})}).catch(()=>{});
  // #endregion
  return jsonData;
  } catch (error: any) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ship2primusClient.ts:ship2PrimusRequest:catch',message:'Fetch exception',data:{errorName:error?.name,errorMessage:error?.message,errorCode:error?.code,errorCause:error?.cause?.code,errorCauseMessage:error?.cause?.message,isSocketError:error?.message?.includes('closed')||error?.code==='UND_ERR_SOCKET',hasStack:!!error?.stack},timestamp:Date.now(),runId:'debug-ship2primus',hypothesisId:'H1,H3,H5'})}).catch(()=>{});
    // #endregion
    throw error;
  }
}

/**
 * Clear cached authentication token (useful for testing or forced re-auth)
 */
export function clearShip2PrimusToken(): void {
  cachedToken = null;
  tokenExpiry = 0;
}
