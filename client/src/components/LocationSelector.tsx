import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import {
  Country,
  State,
  City,
  fetchCountries,
  fetchStates,
  fetchCities,
  fetchPostalCodes,
} from '../services/locationService';

interface LocationValue {
  country: string;
  countryName: string;
  state: string;
  stateName: string;
  city: string;
  zipCode: string;
}

interface LocationSelectorProps {
  label: string;
  value: LocationValue;
  onChange: (location: LocationValue) => void;
  errors?: {
    country?: string;
    state?: string;
    city?: string;
    zipCode?: string;
  };
}

export default function LocationSelector({
  label,
  value,
  onChange,
  errors = {},
}: LocationSelectorProps) {
  // Data states
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [postalCodes, setPostalCodes] = useState<string[]>([]);

  // Loading states
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingPostalCodes, setLoadingPostalCodes] = useState(false);

  // Manual entry state
  const [manualZipEntry, setManualZipEntry] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Load countries on mount
  useEffect(() => {
    setLoadingCountries(true);
    setError(null);
    fetchCountries()
      .then(setCountries)
      .catch(err => {
        console.error('Failed to load countries:', err);
        const errorMessage = err.message || 'Failed to load countries';
        setError(errorMessage);
      })
      .finally(() => setLoadingCountries(false));
  }, []);

  // Load states when country changes
  useEffect(() => {
    if (value.country) {
      setLoadingStates(true);
      fetchStates(value.country)
        .then(setStates)
        .catch(err => {
          console.error('Failed to load states:', err);
          setStates([]);
        })
        .finally(() => setLoadingStates(false));
    } else {
      setStates([]);
    }

    // Reset dependent fields
    setCities([]);
    setPostalCodes([]);
  }, [value.country]);

  // Load cities when state changes
  useEffect(() => {
    if (value.country && value.state) {
      setLoadingCities(true);
      fetchCities(value.country, value.state)
        .then(setCities)
        .catch(err => {
          console.error('Failed to load cities:', err);
          setCities([]);
        })
        .finally(() => setLoadingCities(false));
    } else {
      setCities([]);
    }

    // Reset dependent fields
    setPostalCodes([]);
  }, [value.country, value.state]);

  // Load postal codes when city changes
  useEffect(() => {
    if (value.country && value.state && value.city) {
      setLoadingPostalCodes(true);
      fetchPostalCodes(value.country, value.state, value.city)
        .then(codes => {
          setPostalCodes(codes);
          
          // Auto-fill if only one postal code and zipCode is empty
          if (codes.length === 1 && !value.zipCode) {
            onChange({
              ...value,
              zipCode: codes[0],
            });
            setManualZipEntry(false);
          } else if (codes.length === 0) {
            // No postal codes found - enable manual entry
            setManualZipEntry(true);
          }
        })
        .catch(err => {
          console.error('Failed to load postal codes:', err);
          setPostalCodes([]);
          setManualZipEntry(true);
        })
        .finally(() => setLoadingPostalCodes(false));
    } else {
      setPostalCodes([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.country, value.state, value.city]);

  // Handlers
  const handleCountryChange = (option: any) => {
    const selectedCountry = countries.find(c => c.countryCode === option?.value);
    onChange({
      country: option?.value || '',
      countryName: selectedCountry?.countryName || '',
      state: '',
      stateName: '',
      city: '',
      zipCode: '',
    });
  };

  const handleStateChange = (option: any) => {
    const selectedState = states.find(s => s.adminCode1 === option?.value);
    onChange({
      ...value,
      state: option?.value || '',
      stateName: selectedState?.name || '',
      city: '',
      zipCode: '',
    });
  };

  const handleCityChange = (option: any) => {
    onChange({
      ...value,
      city: option?.value || '',
      zipCode: '',
    });
  };

  const handleZipCodeChange = (option: any) => {
    onChange({
      ...value,
      zipCode: option?.value || '',
    });
  };

  const handleManualZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...value,
      zipCode: e.target.value,
    });
  };

  // Convert data to react-select options
  const countryOptions = countries.map(c => ({
    value: c.countryCode,
    label: c.countryName,
  }));

  const stateOptions = states.map(s => ({
    value: s.adminCode1,
    label: s.name,
  }));

  const cityOptions = cities.map(c => ({
    value: c.name,
    label: c.name,
  }));

  const zipOptions = postalCodes.map(zip => ({
    value: zip,
    label: zip,
  }));

  // Custom styles for react-select
  const customStyles = {
    control: (base: any, state: any) => ({
      ...base,
      minHeight: '42px',
      borderColor: state.isFocused
        ? '#3B82F6'
        : errors.country || errors.state || errors.city || errors.zipCode
        ? '#EF4444'
        : '#D1D5DB',
      boxShadow: state.isFocused ? '0 0 0 1px #3B82F6' : 'none',
      '&:hover': {
        borderColor: state.isFocused ? '#3B82F6' : '#9CA3AF',
      },
    }),
    menu: (base: any) => ({
      ...base,
      zIndex: 9999,
    }),
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">{label}</h3>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
          <p className="text-red-800 font-semibold">Error loading location data</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-red-700 underline hover:text-red-900"
          >
            Refresh page
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Country */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Country *
          </label>
          <Select
            options={countryOptions}
            value={
              value.country
                ? { value: value.country, label: value.countryName }
                : null
            }
            onChange={handleCountryChange}
            styles={customStyles}
            placeholder="Select or search country..."
            isClearable
            isLoading={loadingCountries}
            isDisabled={loadingCountries}
            isSearchable
          />
          {errors.country && (
            <p className="text-red-500 text-sm mt-1">{errors.country}</p>
          )}
        </div>

        {/* State/Province */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {value.country === 'CA' ? 'Province' : 'State'} *
          </label>
          <Select
            options={stateOptions}
            value={
              value.state
                ? { value: value.state, label: value.stateName }
                : null
            }
            onChange={handleStateChange}
            styles={customStyles}
            placeholder={
              value.country
                ? 'Select or search state...'
                : 'Select country first'
            }
            isClearable
            isLoading={loadingStates}
            isDisabled={!value.country || loadingStates}
            isSearchable
            noOptionsMessage={() =>
              loadingStates ? 'Loading...' : 'No states found'
            }
          />
          {errors.state && (
            <p className="text-red-500 text-sm mt-1">{errors.state}</p>
          )}
        </div>

        {/* City */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            City *
          </label>
          <Select
            options={cityOptions}
            value={value.city ? { value: value.city, label: value.city } : null}
            onChange={handleCityChange}
            styles={customStyles}
            placeholder={
              loadingCities
                ? 'Loading cities...'
                : value.state
                ? 'Select or search city...'
                : 'Select state first'
            }
            isClearable
            isLoading={loadingCities}
            isDisabled={!value.state || loadingCities}
            isSearchable
            noOptionsMessage={() =>
              loadingCities ? 'Loading...' : 'No cities found'
            }
          />
          {errors.city && (
            <p className="text-red-500 text-sm mt-1">{errors.city}</p>
          )}
          {cities.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {cities.length} cities available (sorted by population)
            </p>
          )}
        </div>

        {/* ZIP/Postal Code */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ZIP/Postal Code *
          </label>

          {manualZipEntry ? (
            <div>
              <input
                type="text"
                value={value.zipCode}
                onChange={handleManualZipChange}
                className={`w-full border rounded px-3 py-2 ${
                  errors.zipCode ? 'border-red-500' : 'border-gray-300'
                } focus:border-blue-500 focus:ring-1 focus:ring-blue-500`}
                placeholder="Enter ZIP/postal code"
              />
              {postalCodes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setManualZipEntry(false)}
                  className="text-xs text-blue-600 hover:underline mt-1"
                >
                  ← Use dropdown selection
                </button>
              )}
            </div>
          ) : postalCodes.length > 1 ? (
            <div>
              <Select
                options={zipOptions}
                value={
                  value.zipCode
                    ? { value: value.zipCode, label: value.zipCode }
                    : null
                }
                onChange={handleZipCodeChange}
                styles={customStyles}
                placeholder="Select ZIP code..."
                isClearable
                isLoading={loadingPostalCodes}
                isDisabled={!value.city || loadingPostalCodes}
                isSearchable
              />
              <button
                type="button"
                onClick={() => setManualZipEntry(true)}
                className="text-xs text-blue-600 hover:underline mt-1"
              >
                Enter manually →
              </button>
            </div>
          ) : postalCodes.length === 1 && value.zipCode ? (
            <div>
              <div className="relative">
                <input
                  type="text"
                  value={value.zipCode}
                  readOnly
                  className={`w-full border rounded px-3 py-2 bg-green-50 border-green-300 pr-20 ${
                    errors.zipCode ? 'border-red-500' : ''
                  }`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-600 font-semibold">
                  Auto-filled
                </span>
              </div>
              <button
                type="button"
                onClick={() => setManualZipEntry(true)}
                className="text-xs text-blue-600 hover:underline mt-1"
              >
                Edit manually →
              </button>
            </div>
          ) : (
            <div>
              <input
                type="text"
                value={value.zipCode}
                onChange={handleManualZipChange}
                className={`w-full border rounded px-3 py-2 ${
                  errors.zipCode ? 'border-red-500' : 'border-gray-300'
                } focus:border-blue-500 focus:ring-1 focus:ring-blue-500`}
                placeholder={loadingPostalCodes ? 'Loading...' : 'Enter ZIP code'}
                disabled={loadingPostalCodes}
              />
            </div>
          )}

          {errors.zipCode && (
            <p className="text-red-500 text-sm mt-1">{errors.zipCode}</p>
          )}
        </div>
      </div>

      {/* Loading indicator */}
      {(loadingCountries || loadingStates || loadingCities || loadingPostalCodes) && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>
            Loading{' '}
            {loadingCountries
              ? 'countries'
              : loadingStates
              ? 'states'
              : loadingCities
              ? 'cities'
              : 'postal codes'}
            ...
          </span>
        </div>
      )}
    </div>
  );
}
