import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ContactS2Message from './ContactS2Message';

interface QuoteFormData {
  originCountry: string;
  originZip: string;
  destCountry: string;
  destZip: string;
  pickupDate: string;
  freightType: string;
  packingType: string;
  quantity: number;
  length: number;
  width: number;
  height: number;
  weight: number;
  stackable: boolean;
  hazmat: boolean;
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

const FREIGHT_TYPES = ['General Cargo', 'Palletized', 'Crated', 'Loose'];

const PACKING_TYPES = ['Wooden Crate', 'Cardboard Box', 'Pallet', 'No Packing'];

export default function QuoteForm() {
  const { user } = useAuth();
  const [formData, setFormData] = useState<QuoteFormData>({
    originCountry: 'US',
    originZip: '',
    destCountry: 'US',
    destZip: '',
    pickupDate: '',
    freightType: FREIGHT_TYPES[0],
    packingType: PACKING_TYPES[0],
    quantity: 1,
    length: 0,
    width: 0,
    height: 0,
    weight: 0,
    stackable: false,
    hazmat: false,
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
    if (field === 'hazmat' && value === true) {
      setShowHazmatWarning(true);
    } else if (field === 'hazmat' && value === false) {
      setShowHazmatWarning(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.originZip) newErrors.originZip = 'Origin ZIP code is required';
    if (!formData.destZip) newErrors.destZip = 'Destination ZIP code is required';
    if (!formData.pickupDate) newErrors.pickupDate = 'Pickup date is required';

    // Date must be today or future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(formData.pickupDate);
    if (formData.pickupDate && selectedDate < today) {
      newErrors.pickupDate = 'Pickup date must be today or in the future';
    }

    if (formData.quantity < 1) newErrors.quantity = 'Quantity must be at least 1';
    if (formData.length <= 0) newErrors.length = 'Length must be greater than 0';
    if (formData.width <= 0) newErrors.width = 'Width must be greater than 0';
    if (formData.height <= 0) newErrors.height = 'Height must be greater than 0';
    if (formData.weight <= 0) newErrors.weight = 'Weight must be greater than 0';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setContactReason(null);
    setGeneralMessage(undefined);
    setRates([]);

    // Block if hazmat is selected
    if (formData.hazmat) {
      setShowHazmatWarning(true);
      setContactReason('hazmat');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Build simple payload expected by new /api/rates handler
      const payload = {
        originCountry: formData.originCountry,
        originZip: formData.originZip,
        destCountry: formData.destCountry,
        destZip: formData.destZip,
        pickupDate: formData.pickupDate,
        freightType: formData.freightType,
        packingType: formData.packingType,
        quantity: formData.quantity,
        length: formData.length,
        width: formData.width,
        height: formData.height,
        weight: formData.weight,
        stackable: formData.stackable,
        hazmat: formData.hazmat,
      };

      const response = await fetch('/api/rates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
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

      const receivedRates: RateResult[] = Array.isArray(data.rates) ? data.rates : [];

      if (!receivedRates.length) {
        setContactReason('no_rates');
        setGeneralMessage(
          data.message || 'No rates are currently available for this shipping lane.'
        );
        return;
      }

      setRates(receivedRates);
    } catch (error) {
      console.error('Error submitting quote request:', error);
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
                  handleChange('hazmat', false);
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
                Origin ZIP Code *
              </label>
              <input
                type="text"
                value={formData.originZip}
                onChange={(e) => handleChange('originZip', e.target.value)}
                className={`w-full border rounded px-3 py-2 text-sm shadow-sm focus:ring-s2-red focus:border-s2-red ${
                  errors.originZip ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., 90210"
              />
              {errors.originZip && (
                <p className="text-red-500 text-xs mt-1">{errors.originZip}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                Destination Country
              </label>
              <select
                value={formData.destCountry}
                onChange={(e) => handleChange('destCountry', e.target.value)}
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
                Destination ZIP Code *
              </label>
              <input
                type="text"
                value={formData.destZip}
                onChange={(e) => handleChange('destZip', e.target.value)}
                className={`w-full border rounded px-3 py-2 text-sm shadow-sm focus:ring-s2-red focus:border-s2-red ${
                  errors.destZip ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., 10001"
              />
              {errors.destZip && (
                <p className="text-red-500 text-xs mt-1">{errors.destZip}</p>
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
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                Packing Type
              </label>
              <select
                value={formData.packingType}
                onChange={(e) => handleChange('packingType', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm shadow-sm focus:ring-s2-red focus:border-s2-red"
              >
                {PACKING_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
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
                  onChange={(e) =>
                    handleChange('length', parseFloat(e.target.value) || 0)
                  }
                  className={`w-full border rounded px-3 py-2 text-sm shadow-sm focus:ring-s2-red focus:border-s2-red ${
                    errors.length ? 'border-red-500' : 'border-gray-300'
                  }`}
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
                  onChange={(e) =>
                    handleChange('width', parseFloat(e.target.value) || 0)
                  }
                  className={`w-full border rounded px-3 py-2 text-sm shadow-sm focus:ring-s2-red focus:border-s2-red ${
                    errors.width ? 'border-red-500' : 'border-gray-300'
                  }`}
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
                  onChange={(e) =>
                    handleChange('height', parseFloat(e.target.value) || 0)
                  }
                  className={`w-full border rounded px-3 py-2 text-sm shadow-sm focus:ring-s2-red focus:border-s2-red ${
                    errors.height ? 'border-red-500' : 'border-gray-300'
                  }`}
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
              onChange={(e) =>
                handleChange('weight', parseFloat(e.target.value) || 0)
              }
              className={`w-full border rounded px-3 py-2 text-sm shadow-sm focus:ring-s2-red focus:border-s2-red ${
                errors.weight ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.weight && (
              <p className="text-red-500 text-xs mt-1">{errors.weight}</p>
            )}
          </div>

          {/* Checkboxes */}
          <div className="mt-4 space-y-2">
            <label className="flex items-center text-sm text-gray-700">
              <input
                type="checkbox"
                checked={formData.stackable}
                onChange={(e) => handleChange('stackable', e.target.checked)}
                className="mr-2 h-4 w-4 text-s2-red border-gray-300 rounded focus:ring-s2-red"
              />
              <span>Stackable</span>
            </label>

            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={formData.hazmat}
                onChange={(e) => handleChange('hazmat', e.target.checked)}
                className="mr-2 h-4 w-4 text-red-600 border-red-300 rounded focus:ring-red-500"
              />
              <span className="text-red-600 font-medium">
                Hazardous Materials (Hazmat)
              </span>
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || formData.hazmat}
          className={`w-full py-3 px-6 rounded-lg font-semibold text-sm sm:text-base shadow-md hover:shadow-lg transition-colors ${
            isSubmitting || formData.hazmat
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

