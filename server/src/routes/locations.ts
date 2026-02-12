import express from 'express';
import {
  getCountries,
  getStates,
  getCities,
  getPostalCodes,
  lookupPostalCode,
} from '../services/geonames.js';

const router = express.Router();

// GET /api/locations/countries
router.get('/countries', async (req, res) => {
  try {
    const countries = await getCountries();
    res.json({ countries });
  } catch (error: any) {
    console.error('[Locations] Error fetching countries:', error);
    res.status(500).json({
      error: 'Failed to fetch countries',
      message: error.message,
    });
  }
});

// GET /api/locations/states?country=US
router.get('/states', async (req, res) => {
  try {
    const { country } = req.query;
    
    if (!country || typeof country !== 'string') {
      return res.status(400).json({ error: 'Country code is required' });
    }

    const states = await getStates(country);
    res.json({ states });
  } catch (error: any) {
    console.error('[Locations] Error fetching states:', error);
    res.status(500).json({
      error: 'Failed to fetch states',
      message: error.message,
    });
  }
});

// GET /api/locations/cities?country=US&state=CA
router.get('/cities', async (req, res) => {
  try {
    const { country, state } = req.query;
    
    if (!country || typeof country !== 'string') {
      return res.status(400).json({ error: 'Country code is required' });
    }
    
    if (!state || typeof state !== 'string') {
      return res.status(400).json({ error: 'State code is required' });
    }

    const cities = await getCities(country, state);
    res.json({ cities });
  } catch (error: any) {
    console.error('[Locations] Error fetching cities:', error);
    res.status(500).json({
      error: 'Failed to fetch cities',
      message: error.message,
    });
  }
});

// GET /api/locations/postal-codes?country=US&state=CA&city=Los Angeles
router.get('/postal-codes', async (req, res) => {
  try {
    const { country, state, city } = req.query;
    
    if (!country || typeof country !== 'string') {
      return res.status(400).json({ error: 'Country code is required' });
    }
    
    if (!state || typeof state !== 'string') {
      return res.status(400).json({ error: 'State code is required' });
    }
    
    if (!city || typeof city !== 'string') {
      return res.status(400).json({ error: 'City name is required' });
    }

    const postalCodes = await getPostalCodes(country, state, city);
    res.json({ postalCodes });
  } catch (error: any) {
    console.error('[Locations] Error fetching postal codes:', error);
    res.status(500).json({
      error: 'Failed to fetch postal codes',
      message: error.message,
    });
  }
});

// GET /api/locations/lookup?country=US&postalCode=90210
router.get('/lookup', async (req, res) => {
  try {
    const { country, postalCode } = req.query;
    
    if (!country || typeof country !== 'string') {
      return res.status(400).json({ error: 'Country code is required' });
    }
    
    if (!postalCode || typeof postalCode !== 'string') {
      return res.status(400).json({ error: 'Postal code is required' });
    }

    const location = await lookupPostalCode(country, postalCode);
    
    if (!location) {
      return res.status(404).json({ error: 'Postal code not found' });
    }
    
    res.json({ location });
  } catch (error: any) {
    console.error('[Locations] Error looking up postal code:', error);
    res.status(500).json({
      error: 'Failed to lookup postal code',
      message: error.message,
    });
  }
});

export default router;
