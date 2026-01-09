import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface Rate {
  id?: string;
  rateId?: string;
  carrierName?: string;
  serviceName?: string;
  serviceLevel?: string;
  transitDays?: number;
  total?: number;
  totalCost?: number;
  currency?: string;
  iconUrl?: string;
  booked?: boolean;
}

export default function RatesForm() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [rates, setRates] = useState<Rate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedRate, setSelectedRate] = useState<Rate | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Form state - matching exact field names from existing JS code
  const [formData, setFormData] = useState({
    // Origin fields
    origin_country: 'US',
    origin_zipcode: '',
    origin_city: '',
    origin_state: '',
    
    // Destination fields
    destination_country: 'US',
    destination_zipcode: '',
    destination_city: '',
    destination_state: '',
    
    // Pickup date (using pick_up_date2 as in existing JS)
    pick_up_date2: '',
    
    // Freight type
    freight_type: '',
    
    // Packaging
    packaging_type: 'PLT',
    
    // Quantity
    quantity: '1',
    
    // Dimensions
      length: '',
      width: '',
      height: '',
    
    // Weight
    weight: '',
    weight_type: 'each',
    
    // Volume
    volume: '',
    
    // Hazmat
    hazmat: '',
    
    // Stackable
    stackable: '',
    stacks: '1',
    
    // Freight class
    freight_class_dropdown: '0',
    
    // Contact fields
    firstname: '',
    lastname: '',
    email: user?.email || '',
    company_name: '',
  });

  // Normalize freight type to match existing JS logic
  function normalizeFreightType(raw: string): string {
    const v = (raw || '').toString().trim().toUpperCase();
    const ALIASES: Record<string, Set<string>> = {
      LTL: new Set(['LTL', 'STANDARD_LTL']),
      GUARANTEED: new Set(['GUARANTEED', 'GUARANTEED LTL']),
      SP: new Set(['SP', 'SMALL PACKAGE', 'SMALL_PACKAGE']),
      VOL: new Set(['VOL', 'VOLUME', 'VOLUME QUOTE', 'VOLUME_QUOTE']),
      AIR: new Set(['AIR', 'INTL_LTL']),
    };
    
    for (const key in ALIASES) {
      if (ALIASES[key].has(v)) return key;
    }
    return v;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setRates([]);
    setSelectedRate(null);

    try {
      // Determine stackable value
      const stackableYes = formData.stackable === 'Yes';
      const stackableNo = formData.stackable === 'No';
      const isStackable = stackableYes ? true : false;
      const stackAmount = isStackable ? (parseInt(formData.stacks, 10) || 0) : 0;

      // Normalize freight type and determine rate types
      const DEFAULT_ALL = ['LTL', 'GUARANTEED', 'SP', 'VOL'];
      const freightTypeRaw = formData.freight_type || '';
      const ftNorm = normalizeFreightType(freightTypeRaw);
      const SUPPORTED = ['LTL', 'GUARANTEED', 'SP', 'VOL', 'AIR'];
      
      let rateTypes: string[];
      if (!ftNorm || ftNorm === 'ALL' || ftNorm === 'PLEASE SELECT') {
        rateTypes = DEFAULT_ALL;
      } else if (SUPPORTED.indexOf(ftNorm) !== -1) {
        rateTypes = [ftNorm];
      } else {
        console.warn('[UI] Unsupported mode from form; falling back to ALL:', freightTypeRaw);
        rateTypes = DEFAULT_ALL;
      }

      // Build request body exactly matching existing JS code
      const requestBody = {
        originCity: formData.origin_city || '',
        originState: formData.origin_state || '',
        originZipcode: formData.origin_zipcode || '',
        originCountry: formData.origin_country || 'US',
        destinationCity: formData.destination_city || '',
        destinationState: formData.destination_state || '',
        destinationZipcode: formData.destination_zipcode || '',
        destinationCountry: formData.destination_country || 'US',
        UOM: 'US',
        pickupDate: formData.pick_up_date2 || '',
        freightInfo: [{
          qty: parseInt(formData.quantity, 10) || 1,
          dimType: formData.packaging_type || 'PLT',
          weight: parseInt(formData.weight, 10) || 0,
          weightType: String(formData.weight_type || '').toLowerCase() || 'each',
          length: parseInt(formData.length, 10) || 0,
          width: parseInt(formData.width, 10) || 0,
          height: parseInt(formData.height, 10) || 0,
          volume: parseFloat(formData.volume) || 0,
          hazmat: String(formData.hazmat || '').toLowerCase() === 'yes',
          class: parseInt(formData.freight_class_dropdown, 10) || 0,
          stack: isStackable,
          stackAmount: isStackable ? stackAmount : 1,
        }],
        rateTypesList: rateTypes,
      };

      console.log('[UI] Request payload:', requestBody);

      // Send to backend - backend will forward to Ship2Primus or API Gateway
      const response = await fetch('/api/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to get rates' }));
        throw new Error(errorData.message || `HTTP ${response.status}: Failed to get rates`);
      }

      const data = await response.json();
      
      // Handle response - match existing JS displayRates logic
      if (Array.isArray(data.rates) && data.rates.length > 0) {
      setRates(data.rates);
      } else {
        const msg = data && data.userMessage ? data.userMessage : 'No rates found for your request.';
        setError(msg);
        console.warn('No rates payload:', data);
      }
    } catch (err: any) {
      console.error('API error:', err);
      setError(err.message || 'Failed to get rates. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBook = async (rate: Rate) => {
    if (!rate || !rate.rateId) {
      setError('Invalid rate selected');
      return;
    }

    setBookingLoading(true);
    setError(null);

    try {
      // Store the original request body (would need to be saved from form submission)
      // For POC, send rate data directly for booking
      const bookingPayload = {
        rate: {
          rateId: rate.rateId || rate.id,
          carrierName: rate.carrierName,
          serviceName: rate.serviceName || rate.serviceLevel,
          totalCost: rate.total || rate.totalCost,
          currency: rate.currency || 'USD',
        },
      };

      console.log('[UI] Booking rate:', bookingPayload);

      const response = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(bookingPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to book shipment' }));
        throw new Error(errorData.message || `HTTP ${response.status}: Failed to book shipment`);
      }

      const bookingData = await response.json();
      setSelectedRate(rate);
      
      // Update rate as booked in the UI
      setRates((prev) =>
        prev.map((r) => 
          (r.rateId === rate.rateId || r.id === rate.id) 
            ? { ...r, booked: true } 
            : r
        )
      );

      alert(`Booking confirmed! Confirmation: ${bookingData.confirmationNumber || bookingData.bookingId || 'N/A'}`);
    } catch (err: any) {
      console.error('Booking error:', err);
      setError(err.message || 'Failed to book shipment');
    } finally {
      setBookingLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-gray-900">ShipPrimus Portal</h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  to="/"
                  className="border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Get Rates
                </Link>
                <Link
                  to="/history"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  History
                </Link>
              </div>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-700 mr-4">{user?.email}</span>
              <button
                onClick={logout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Get Shipping Rates</h1>

            {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
              {/* Origin Information */}
            <div className="border-b border-gray-200 pb-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Origin</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                    <label htmlFor="origin_country" className="block text-sm font-medium text-gray-700">
                      Origin country
                  </label>
                  <select
                      id="origin_country"
                      name="origin_country"
                      value={formData.origin_country}
                      onChange={(e) => updateField('origin_country', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                      <option value="">Please Select</option>
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="MX">Mexico</option>
                  </select>
                </div>
                <div>
                    <label htmlFor="origin_zipcode" className="block text-sm font-medium text-gray-700">
                      Origin ZipCode
                  </label>
                  <input
                    type="text"
                      id="origin_zipcode"
                      name="origin_zipcode"
                      value={formData.origin_zipcode}
                      onChange={(e) => updateField('origin_zipcode', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                </div>
                <div>
                    <label htmlFor="origin_city" className="block text-sm font-medium text-gray-700">
                      Origin City
                  </label>
                  <input
                    type="text"
                      id="origin_city"
                      name="origin_city"
                      value={formData.origin_city}
                      onChange={(e) => updateField('origin_city', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                    <label htmlFor="origin_state" className="block text-sm font-medium text-gray-700">
                      Origin State
                  </label>
                  <input
                    type="text"
                      id="origin_state"
                      name="origin_state"
                      value={formData.origin_state}
                      onChange={(e) => updateField('origin_state', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>

              {/* Destination Information */}
            <div className="border-b border-gray-200 pb-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Destination</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                    <label htmlFor="destination_country" className="block text-sm font-medium text-gray-700">
                      Destination Country
                  </label>
                  <select
                      id="destination_country"
                      name="destination_country"
                      value={formData.destination_country}
                      onChange={(e) => updateField('destination_country', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                      <option value="">Please Select</option>
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="MX">Mexico</option>
                  </select>
                </div>
                <div>
                    <label htmlFor="destination_zipcode" className="block text-sm font-medium text-gray-700">
                      Destination Zipcode
                  </label>
                  <input
                    type="text"
                      id="destination_zipcode"
                      name="destination_zipcode"
                      value={formData.destination_zipcode}
                      onChange={(e) => updateField('destination_zipcode', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                </div>
                <div>
                    <label htmlFor="destination_city" className="block text-sm font-medium text-gray-700">
                      Destination City
                  </label>
                  <input
                    type="text"
                      id="destination_city"
                      name="destination_city"
                      value={formData.destination_city}
                      onChange={(e) => updateField('destination_city', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                    <label htmlFor="destination_state" className="block text-sm font-medium text-gray-700">
                      Destination State
                  </label>
                  <input
                    type="text"
                      id="destination_state"
                      name="destination_state"
                      value={formData.destination_state}
                      onChange={(e) => updateField('destination_state', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>

              {/* Pick-up Date */}
            <div className="border-b border-gray-200 pb-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Pick-up Date</h2>
                <div>
                  <label htmlFor="pick_up_date2" className="block text-sm font-medium text-gray-700">
                    Pick-up Date
                  </label>
                  <input
                    type="date"
                    id="pick_up_date2"
                    name="pick_up_date2"
                    value={formData.pick_up_date2}
                    onChange={(e) => updateField('pick_up_date2', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>

              {/* Freight Type */}
              <div className="border-b border-gray-200 pb-6">
                <label htmlFor="freight_type" className="block text-sm font-medium text-gray-700 mb-2">
                  Freight Type
                </label>
                <select
                  id="freight_type"
                  name="freight_type"
                  value={formData.freight_type}
                  onChange={(e) => updateField('freight_type', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="">Please Select</option>
                  <option value="LTL">LTL</option>
                  <option value="GUARANTEED">Guaranteed</option>
                  <option value="SP">Small Package</option>
                  <option value="VOL">Volume</option>
                  <option value="AIR">Air</option>
                </select>
              </div>

              {/* Packing Type */}
              <div className="border-b border-gray-200 pb-6">
                <label htmlFor="packaging_type" className="block text-sm font-medium text-gray-700 mb-2">
                  Packing Type
                </label>
                <select
                  id="packaging_type"
                  name="packaging_type"
                  value={formData.packaging_type}
                  onChange={(e) => updateField('packaging_type', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="PLT">Pallet</option>
                  <option value="CTN">Carton</option>
                  <option value="DRM">Drum</option>
                </select>
              </div>

              {/* Quantity */}
              <div className="border-b border-gray-200 pb-6">
                <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity
                  </label>
                  <input
                    type="number"
                  id="quantity"
                  name="quantity"
                    min="1"
                  value={formData.quantity}
                  onChange={(e) => updateField('quantity', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
              </div>

              {/* Dimensions */}
              <div className="border-b border-gray-200 pb-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Dimensions (in)</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label htmlFor="length" className="block text-sm font-medium text-gray-700">
                      Length (in)
                      </label>
                      <input
                        type="number"
                        id="length"
                      name="length"
                      min="0"
                        step="0.1"
                      value={formData.length}
                      onChange={(e) => updateField('length', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                    </div>
                    <div>
                      <label htmlFor="width" className="block text-sm font-medium text-gray-700">
                      Width (in)
                      </label>
                      <input
                        type="number"
                        id="width"
                      name="width"
                      min="0"
                        step="0.1"
                      value={formData.width}
                      onChange={(e) => updateField('width', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                    </div>
                    <div>
                      <label htmlFor="height" className="block text-sm font-medium text-gray-700">
                      Height (in)
                      </label>
                      <input
                        type="number"
                        id="height"
                      name="height"
                      min="0"
                        step="0.1"
                      value={formData.height}
                      onChange={(e) => updateField('height', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Weight Per Piece */}
              <div className="border-b border-gray-200 pb-6">
                <label htmlFor="weight" className="block text-sm font-medium text-gray-700 mb-2">
                  Weight Per Piece (lbs)
                </label>
                <input
                  type="number"
                  id="weight"
                  name="weight"
                        min="0"
                  step="0.1"
                  value={formData.weight}
                  onChange={(e) => updateField('weight', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                    </div>

              {/* Hazmat */}
              <div className="border-b border-gray-200 pb-6">
                <label htmlFor="hazmat" className="block text-sm font-medium text-gray-700 mb-2">
                  Hazmat
                      </label>
                      <select
                  id="hazmat"
                  name="hazmat"
                  value={formData.hazmat}
                  onChange={(e) => updateField('hazmat', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      >
                  <option value="">Please Select</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                      </select>
                    </div>

              {/* Stackable */}
              <div className="border-b border-gray-200 pb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Stackable</label>
                <div className="flex gap-6">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="stackable"
                      value="Yes"
                      checked={formData.stackable === 'Yes'}
                      onChange={(e) => updateField('stackable', e.target.value)}
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
                      onChange={(e) => updateField('stackable', e.target.value)}
                      className="mr-2"
                    />
                    No
                  </label>
                </div>
                {formData.stackable === 'Yes' && (
                  <div className="mt-4">
                    <label htmlFor="stacks" className="block text-sm font-medium text-gray-700 mb-2">
                      Stack Amount
                    </label>
                    <input
                      type="number"
                      id="stacks"
                      name="stacks"
                      min="1"
                      value={formData.stacks}
                      onChange={(e) => updateField('stacks', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Contact Information */}
              <div className="border-b border-gray-200 pb-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="firstname" className="block text-sm font-medium text-gray-700">
                      First name
                </label>
                    <input
                      type="text"
                      id="firstname"
                      name="firstname"
                      value={formData.firstname}
                      onChange={(e) => updateField('firstname', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
                  <div>
                    <label htmlFor="lastname" className="block text-sm font-medium text-gray-700">
                      Last name
                    </label>
                    <input
                      type="text"
                      id="lastname"
                      name="lastname"
                      value={formData.lastname}
                      onChange={(e) => updateField('lastname', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
            </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="company_name" className="block text-sm font-medium text-gray-700">
                      Company name
                    </label>
                    <input
                      type="text"
                      id="company_name"
                      name="company_name"
                      value={formData.company_name}
                      onChange={(e) => updateField('company_name', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  {loading ? 'Getting Rates...' : 'Submit'}
              </button>
            </div>
          </form>

            {/* Rates Display Table */}
          {rates.length > 0 && (
            <div className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Available Rates</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200" id="ratesTable">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Carrier
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Transit Days
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Service
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody id="ratesTableBody" className="bg-white divide-y divide-gray-200">
                      {rates.map((rate, idx) => (
                        <tr key={rate.rateId || rate.id || idx} className={rate.booked ? 'bg-green-50' : ''}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {rate.iconUrl && <img src={rate.iconUrl} alt="Carrier Logo" width="100" className="mb-2" />}
                            {rate.carrierName || 'Unknown'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {rate.transitDays != null ? rate.transitDays : '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            ${((rate.total || rate.totalCost || 0).toFixed(2))}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {rate.serviceLevel || rate.serviceName || '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            {rate.booked ? (
                              <span className="text-green-600">Booked</span>
                            ) : (
                              <button
                                onClick={() => handleBook(rate)}
                                disabled={bookingLoading}
                                className="text-indigo-600 hover:text-indigo-900 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {bookingLoading ? 'Booking...' : 'Book'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
            </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
