import axios from 'axios';

const API_BASE = '/api/locations';

export interface Country {
  geonameId: number;
  countryCode: string;
  countryName: string;
}

export interface State {
  geonameId: number;
  adminCode1: string;
  name: string;
  countryCode: string;
}

export interface City {
  geonameId: number;
  name: string;
  adminCode1: string;
  countryCode: string;
  population: number;
  lat: string;
  lng: string;
}

export interface PostalCodeLocation {
  postalCode: string;
  placeName: string;
  adminName1: string;
  adminCode1: string;
  countryCode: string;
  lat: number;
  lng: number;
}

/**
 * Fetch with retry logic
 */
async function fetchWithRetry<T>(
  fetchFn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetchFn();
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error);
      
      if (i === retries - 1) {
        // Last attempt failed
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
  
  throw new Error('All retry attempts failed');
}

/**
 * Fetch all supported countries (with retry)
 */
export async function fetchCountries(): Promise<Country[]> {
  return fetchWithRetry(async () => {
    try {
      const response = await axios.get(`${API_BASE}/countries`, {
        timeout: 10000, // 10 second timeout
      });
      
      if (!response.data || !response.data.countries) {
        throw new Error('Invalid response format from countries endpoint');
      }
      
      return response.data.countries;
    } catch (error: any) {
      console.error('Error fetching countries:', error);
      
      if (error.code === 'ECONNABORTED') {
        throw new Error('Request timed out. Please check your internet connection.');
      } else if (error.response?.status === 500) {
        throw new Error('Server error. Please try again later.');
      } else if (!navigator.onLine) {
        throw new Error('No internet connection. Please check your network.');
      }
      
      throw new Error('Failed to load countries. Please refresh the page or try again later.');
    }
  }, 3, 1000); // 3 retries with 1s initial delay
}

/**
 * Fetch states/provinces for a country (with retry)
 */
export async function fetchStates(countryCode: string): Promise<State[]> {
  return fetchWithRetry(async () => {
    try {
      const response = await axios.get(`${API_BASE}/states`, {
        params: { country: countryCode },
        timeout: 10000,
      });
      
      if (!response.data || !response.data.states) {
        throw new Error('Invalid response format from states endpoint');
      }
      
      return response.data.states;
    } catch (error: any) {
      console.error('Error fetching states:', error);
      
      if (error.code === 'ECONNABORTED') {
        throw new Error('Request timed out. Please check your internet connection.');
      } else if (error.response?.status === 500) {
        throw new Error('Server error. Please try again later.');
      } else if (!navigator.onLine) {
        throw new Error('No internet connection. Please check your network.');
      }
      
      throw new Error('Failed to load states. Please refresh the page or try again later.');
    }
  }, 3, 1000);
}

/**
 * Fetch cities for a state (with retry)
 */
export async function fetchCities(
  countryCode: string,
  stateCode: string
): Promise<City[]> {
  return fetchWithRetry(async () => {
    try {
      const response = await axios.get(`${API_BASE}/cities`, {
        params: {
          country: countryCode,
          state: stateCode,
        },
        timeout: 10000,
      });
      
      if (!response.data || !response.data.cities) {
        throw new Error('Invalid response format from cities endpoint');
      }
      
      return response.data.cities;
    } catch (error: any) {
      console.error('Error fetching cities:', error);
      
      if (error.code === 'ECONNABORTED') {
        throw new Error('Request timed out. Please check your internet connection.');
      } else if (error.response?.status === 500) {
        throw new Error('Server error. Please try again later.');
      } else if (!navigator.onLine) {
        throw new Error('No internet connection. Please check your network.');
      }
      
      throw new Error('Failed to load cities. Please refresh the page or try again later.');
    }
  }, 3, 1000);
}

/**
 * Fetch postal codes for a city (with retry)
 */
export async function fetchPostalCodes(
  countryCode: string,
  stateCode: string,
  cityName: string
): Promise<string[]> {
  return fetchWithRetry(async () => {
    try {
      const response = await axios.get(`${API_BASE}/postal-codes`, {
        params: {
          country: countryCode,
          state: stateCode,
          city: cityName,
        },
        timeout: 10000,
      });
      
      if (!response.data || !response.data.postalCodes) {
        return [];
      }
      
      return response.data.postalCodes;
    } catch (error: any) {
      console.error('Error fetching postal codes:', error);
      
      // Return empty array instead of throwing for postal codes (graceful degradation)
      if (error.code === 'ECONNABORTED' || error.response?.status === 500 || !navigator.onLine) {
        return [];
      }
      
      return [];
    }
  }, 2, 1000); // Fewer retries for postal codes since we return empty array on failure
}

/**
 * Lookup location by postal code
 */
export async function lookupPostalCode(
  countryCode: string,
  postalCode: string
): Promise<PostalCodeLocation | null> {
  try {
    const response = await axios.get(`${API_BASE}/lookup`, {
      params: {
        country: countryCode,
        postalCode: postalCode,
      },
    });
    return response.data.location;
  } catch (error) {
    console.error('Error looking up postal code:', error);
    return null;
  }
}
