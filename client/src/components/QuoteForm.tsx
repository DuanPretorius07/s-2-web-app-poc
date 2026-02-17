import { useState, type FormEvent, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ContactS2Message from './ContactS2Message';
import LocationSelector from './LocationSelector';
import RatesModal from './RatesModal';
import BookingConfirmation from './BookingConfirmation';
import RateTokensUsedNotification from './RateTokensUsedNotification';

interface LocationValue {
  country: string;
  countryName: string;
  state: string;
  stateName: string;
  city: string;
  zipCode: string;
}

interface QuoteFormData {
  origin: LocationValue;
  destination: LocationValue;
  pickupDate: string;
  freightType: string;
  packagingType: string;
  quantity: number;
  length: string;
  width: string;
  height: string;
  weight: string;
  stackable: string;
  stacks: string;
  hazmat: string;
}

interface RateResult {
  id: string;
  rateId?: string;
  name?: string;
  carrierName: string;
  serviceName: string;
  transitDays?: number;
  totalCost: number;
  currency: string;
  iconUrl?: string;
  booked?: boolean;
}

// Match backend API expectations
const FREIGHT_TYPES = [
  { value: 'LTL', label: 'LTL' },
  { value: 'GUARANTEED', label: 'Guaranteed' },
  { value: 'SP', label: 'Small Package' },
  { value: 'VOL', label: 'Volume' },
  { value: 'AIR', label: 'Air' },
];

const PACKAGING_TYPES = [
  { value: 'PLT', label: 'Pallet' },
  { value: 'CTN', label: 'Carton' },
  { value: 'DRM', label: 'Drum' },
];

export default function QuoteForm() {
  const { user, updateRateTokens, setTokenExpired } = useAuth();
  const [formData, setFormData] = useState<QuoteFormData>({
    origin: {
      country: 'US',
      countryName: 'United States',
      state: '',
      stateName: '',
      city: '',
      zipCode: '',
    },
    destination: {
      country: 'US',
      countryName: 'United States',
      state: '',
      stateName: '',
      city: '',
      zipCode: '',
    },
    pickupDate: '',
    freightType: '',
    packagingType: 'PLT',
    quantity: 1,
    length: '',
    width: '',
    height: '',
    weight: '',
    stackable: 'No',
    stacks: '1',
    hazmat: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showHazmatWarning, setShowHazmatWarning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rates, setRates] = useState<RateResult[]>([]);
  const [contactReason, setContactReason] = useState<
    'rate_limit' | 'hazmat' | 'error' | 'no_rates' | null
  >(null);
  const [generalMessage, setGeneralMessage] = useState<string | undefined>(undefined);
  const [bookingState, setBookingState] = useState<{
    status: 'idle' | 'booking' | 'success' | 'error';
    bookingId?: string;
    confirmationNumber?: string;
    error?: string;
  }>({ status: 'idle' });
  const [showRatesModal, setShowRatesModal] = useState(false);
  const [formHasChanged, setFormHasChanged] = useState(false);
  const [showTokensNotification, setShowTokensNotification] = useState(false);
  const [tokensNotificationData, setTokensNotificationData] = useState<{
    remaining: number | null;
    used: number | null;
  } | null>(null);

  // Track form changes to reset button state
  useEffect(() => {
    // When form changes, mark as changed (this will reset button to "Get Rates")
    if (rates.length > 0) {
      setFormHasChanged(true);
    }
  }, [
    formData.origin.country,
    formData.origin.state,
    formData.origin.city,
    formData.origin.zipCode,
    formData.destination.country,
    formData.destination.state,
    formData.destination.city,
    formData.destination.zipCode,
    formData.pickupDate,
    formData.freightType,
    formData.packagingType,
    formData.quantity,
    formData.length,
    formData.width,
    formData.height,
    formData.weight,
    formData.stackable,
    formData.hazmat,
  ]);

  // Reset rates when form changes
  useEffect(() => {
    if (formHasChanged && rates.length > 0) {
      setRates([]);
      setShowRatesModal(false);
      setBookingState({ status: 'idle' });
      setFormHasChanged(false); // Reset flag after clearing rates
    }
  }, [formHasChanged]);

  const handleChange = (field: keyof QuoteFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    // Show hazmat warning if hazmat is selected
    if (field === 'hazmat' && value === 'Yes') {
      setShowHazmatWarning(true);
    } else if (field === 'hazmat' && value !== 'Yes') {
      setShowHazmatWarning(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.origin.country) newErrors['origin.country'] = 'Origin country is required';
    if (!formData.origin.state) newErrors['origin.state'] = 'Origin state is required';
    if (!formData.origin.city.trim()) newErrors['origin.city'] = 'Origin city is required';
    if (!formData.origin.zipCode.trim()) newErrors['origin.zipCode'] = 'Origin ZIP code is required';
    if (!formData.destination.country) newErrors['destination.country'] = 'Destination country is required';
    if (!formData.destination.state) newErrors['destination.state'] = 'Destination state is required';
    if (!formData.destination.city.trim()) newErrors['destination.city'] = 'Destination city is required';
    if (!formData.destination.zipCode.trim()) newErrors['destination.zipCode'] = 'Destination ZIP code is required';
    if (!formData.pickupDate) newErrors.pickupDate = 'Pickup date is required';

    // Date must be today or future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(formData.pickupDate);
    if (formData.pickupDate && selectedDate < today) {
      newErrors.pickupDate = 'Pickup date must be today or in the future';
    }

    if (formData.quantity < 1) newErrors.quantity = 'Quantity must be at least 1';
    
    const lengthNum = parseFloat(formData.length);
    const widthNum = parseFloat(formData.width);
    const heightNum = parseFloat(formData.height);
    const weightNum = parseFloat(formData.weight);
    
    if (!formData.length || isNaN(lengthNum) || lengthNum <= 0) newErrors.length = 'Length must be greater than 0';
    if (!formData.width || isNaN(widthNum) || widthNum <= 0) newErrors.width = 'Width must be greater than 0';
    if (!formData.height || isNaN(heightNum) || heightNum <= 0) newErrors.height = 'Height must be greater than 0';
    if (!formData.weight || isNaN(weightNum) || weightNum <= 0) newErrors.weight = 'Weight must be greater than 0';
    
    // Validate freight type is selected
    if (!formData.freightType || formData.freightType.trim() === '') {
      newErrors.freightType = 'Freight type is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    setContactReason(null);
    setGeneralMessage(undefined);
    setRates([]);

    // Block if hazmat is selected
    if (formData.hazmat === 'Yes') {
      setShowHazmatWarning(true);
      setContactReason('hazmat');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Normalize freight type to match backend expectations
      const normalizeFreightType = (raw: string): string[] => {
        const v = (raw || '').toString().trim().toUpperCase();
        const SUPPORTED = ['LTL', 'GUARANTEED', 'SP', 'VOL', 'AIR'];
        
        if (!v || !SUPPORTED.includes(v)) {
          throw new Error('Freight type must be selected');
        }
        
        return [v];
      };

      const stackableYes = formData.stackable === 'Yes';
      const isStackable = stackableYes;
      const stackAmount = isStackable ? (parseInt(formData.stacks, 10) || 0) : 0;

      // Build payload matching backend API schema exactly
      const rateTypes = normalizeFreightType(formData.freightType);
      const payload = {
        originCity: formData.origin.city.trim(),
        originState: formData.origin.state.trim(),
        originZipcode: formData.origin.country === 'CA' 
          ? formData.origin.zipCode.replace(/\s/g, '').trim() // Remove spaces for Canadian postal codes in API
          : formData.origin.zipCode.trim(),
        originCountry: formData.origin.country || 'US',
        destinationCity: formData.destination.city.trim(),
        destinationState: formData.destination.state.trim(),
        destinationZipcode: formData.destination.country === 'CA'
          ? formData.destination.zipCode.replace(/\s/g, '').trim() // Remove spaces for Canadian postal codes in API
          : formData.destination.zipCode.trim(),
        destinationCountry: formData.destination.country || 'US',
        UOM: 'US',
        pickupDate: formData.pickupDate,
        freightInfo: [{
          qty: formData.quantity,
          dimType: formData.packagingType || 'PLT',
          weight: parseFloat(formData.weight) || 0,
          weightType: 'each',
          length: parseFloat(formData.length) || 0,
          width: parseFloat(formData.width) || 0,
          height: parseFloat(formData.height) || 0,
          volume: 0,
          hazmat: formData.hazmat === 'Yes',
          class: 0,
          stack: isStackable,
          stackAmount: isStackable ? stackAmount : 1,
        }],
        rateTypesList: rateTypes,
      };

      console.log('[QuoteForm] Submitting rate request:', {
        originCity: payload.originCity,
        originState: payload.originState,
        originZipcode: payload.originZipcode,
        destinationCity: payload.destinationCity,
        destinationState: payload.destinationState,
        destinationZipcode: payload.destinationZipcode,
        pickupDate: payload.pickupDate,
        rateTypesList: payload.rateTypesList,
        freightInfo: payload.freightInfo[0],
      });

      const response = await fetch('/api/rates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      console.log('[QuoteForm] Response status:', response.status, response.statusText);
      console.log('[QuoteForm] Response ok:', response.ok);
      
      // Handle token expiration - only if error code indicates token expired
      if (response.status === 401) {
        try {
          const errorData = await response.json();
          if (errorData.errorCode === 'TOKEN_EXPIRED') {
            setTokenExpired(true);
            return;
          }
          // Other 401 errors - just throw error, don't show expiration modal
          throw new Error(errorData.message || 'Authentication required');
        } catch (e) {
          // If we can't parse error, check if it's already an Error object
          if (e instanceof Error) {
            throw e;
          }
          throw new Error('Authentication required');
        }
      }

      const data = await response.json();
      console.log('[QuoteForm] Response data:', {
        hasRates: !!data.rates,
        ratesCount: Array.isArray(data.rates) ? data.rates.length : 0,
        errorCode: data.errorCode,
        message: data.message,
        rateTokensRemaining: data.rateTokensRemaining,
        rateTokensUsed: data.rateTokensUsed,
      });

      if (!response.ok) {
        console.error('[QuoteForm] Error response:', {
          status: response.status,
          errorCode: data.errorCode,
          message: data.message,
          fullData: data,
        });

        // Handle specific error cases
        if (data.errorCode === 'RATE_LIMIT_EXCEEDED') {
          setContactReason('rate_limit');
          setGeneralMessage(
            data.message ||
              'You have reached your limit of 3 quote requests. Please contact S2 for additional quotes.'
          );
        } else if (data.errorCode === 'HAZMAT_NOT_SUPPORTED') {
          setContactReason('hazmat');
          setGeneralMessage(
            data.message ||
              'Hazardous materials require direct handling by S2 International. Please contact us for a quote.'
          );
        } else if (data.errorCode === 'VERCEL_TIMEOUT') {
          setContactReason('error');
          setGeneralMessage(
            data.message ||
              'The rate search request timed out. This may occur when fetching many rates. Please try again with fewer rate types or contact support if the issue persists.'
          );
        } else {
          setContactReason('error');
          setGeneralMessage(data.message || 'Failed to retrieve rates. Please try again.');
        }
        return;
      }

      // Transform backend rates to display format
      const receivedRates: RateResult[] = Array.isArray(data.rates)
        ? data.rates.map((rate: any) => ({
            id: rate.id || rate.rateId || crypto.randomUUID(),
            rateId: rate.rateId || rate.id,
            name: rate.name || rate.carrierName || 'Unknown',
            carrierName: rate.name || rate.carrierName || 'Unknown',
            serviceName: rate.serviceName || rate.serviceLevel || 'Standard',
            transitDays: rate.transitDays || null,
            totalCost: rate.total || rate.totalCost || 0,
            currency: rate.currency || 'USD',
            iconUrl: rate.iconUrl || rate.icon_url || rate.logoUrl || rate.logo_url,
            booked: false,
          }))
        : [];

      console.log('[QuoteForm] SUCCESS - Rates received:', {
        count: receivedRates.length,
        rates: receivedRates.map(r => ({
          id: r.id,
          carrier: r.carrierName,
          service: r.serviceName,
          price: r.totalCost,
          transit_days: r.transitDays,
        })),
      });


      if (!receivedRates.length) {
        console.warn('[QuoteForm] No rates in response');
        setContactReason('no_rates');
        setGeneralMessage(
          data.message || data.userMessage || 'No rates are currently available for this shipping lane.'
        );
        return;
      }

      setRates(receivedRates);
      setBookingState({ status: 'idle' }); // Reset booking state on new rates
      setShowRatesModal(true); // Show rates in modal
      setFormHasChanged(false); // Reset form changed flag after successful rates

      // Update rate tokens in auth context
      if (data.rateTokensRemaining !== undefined || data.rateTokensUsed !== undefined) {
        updateRateTokens(data.rateTokensRemaining, data.rateTokensUsed);
        // Show notification about remaining tokens
        setTokensNotificationData({
          remaining: data.rateTokensRemaining ?? null,
          used: data.rateTokensUsed ?? null,
        });
        setShowTokensNotification(true);
      }
    } catch (error) {
      console.error('[QuoteForm] Exception during rate request:', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      setContactReason('error');
      setGeneralMessage('An error occurred. Please try again or contact support.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBook = async (rateId: string) => {
    // Find the selected rate
    const selectedRate = rates.find(r => r.id === rateId);
    if (!selectedRate) {
      console.error('[QuoteForm] Rate not found for request to book:', rateId);
      setBookingState({ status: 'error', error: 'Selected rate not found' });
      return;
    }

    // Prevent duplicate submissions
    if (bookingState.status === 'booking') {
      console.warn('[QuoteForm] Request to book already in progress');
      return;
    }

    setBookingState({ status: 'booking' });

    try {
      // Reconstruct the original request payload for booking
      const stackableYes = formData.stackable === 'Yes';
      const isStackable = stackableYes;
      const stackAmount = isStackable ? (parseInt(formData.stacks, 10) || 0) : 0;
      
      const normalizeFreightType = (raw: string): string[] => {
        const v = (raw || '').toString().trim().toUpperCase();
        const DEFAULT_ALL = ['LTL', 'GUARANTEED', 'SP', 'VOL'];
        const SUPPORTED = ['LTL', 'GUARANTEED', 'SP', 'VOL', 'AIR'];
        
        if (!v || v === 'ALL' || v === 'PLEASE SELECT') {
          return DEFAULT_ALL;
        } else if (SUPPORTED.includes(v)) {
          return [v];
        } else {
          return DEFAULT_ALL;
        }
      };

      const rateTypes = normalizeFreightType(formData.freightType);
      const requestPayload = {
        originCity: formData.origin.city.trim(),
        originState: formData.origin.state.trim(),
        originZipcode: formData.origin.country === 'CA' 
          ? formData.origin.zipCode.replace(/\s/g, '').trim() // Remove spaces for Canadian postal codes in API
          : formData.origin.zipCode.trim(),
        originCountry: formData.origin.country || 'US',
        destinationCity: formData.destination.city.trim(),
        destinationState: formData.destination.state.trim(),
        destinationZipcode: formData.destination.country === 'CA'
          ? formData.destination.zipCode.replace(/\s/g, '').trim() // Remove spaces for Canadian postal codes in API
          : formData.destination.zipCode.trim(),
        destinationCountry: formData.destination.country || 'US',
        UOM: 'US',
        pickupDate: formData.pickupDate,
        freightInfo: [{
          qty: formData.quantity,
          dimType: formData.packagingType || 'PLT',
          weight: parseFloat(formData.weight) || 0,
          weightType: 'each',
          length: parseFloat(formData.length) || 0,
          width: parseFloat(formData.width) || 0,
          height: parseFloat(formData.height) || 0,
          volume: 0,
          hazmat: formData.hazmat === 'Yes',
          class: 0,
          stack: isStackable,
          stackAmount: isStackable ? stackAmount : 1,
        }],
        rateTypesList: rateTypes,
      };

      const response = await fetch('/api/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          rate: {
            rateId: selectedRate.rateId || selectedRate.id,
            carrierName: selectedRate.carrierName,
            serviceName: selectedRate.serviceName,
            totalCost: selectedRate.totalCost,
            currency: selectedRate.currency,
          },
          // Include original request payload for ShipPrimus API
          originalRequestPayload: requestPayload,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save quote/rate request');
      }

      // Mark rate as requested
      setRates(prevRates =>
        prevRates.map(rate =>
          rate.id === rateId ? { ...rate, booked: true } : rate
        )
      );

      setBookingState({
        status: 'success',
        bookingId: data.savedQuoteId || data.bookingId,
        confirmationNumber: data.confirmationNumber,
      });

      console.log('[QuoteForm] Request to book successful:', {
        savedQuoteId: data.savedQuoteId || data.bookingId,
        confirmationNumber: data.confirmationNumber,
      });
    } catch (error) {
      console.error('[QuoteForm] Request to book error:', error);
      setBookingState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to save quote/rate request',
      });
    }
  };

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white shadow-lg rounded-lg border border-gray-200 bg-opacity-95">
      {/* Hazmat Warning Modal */}
      {showHazmatWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-red-600 mb-4">
              ⚠️ Hazardous Materials Detected
            </h3>
            <p className="mb-4 text-gray-700">
              For hazardous materials shipments, please contact S2 International directly for a
              custom quote and specialized handling.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="https://www.s-2international.com/contact"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-s2-red text-white py-2 px-4 rounded hover:bg-s2-red-dark text-center font-semibold"
              >
                Contact S2 International
              </a>
              <button
                onClick={() => {
                  setShowHazmatWarning(false);
                  handleChange('hazmat', 'No');
                }}
                className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded hover:bg-gray-300 font-semibold"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-s2-red flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
        <span>Get Shipping Quote</span>
        {user?.email && (
          <span className="text-xs sm:text-sm text-gray-500 font-normal">
            Signed in as {user.email}
          </span>
        )}
      </h1>

      {contactReason && (
        <ContactS2Message reason={contactReason} customMessage={generalMessage} />
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Origin/Destination Section */}
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 space-y-6">
          <LocationSelector
            label="Origin"
            value={formData.origin}
            onChange={(location) =>
              setFormData((prev) => ({ ...prev, origin: location }))
            }
            errors={{
              country: errors['origin.country'],
              state: errors['origin.state'],
              city: errors['origin.city'],
              zipCode: errors['origin.zipCode'],
            }}
          />
          
          <LocationSelector
            label="Destination"
            value={formData.destination}
            onChange={(location) =>
              setFormData((prev) => ({ ...prev, destination: location }))
            }
            errors={{
              country: errors['destination.country'],
              state: errors['destination.state'],
              city: errors['destination.city'],
              zipCode: errors['destination.zipCode'],
            }}
          />
        </div>

        {/* Shipment Details Section */}
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-4 text-gray-900">
            Shipment Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                Pickup Date *
              </label>
              <input
                type="date"
                value={formData.pickupDate}
                min={getTodayDate()}
                onChange={(e) => handleChange('pickupDate', e.target.value)}
                className={`w-full border rounded px-3 py-2 text-sm shadow-sm focus:ring-s2-red focus:border-s2-red ${
                  errors.pickupDate ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.pickupDate && (
                <p className="text-red-500 text-xs mt-1">{errors.pickupDate}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                Freight Type
              </label>
              <select
                value={formData.freightType}
                onChange={(e) => handleChange('freightType', e.target.value)}
                className={`w-full border rounded px-3 py-2 text-sm shadow-sm focus:ring-s2-red focus:border-s2-red ${
                  errors.freightType ? 'border-red-500' : ''
                }`}
                required
              >
                <option value="" disabled>Please Select</option>
                {FREIGHT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              {errors.freightType && (
                <p className="text-red-500 text-sm mt-1">{errors.freightType}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                Packaging Type
              </label>
              <select
                value={formData.packagingType}
                onChange={(e) => handleChange('packagingType', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm shadow-sm focus:ring-s2-red focus:border-s2-red"
              >
                {PACKAGING_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                Quantity (pieces) *
              </label>
              <input
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) =>
                  handleChange('quantity', parseInt(e.target.value, 10) || 0)
                }
                className={`w-full border rounded px-3 py-2 text-sm shadow-sm focus:ring-s2-red focus:border-s2-red ${
                  errors.quantity ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.quantity && (
                <p className="text-red-500 text-xs mt-1">{errors.quantity}</p>
              )}
            </div>
          </div>

          {/* Dimensions */}
          <div className="mt-4">
            <h3 className="font-medium mb-2 text-gray-900 text-sm">
              Dimensions (inches) *
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm mb-1 text-gray-700">Length</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.length}
                  onChange={(e) => handleChange('length', e.target.value)}
                  className={`w-full border rounded px-3 py-2 text-sm shadow-sm focus:ring-s2-red focus:border-s2-red ${
                    errors.length ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0"
                />
                {errors.length && (
                  <p className="text-red-500 text-xs mt-1">{errors.length}</p>
                )}
              </div>

              <div>
                <label className="block text-sm mb-1 text-gray-700">Width</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.width}
                  onChange={(e) => handleChange('width', e.target.value)}
                  className={`w-full border rounded px-3 py-2 text-sm shadow-sm focus:ring-s2-red focus:border-s2-red ${
                    errors.width ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0"
                />
                {errors.width && (
                  <p className="text-red-500 text-xs mt-1">{errors.width}</p>
                )}
              </div>

              <div>
                <label className="block text-sm mb-1 text-gray-700">Height</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.height}
                  onChange={(e) => handleChange('height', e.target.value)}
                  className={`w-full border rounded px-3 py-2 text-sm shadow-sm focus:ring-s2-red focus:border-s2-red ${
                    errors.height ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0"
                />
                {errors.height && (
                  <p className="text-red-500 text-xs mt-1">{errors.height}</p>
                )}
              </div>
            </div>
          </div>

          {/* Weight */}
          <div className="mt-4">
            <label className="block text-sm font-medium mb-1 text-gray-700">
              Weight per piece (lbs) *
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={formData.weight}
              onChange={(e) => handleChange('weight', e.target.value)}
              className={`w-full border rounded px-3 py-2 text-sm shadow-sm focus:ring-s2-red focus:border-s2-red ${
                errors.weight ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="0"
            />
            {errors.weight && (
              <p className="text-red-500 text-xs mt-1">{errors.weight}</p>
            )}
          </div>

          {/* Stackable */}
          <div className="mt-4">
            <label className="block text-sm font-medium mb-2 text-gray-700">Stackable</label>
            <div className="flex gap-6">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="stackable"
                  value="Yes"
                  checked={formData.stackable === 'Yes'}
                  onChange={(e) => handleChange('stackable', e.target.value)}
                  className="mr-2"
                />
                Yes
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="stackable"
                  value="No"
                  checked={formData.stackable === 'No'}
                  onChange={(e) => handleChange('stackable', e.target.value)}
                  className="mr-2"
                />
                No
              </label>
            </div>
            {formData.stackable === 'Yes' && (
              <div className="mt-4">
                <label className="block text-sm font-medium mb-1 text-gray-700">
                  Stack Amount
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.stacks}
                  onChange={(e) => handleChange('stacks', e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm shadow-sm focus:ring-s2-red focus:border-s2-red"
                />
              </div>
            )}
          </div>

          {/* Hazmat */}
          <div className="mt-4">
            <label className="block text-sm font-medium mb-2 text-gray-700">Hazmat</label>
            <select
              value={formData.hazmat}
              onChange={(e) => handleChange('hazmat', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm shadow-sm focus:ring-s2-red focus:border-s2-red"
            >
              <option value="">Please Select</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>
        </div>

        {/* Submit Button - only show if rates haven't been fetched yet */}
        {rates.length === 0 && (
          <button
            type="submit"
            disabled={isSubmitting || formData.hazmat === 'Yes'}
            className={`w-full py-3 px-6 rounded-lg font-semibold text-sm sm:text-base shadow-md hover:shadow-lg transition-colors ${
              isSubmitting || formData.hazmat === 'Yes'
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : 'bg-s2-red hover:bg-s2-red-dark text-white'
            }`}
          >
            {isSubmitting ? 'Getting Rates...' : 'Get Rates'}
          </button>
        )}
      </form>

      {/* View Rates Button (shown when rates exist) */}
      {rates.length > 0 && (
        <div className="mt-4">
          <div className="bg-green-50 border border-green-200 rounded p-4 mb-4">
            <p className="text-green-800 font-semibold">
              ✓ Found {rates.length} rate{rates.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowRatesModal(true)}
            className="w-full py-3 px-6 rounded-lg font-semibold text-sm sm:text-base shadow-md hover:shadow-lg transition-colors bg-blue-600 hover:bg-blue-700 text-white"
          >
            📋 View Available Rates & Request to Book
          </button>
        </div>
      )}

      {/* Rates Modal */}
      {showRatesModal && rates.length > 0 && (
        <RatesModal
          rates={rates}
          onBook={handleBook}
          onClose={() => setShowRatesModal(false)}
          loading={bookingState.status === 'booking'}
        />
      )}

      {/* Booking Confirmation Modal */}
      {bookingState.status === 'success' && (
        <BookingConfirmation
          bookingId={bookingState.bookingId}
          confirmationNumber={bookingState.confirmationNumber}
          onClose={() => setBookingState({ status: 'idle' })}
        />
      )}

      {/* Request to Book Error Message */}
      {bookingState.status === 'error' && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <span className="text-red-600 mr-2">⚠️</span>
            <div>
              <p className="text-red-800 font-semibold">Request to Book Failed</p>
              <p className="text-red-600 text-sm">{bookingState.error}</p>
            </div>
            <button
              onClick={() => setBookingState({ status: 'idle' })}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Rate Tokens Used Notification */}
      {showTokensNotification && tokensNotificationData && (
        <RateTokensUsedNotification
          tokensRemaining={tokensNotificationData.remaining}
          onClose={() => {
            setShowTokensNotification(false);
            setTokensNotificationData(null);
          }}
        />
      )}
    </div>
  );
}

