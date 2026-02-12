import axios from 'axios';

const GEONAMES_USERNAME = process.env.GEONAMES_USERNAME;
const GEONAMES_BASE_URL = 'http://api.geonames.org';

// #region agent log
fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'geonames.ts:module-load',message:'GEONAMES_USERNAME env check',data:{username:GEONAMES_USERNAME,usernameType:typeof GEONAMES_USERNAME,hasUsername:!!GEONAMES_USERNAME,allEnvKeys:Object.keys(process.env).filter(k=>k.includes('GEONAMES')||k.includes('geonames')).join(',')},timestamp:Date.now(),runId:'debug-geonames-env',hypothesisId:'H1'})}).catch(()=>{});
// #endregion

interface Country {
  geonameId: number;
  countryCode: string;
  countryName: string;
}

interface State {
  geonameId: number;
  adminCode1: string;
  name: string;
  countryCode: string;
}

interface City {
  geonameId: number;
  name: string;
  adminCode1: string;
  countryCode: string;
  population: number;
  lat: string;
  lng: string;
}

interface PostalCode {
  postalCode: string;
  placeName: string;
  adminName1: string;
  adminCode1: string;
  countryCode: string;
  lat: number;
  lng: number;
}

// Request configuration with timeouts
const REQUEST_CONFIG = {
  timeout: 15000, // 15 seconds
  maxRedirects: 5,
};

// Cache with longer TTL (location data is stable)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

function getCached(key: string): any | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[GeoNames] Cache HIT: ${key}`);
    return cached.data;
  }
  if (cached) {
    console.log(`[GeoNames] Cache EXPIRED: ${key}`);
    cache.delete(key);
  }
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
  console.log(`[GeoNames] Cached: ${key} (${cache.size} items in cache)`);
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make GeoNames API request with retry logic and exponential backoff
 */
async function geonamesRequest<T>(
  endpoint: string,
  params: Record<string, any>,
  retries = 3
): Promise<T> {
  const url = `${GEONAMES_BASE_URL}${endpoint}`;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[GeoNames] Request attempt ${attempt}/${retries}: ${endpoint}`, params);
      
      const response = await axios.get(url, {
        params: {
          ...params,
          username: GEONAMES_USERNAME,
        },
        ...REQUEST_CONFIG,
      });

      console.log(`[GeoNames] Request successful: ${endpoint}`);
      return response.data;
      
    } catch (error: any) {
      const isLastAttempt = attempt === retries;
      
      console.error(
        `[GeoNames] Request failed (attempt ${attempt}/${retries}):`,
        error.code || error.message
      );

      if (isLastAttempt) {
        // Last attempt - throw error
        throw error;
      }

      // Check if error is retryable
      const isRetryable = 
        error.code === 'ECONNRESET' ||
        error.code === 'ECONNABORTED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.response?.status === 503 || // Service unavailable
        error.response?.status === 429;   // Rate limit

      if (!isRetryable) {
        // Non-retryable error (e.g., 401, 404) - throw immediately
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s... (max 10s)
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.log(`[GeoNames] Retrying in ${delayMs}ms...`);
      await sleep(delayMs);
    }
  }

  throw new Error('All retry attempts exhausted');
}

/**
 * Get all countries
 */
export async function getCountries(): Promise<Country[]> {
  const cacheKey = 'countries';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'geonames.ts:getCountries:before-api-call',message:'About to call GeoNames API',data:{username:GEONAMES_USERNAME,usernameType:typeof GEONAMES_USERNAME,url:`${GEONAMES_BASE_URL}/countryInfoJSON`},timestamp:Date.now(),runId:'debug-geonames-env',hypothesisId:'H2'})}).catch(()=>{});
  // #endregion

  try {
    const data = await geonamesRequest<any>('/countryInfoJSON', {});

    const countries = (data.geonames || []);
    
    // Filter to only include US and Canada
    const supportedCountryCodes = [
      'US', // United States
      'CA', // Canada
    ];

    const filteredCountries = countries
      .filter((c: any) => supportedCountryCodes.includes(c.countryCode))
      .map((c: any) => ({
        geonameId: c.geonameId,
        countryCode: c.countryCode,
        countryName: c.countryName,
      }))
      .sort((a: Country, b: Country) => a.countryName.localeCompare(b.countryName));

    setCache(cacheKey, filteredCountries);
    return filteredCountries;
  } catch (error: any) {
    console.error('[GeoNames] Error fetching countries:', error.message);
    
    // Return cached data even if expired, as fallback
    const expired = cache.get(cacheKey);
    if (expired) {
      console.log('[GeoNames] Using expired cache as fallback');
      return expired.data;
    }
    
    throw new Error('Failed to fetch countries');
  }
}

/**
 * Get states/provinces for a country
 */
export async function getStates(countryCode: string): Promise<State[]> {
  const cacheKey = `states_${countryCode}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const geonameId = await getCountryGeonameId(countryCode);
    
    const data = await geonamesRequest<any>('/childrenJSON', {
      geonameId: geonameId,
    });

    const states = (data.geonames || [])
      .map((s: any) => ({
        geonameId: s.geonameId,
        adminCode1: s.adminCode1 || s.adminCodes1?.ISO3166_2 || '',
        name: s.name,
        countryCode: s.countryCode,
      }))
      .sort((a: State, b: State) => a.name.localeCompare(b.name));

    setCache(cacheKey, states);
    return states;
  } catch (error: any) {
    console.error(`[GeoNames] Error fetching states for ${countryCode}:`, error.message);
    
    // Fallback to expired cache
    const expired = cache.get(cacheKey);
    if (expired) {
      console.log('[GeoNames] Using expired cache as fallback');
      return expired.data;
    }
    
    throw new Error('Failed to fetch states');
  }
}

/**
 * Get cities for a state
 */
export async function getCities(countryCode: string, adminCode1: string): Promise<City[]> {
  const cacheKey = `cities_${countryCode}_${adminCode1}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const data = await geonamesRequest<any>('/searchJSON', {
      country: countryCode,
      adminCode1: adminCode1,
      featureClass: 'P', // Populated places (cities)
      maxRows: 1000,
      orderby: 'population',
    });

    const cities = (data.geonames || [])
      .map((c: any) => ({
        geonameId: c.geonameId,
        name: c.name,
        adminCode1: c.adminCode1,
        countryCode: c.countryCode,
        population: c.population || 0,
        lat: c.lat,
        lng: c.lng,
      }))
      .sort((a: City, b: City) => b.population - a.population); // Sort by population desc

    setCache(cacheKey, cities);
    return cities;
  } catch (error: any) {
    console.error(`[GeoNames] Error fetching cities for ${countryCode}-${adminCode1}:`, error.message);
    
    // Fallback to expired cache
    const expired = cache.get(cacheKey);
    if (expired) {
      console.log('[GeoNames] Using expired cache as fallback');
      return expired.data;
    }
    
    throw new Error('Failed to fetch cities');
  }
}

/**
 * Get postal codes for a city
 */
export async function getPostalCodes(
  countryCode: string,
  adminCode1: string,
  placeName: string
): Promise<string[]> {
  const cacheKey = `postal_${countryCode}_${adminCode1}_${placeName}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const data = await geonamesRequest<any>('/postalCodeSearchJSON', {
      country: countryCode,
      adminCode1: adminCode1,
      placeName: placeName.trim(),
      maxRows: 100,
    });

    // Filter postal codes to only include those matching the exact city name
    // GeoNames API may return postal codes for nearby areas, so we filter strictly
    const normalizedPlaceName = placeName.trim().toLowerCase();
    const postalCodes: string[] = (data.postalCodes || [])
      .filter((p: any) => {
        // Match if placeName matches exactly (case-insensitive)
        const placeNameMatch = p.placeName?.toLowerCase() === normalizedPlaceName;
        // Also check adminName2 (city name) field
        const adminName2Match = p.adminName2?.toLowerCase() === normalizedPlaceName;
        return placeNameMatch || adminName2Match;
      })
      .map((p: any) => String(p.postalCode || ''))
      .filter((code: string) => code && code.trim() !== '');

    // Remove duplicates and sort
    const uniqueCodes = [...new Set(postalCodes)].sort();
    
    setCache(cacheKey, uniqueCodes);
    return uniqueCodes;
  } catch (error: any) {
    console.error('[GeoNames] Error fetching postal codes:', error.message);
    
    // Fallback to expired cache
    const expired = cache.get(cacheKey);
    if (expired) {
      console.log('[GeoNames] Using expired cache as fallback');
      return expired.data;
    }
    
    // Return empty array instead of throwing - allow manual entry
    return [];
  }
}

/**
 * Lookup location by postal code (reverse lookup)
 */
export async function lookupPostalCode(
  countryCode: string,
  postalCode: string
): Promise<PostalCode | null> {
  try {
    const data = await geonamesRequest<any>('/postalCodeLookupJSON', {
      postalcode: postalCode,
      country: countryCode,
    });

    const results = data.postalCodes || [];
    if (results.length > 0) {
      const result = results[0];
      return {
        postalCode: result.postalCode,
        placeName: result.placeName,
        adminName1: result.adminName1,
        adminCode1: result.adminCode1,
        countryCode: result.countryCode,
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lng),
      };
    }

    return null;
  } catch (error: any) {
    console.error('[GeoNames] Error looking up postal code:', error.message);
    return null;
  }
}

/**
 * Helper: Get country geonameId by country code
 */
async function getCountryGeonameId(countryCode: string): Promise<number> {
  const countries = await getCountries();
  const country = countries.find(c => c.countryCode === countryCode);
  if (!country) {
    throw new Error(`Country not found: ${countryCode}`);
  }
  return country.geonameId;
}
