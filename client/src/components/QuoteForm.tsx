import { useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ContactS2Message from './ContactS2Message';

interface QuoteFormData {
  originCountry: string;
  originCity: string;
  originState: string;
  originZipcode: string;
  destinationCountry: string;
  destinationCity: string;
  destinationState: string;
  destinationZipcode: string;
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
  carrier: string;
  service: string;
  price: number;
  transit_days: number;
  eta?: string;
}

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'MX', name: 'Mexico' },
];

// Match backend API expectations
const FREIGHT_TYPES = [
  { value: '', label: 'Please Select' },
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
  const { user } = useAuth();
  const [formData, setFormData] = useState<QuoteFormData>({
    originCountry: 'US',
    originCity: '',
    originState: '',
    originZipcode: '',
    destinationCountry: 'US',
    destinationCity: '',
    destinationState: '',
    destinationZipcode: '',
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

    if (!formData.originCity.trim()) newErrors.originCity = 'Origin city is required';
    if (!formData.originState.trim()) newErrors.originState = 'Origin state is required';
    if (!formData.originZipcode.trim()) newErrors.originZipcode = 'Origin ZIP code is required';
    if (!formData.destinationCity.trim()) newErrors.destinationCity = 'Destination city is required';
    if (!formData.destinationState.trim()) newErrors.destinationState = 'Destination state is required';
    if (!formData.destinationZipcode.trim()) newErrors.destinationZipcode = 'Destination ZIP code is required';
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

      const stackableYes = formData.stackable === 'Yes';
      const isStackable = stackableYes;
      const stackAmount = isStackable ? (parseInt(formData.stacks, 10) || 0) : 0;

      // Build payload matching backend API schema exactly
      const rateTypes = normalizeFreightType(formData.freightType);
      const payload = {
        originCity: formData.originCity.trim(),
        originState: formData.originState.trim(),
        originZipcode: formData.originZipcode.trim(),
        originCountry: formData.originCountry || 'US',
        destinationCity: formData.destinationCity.trim(),
        destinationState: formData.destinationState.trim(),
        destinationZipcode: formData.destinationZipcode.trim(),
        destinationCountry: formData.destinationCountry || 'US',
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
        } else {
          setContactReason('error');
          setGeneralMessage(data.message || 'Failed to retrieve rates. Please try again.');
        }
        return;
      }

      // Transform backend rates to display format
      const receivedRates: RateResult[] = Array.isArray(data.rates)
        ? data.rates.map((rate: any) => ({
            carrier: rate.name || rate.carrierName || 'Unknown',
            service: rate.serviceName || rate.serviceLevel || 'Standard',
            price: rate.total || rate.totalCost || 0,
            transit_days: rate.transitDays || null,
            eta: rate.eta,
          }))
        : [];

      console.log('[QuoteForm] SUCCESS - Rates received:', {
        count: receivedRates.length,
        rates: receivedRates.map(r => ({
          carrier: r.carrier,
          service: r.service,
          price: r.price,
          transit_days: r.transit_days,
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
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-4 text-gray-900">
            Origin &amp; Destination
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Origin Fields */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                Origin Country
              </label>
              <select
                value={formData.originCountry}
                onChange={(e) => handleChange('originCountry', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm shadow-sm focus:ring-s2-red focus:border-s2-red"
              >
                {COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                Origin City *
              </label>
              <input
                type="text"
                value={formData.originCity}
                onChange={(e) => handleChange('originCity', e.target.value)}
                className={`w-full border rounded px-3 py-2 text-sm shadow-sm focus:ring-s2-red focus:border-s2-red ${
                  errors.originCity ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., Seattle"
              />
              {errors.originCity && (
                <p className="text-red-500 text-xs mt-1">{errors.originCity}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                Origin State *
              </label>
              <input
                type="text"
                value={formData.originState}
                onChange={(e) => handleChange('originState', e.target.value)}
                className={`w-full border rounded px-3 py-2 text-sm shadow-sm focus:ring-s2-red focus:border-s2-red ${
                  errors.originState ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., WA"
                maxLength={2}
              />
              {errors.originState && (
                <p className="text-red-500 text-xs mt-1">{errors.originState}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                Origin ZIP Code *
              </label>
              <input
                type="text"
                value={formData.originZipcode}
                onChange={(e) => handleChange('originZipcode', e.target.value)}
                className={`w-full border rounded px-3 py-2 text-sm shadow-sm focus:ring-s2-red focus:border-s2-red ${
                  errors.originZipcode ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., 98122"
              />
              {errors.originZipcode && (
                <p className="text-red-500 text-xs mt-1">{errors.originZipcode}</p>
              )}
            </div>

            {/* Destination Fields */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                Destination Country
              </label>
              <select
                value={formData.destinationCountry}
                onChange={(e) => handleChange('destinationCountry', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm shadow-sm focus:ring-s2-red focus:border-s2-red"
              >
                {COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                Destination City *
              </label>
              <input
                type="text"
                value={formData.destinationCity}
                onChange={(e) => handleChange('destinationCity', e.target.value)}
                className={`w-full border rounded px-3 py-2 text-sm shadow-sm focus:ring-s2-red focus:border-s2-red ${
                  errors.destinationCity ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., Boston"
              />
              {errors.destinationCity && (
                <p className="text-red-500 text-xs mt-1">{errors.destinationCity}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                Destination State *
              </label>
              <input
                type="text"
                value={formData.destinationState}
                onChange={(e) => handleChange('destinationState', e.target.value)}
                className={`w-full border rounded px-3 py-2 text-sm shadow-sm focus:ring-s2-red focus:border-s2-red ${
                  errors.destinationState ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., MA"
                maxLength={2}
              />
              {errors.destinationState && (
                <p className="text-red-500 text-xs mt-1">{errors.destinationState}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                Destination ZIP Code *
              </label>
              <input
                type="text"
                value={formData.destinationZipcode}
                onChange={(e) => handleChange('destinationZipcode', e.target.value)}
                className={`w-full border rounded px-3 py-2 text-sm shadow-sm focus:ring-s2-red focus:border-s2-red ${
                  errors.destinationZipcode ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., 02139"
              />
              {errors.destinationZipcode && (
                <p className="text-red-500 text-xs mt-1">{errors.destinationZipcode}</p>
              )}
            </div>
          </div>
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
                className="w-full border rounded px-3 py-2 text-sm shadow-sm focus:ring-s2-red focus:border-s2-red"
              >
                {FREIGHT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
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

        {/* Submit Button */}
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
      </form>

      {/* Rates Display */}
      {rates.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-s2-red mb-4">Available Rates</h2>
          <div className="overflow-x-auto shadow-md rounded-lg border border-gray-200">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-s2-red">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                    Carrier
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                    Service
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                    Transit
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                    Price
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rates.map((rate, idx) => (
                  <tr key={`${rate.carrier}-${rate.service}-${idx}`} className="hover:bg-s2-red-lighter transition-colors">
                    <td className="px-3 py-3 text-sm font-semibold text-gray-900">
                      {rate.carrier}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">{rate.service}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {rate.transit_days
                        ? `${rate.transit_days} day${rate.transit_days === 1 ? '' : 's'}`
                        : '—'}
                    </td>
                    <td className="px-3 py-3 text-sm font-bold text-s2-red">
                      ${rate.price.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

