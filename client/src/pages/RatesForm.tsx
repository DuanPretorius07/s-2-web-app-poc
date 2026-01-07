import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import RatesTable from '../components/RatesTable';
import BookingConfirmation from '../components/BookingConfirmation';

interface Rate {
  id: string;
  rateId?: string;
  carrierName: string;
  serviceName: string;
  transitDays?: number;
  totalCost: number;
  currency: string;
}

interface FormData {
  contact: {
    fullName: string;
    email: string;
    phone: string;
  };
  origin: {
    countryCode: string;
    postalCode: string;
    state: string;
    city: string;
  };
  destination: {
    countryCode: string;
    postalCode: string;
    state: string;
    city: string;
  };
  shipment: {
    shipDate: string;
    pieces: number;
    totalWeight: string;
    weightUnit: 'LB' | 'KG';
    length: string;
    width: string;
    height: string;
    dimUnit: 'IN' | 'CM';
    description: string;
  };
  accessorials: {
    residentialDelivery: boolean;
    liftgatePickup: boolean;
    liftgateDelivery: boolean;
    insidePickup: boolean;
    insideDelivery: boolean;
    limitedAccessPickup: boolean;
    limitedAccessDelivery: boolean;
  };
}

export default function RatesForm() {
  const { user, logout } = useAuth();
  const [formData, setFormData] = useState<FormData>({
    contact: {
      fullName: '',
      email: user?.email || '',
      phone: '',
    },
    origin: {
      countryCode: 'US',
      postalCode: '',
      state: '',
      city: '',
    },
    destination: {
      countryCode: 'US',
      postalCode: '',
      state: '',
      city: '',
    },
    shipment: {
      shipDate: '',
      pieces: 1,
      totalWeight: '',
      weightUnit: 'LB',
      length: '',
      width: '',
      height: '',
      dimUnit: 'IN',
      description: '',
    },
    accessorials: {
      residentialDelivery: false,
      liftgatePickup: false,
      liftgateDelivery: false,
      insidePickup: false,
      insideDelivery: false,
      limitedAccessPickup: false,
      limitedAccessDelivery: false,
    },
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [rates, setRates] = useState<Rate[]>([]);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [showDimensions, setShowDimensions] = useState(false);
  const [bookingConfirmation, setBookingConfirmation] = useState<any>(null);

  // Prefill from HubSpot context
  useEffect(() => {
    const hubspotContextStr = sessionStorage.getItem('hubspotContext');
    if (hubspotContextStr) {
      try {
        const context = JSON.parse(hubspotContextStr);
        setFormData((prev) => ({
          ...prev,
          contact: {
            ...prev.contact,
            email: context.email || prev.contact.email,
            fullName: context.firstname && context.lastname
              ? `${context.firstname} ${context.lastname}`
              : prev.contact.fullName,
            phone: context.phone || prev.contact.phone,
          },
        }));
      } catch (e) {
        console.error('Failed to parse HubSpot context', e);
      }
    }
  }, []);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.contact.fullName.trim()) {
      newErrors['contact.fullName'] = 'Full name is required';
    }
    if (!formData.contact.email.trim()) {
      newErrors['contact.email'] = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact.email)) {
      newErrors['contact.email'] = 'Invalid email format';
    }
    if (!formData.origin.postalCode.trim()) {
      newErrors['origin.postalCode'] = 'Origin postal code is required';
    }
    if (!formData.destination.postalCode.trim()) {
      newErrors['destination.postalCode'] = 'Destination postal code is required';
    }
    if (!formData.shipment.totalWeight.trim()) {
      newErrors['shipment.totalWeight'] = 'Total weight is required';
    } else if (parseFloat(formData.shipment.totalWeight) < 0.1) {
      newErrors['shipment.totalWeight'] = 'Weight must be at least 0.1';
    }

    // Validate dimensions: if any dimension is entered, all must be entered
    const hasAnyDimension = formData.shipment.length || formData.shipment.width || formData.shipment.height;
    if (hasAnyDimension) {
      if (!formData.shipment.length || !formData.shipment.width || !formData.shipment.height) {
        newErrors['shipment.dimensions'] = 'All dimensions must be provided if any are entered';
      } else {
        if (parseFloat(formData.shipment.length) <= 0) newErrors['shipment.length'] = 'Length must be positive';
        if (parseFloat(formData.shipment.width) <= 0) newErrors['shipment.width'] = 'Width must be positive';
        if (parseFloat(formData.shipment.height) <= 0) newErrors['shipment.height'] = 'Height must be positive';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setRates([]);
    setBookingConfirmation(null);

    try {
      const payload: any = {
        contact: {
          fullName: formData.contact.fullName,
          email: formData.contact.email,
          ...(formData.contact.phone && { phone: formData.contact.phone }),
        },
        origin: {
          countryCode: formData.origin.countryCode,
          postalCode: formData.origin.postalCode,
          ...(formData.origin.state && { state: formData.origin.state }),
          ...(formData.origin.city && { city: formData.origin.city }),
        },
        destination: {
          countryCode: formData.destination.countryCode,
          postalCode: formData.destination.postalCode,
          ...(formData.destination.state && { state: formData.destination.state }),
          ...(formData.destination.city && { city: formData.destination.city }),
        },
        shipment: {
          ...(formData.shipment.shipDate && { shipDate: formData.shipment.shipDate }),
          pieces: formData.shipment.pieces,
          totalWeight: parseFloat(formData.shipment.totalWeight),
          weightUnit: formData.shipment.weightUnit,
          ...(formData.shipment.length && formData.shipment.width && formData.shipment.height && {
            dimensions: {
              length: parseFloat(formData.shipment.length),
              width: parseFloat(formData.shipment.width),
              height: parseFloat(formData.shipment.height),
              dimUnit: formData.shipment.dimUnit,
            },
          }),
          ...(formData.shipment.description && { description: formData.shipment.description }),
        },
        accessorials: formData.accessorials,
      };

      // Add HubSpot context if available
      const hubspotContextStr = sessionStorage.getItem('hubspotContext');
      if (hubspotContextStr) {
        try {
          const context = JSON.parse(hubspotContextStr);
          payload.hubspotContext = {
            ...(context.contactId && { contactId: context.contactId }),
            ...(context.dealId && { dealId: context.dealId }),
            ...(context.email && { email: context.email }),
            ...(context.firstname && { firstname: context.firstname }),
            ...(context.lastname && { lastname: context.lastname }),
          };
        } catch (e) {
          console.error('Failed to parse HubSpot context', e);
        }
      }

      const response = await fetch('/api/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to get rates');
      }

      const data = await response.json();
      setRates(data.rates);
      setQuoteId(data.quoteId);
    } catch (error: any) {
      setErrors({ submit: error.message || 'Failed to get rates. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleBook = async (rateId: string) => {
    if (!quoteId) return;

    setLoading(true);
    try {
      const response = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          quoteId,
          selectedRateId: rateId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to book shipment');
      }

      const data = await response.json();
      setBookingConfirmation(data);
      // Refresh rates to show booking status
      setRates((prev) =>
        prev.map((r) => (r.id === rateId ? { ...r, booked: true } : r))
      );
    } catch (error: any) {
      setErrors({ booking: error.message || 'Failed to book shipment' });
    } finally {
      setLoading(false);
    }
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
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Get Shipping Rates</h1>
            <p className="mt-1 text-sm text-gray-600">
              Enter shipment details to retrieve live carrier rates.
            </p>
          </div>

          {errors.submit && (
            <div className="mb-4 rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-800">{errors.submit}</div>
            </div>
          )}

          {errors.booking && (
            <div className="mb-4 rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-800">{errors.booking}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1: Contact Information */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                    Full name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="fullName"
                    value={formData.contact.fullName}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        contact: { ...formData.contact, fullName: e.target.value },
                      })
                    }
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                      errors['contact.fullName'] ? 'border-red-300' : ''
                    }`}
                  />
                  {errors['contact.fullName'] && (
                    <p className="mt-1 text-sm text-red-600">{errors['contact.fullName']}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={formData.contact.email}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        contact: { ...formData.contact, email: e.target.value },
                      })
                    }
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                      errors['contact.email'] ? 'border-red-300' : ''
                    }`}
                  />
                  {errors['contact.email'] && (
                    <p className="mt-1 text-sm text-red-600">{errors['contact.email']}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                    Phone
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={formData.contact.phone}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        contact: { ...formData.contact, phone: e.target.value },
                      })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Origin */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Origin (Ship From)</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="originCountry" className="block text-sm font-medium text-gray-700">
                    Country <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="originCountry"
                    value={formData.origin.countryCode}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        origin: { ...formData.origin, countryCode: e.target.value },
                      })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="MX">Mexico</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="originPostal" className="block text-sm font-medium text-gray-700">
                    Postal Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="originPostal"
                    value={formData.origin.postalCode}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        origin: { ...formData.origin, postalCode: e.target.value },
                      })
                    }
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                      errors['origin.postalCode'] ? 'border-red-300' : ''
                    }`}
                  />
                  {errors['origin.postalCode'] && (
                    <p className="mt-1 text-sm text-red-600">{errors['origin.postalCode']}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="originState" className="block text-sm font-medium text-gray-700">
                    State/Province
                  </label>
                  <input
                    type="text"
                    id="originState"
                    value={formData.origin.state}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        origin: { ...formData.origin, state: e.target.value },
                      })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="originCity" className="block text-sm font-medium text-gray-700">
                    City
                  </label>
                  <input
                    type="text"
                    id="originCity"
                    value={formData.origin.city}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        origin: { ...formData.origin, city: e.target.value },
                      })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Destination */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Destination (Ship To)</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="destCountry" className="block text-sm font-medium text-gray-700">
                    Country <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="destCountry"
                    value={formData.destination.countryCode}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        destination: { ...formData.destination, countryCode: e.target.value },
                      })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="MX">Mexico</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="destPostal" className="block text-sm font-medium text-gray-700">
                    Postal Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="destPostal"
                    value={formData.destination.postalCode}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        destination: { ...formData.destination, postalCode: e.target.value },
                      })
                    }
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                      errors['destination.postalCode'] ? 'border-red-300' : ''
                    }`}
                  />
                  {errors['destination.postalCode'] && (
                    <p className="mt-1 text-sm text-red-600">{errors['destination.postalCode']}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="destState" className="block text-sm font-medium text-gray-700">
                    State/Province
                  </label>
                  <input
                    type="text"
                    id="destState"
                    value={formData.destination.state}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        destination: { ...formData.destination, state: e.target.value },
                      })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="destCity" className="block text-sm font-medium text-gray-700">
                    City
                  </label>
                  <input
                    type="text"
                    id="destCity"
                    value={formData.destination.city}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        destination: { ...formData.destination, city: e.target.value },
                      })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Shipment Details */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Shipment Details</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="shipDate" className="block text-sm font-medium text-gray-700">
                    Ship Date
                  </label>
                  <input
                    type="date"
                    id="shipDate"
                    value={formData.shipment.shipDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        shipment: { ...formData.shipment, shipDate: e.target.value },
                      })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="pieces" className="block text-sm font-medium text-gray-700">
                    Number of Pieces <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="pieces"
                    min="1"
                    value={formData.shipment.pieces}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        shipment: { ...formData.shipment, pieces: parseInt(e.target.value) || 1 },
                      })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div className="sm:col-span-2 grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="totalWeight" className="block text-sm font-medium text-gray-700">
                      Total Weight <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      id="totalWeight"
                      step="0.1"
                      min="0.1"
                      value={formData.shipment.totalWeight}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          shipment: { ...formData.shipment, totalWeight: e.target.value },
                        })
                      }
                      className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                        errors['shipment.totalWeight'] ? 'border-red-300' : ''
                      }`}
                    />
                    {errors['shipment.totalWeight'] && (
                      <p className="mt-1 text-sm text-red-600">{errors['shipment.totalWeight']}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="weightUnit" className="block text-sm font-medium text-gray-700">
                      Weight Unit <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="weightUnit"
                      value={formData.shipment.weightUnit}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          shipment: {
                            ...formData.shipment,
                            weightUnit: e.target.value as 'LB' | 'KG',
                          },
                        })
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value="LB">LB</option>
                      <option value="KG">KG</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Optional Dimensions */}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowDimensions(!showDimensions)}
                  className="text-sm text-indigo-600 hover:text-indigo-500"
                >
                  {showDimensions ? '−' : '+'} Add dimensions
                </button>
                {showDimensions && (
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
                    <div>
                      <label htmlFor="length" className="block text-sm font-medium text-gray-700">
                        Length
                      </label>
                      <input
                        type="number"
                        id="length"
                        step="0.1"
                        min="0"
                        value={formData.shipment.length}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            shipment: { ...formData.shipment, length: e.target.value },
                          })
                        }
                        className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                          errors['shipment.length'] ? 'border-red-300' : ''
                        }`}
                      />
                      {errors['shipment.length'] && (
                        <p className="mt-1 text-sm text-red-600">{errors['shipment.length']}</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="width" className="block text-sm font-medium text-gray-700">
                        Width
                      </label>
                      <input
                        type="number"
                        id="width"
                        step="0.1"
                        min="0"
                        value={formData.shipment.width}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            shipment: { ...formData.shipment, width: e.target.value },
                          })
                        }
                        className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                          errors['shipment.width'] ? 'border-red-300' : ''
                        }`}
                      />
                      {errors['shipment.width'] && (
                        <p className="mt-1 text-sm text-red-600">{errors['shipment.width']}</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="height" className="block text-sm font-medium text-gray-700">
                        Height
                      </label>
                      <input
                        type="number"
                        id="height"
                        step="0.1"
                        min="0"
                        value={formData.shipment.height}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            shipment: { ...formData.shipment, height: e.target.value },
                          })
                        }
                        className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                          errors['shipment.height'] ? 'border-red-300' : ''
                        }`}
                      />
                      {errors['shipment.height'] && (
                        <p className="mt-1 text-sm text-red-600">{errors['shipment.height']}</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="dimUnit" className="block text-sm font-medium text-gray-700">
                        Dimension Unit
                      </label>
                      <select
                        id="dimUnit"
                        value={formData.shipment.dimUnit}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            shipment: {
                              ...formData.shipment,
                              dimUnit: e.target.value as 'IN' | 'CM',
                            },
                          })
                        }
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      >
                        <option value="IN">IN</option>
                        <option value="CM">CM</option>
                      </select>
                    </div>
                  </div>
                )}
                {errors['shipment.dimensions'] && (
                  <p className="mt-2 text-sm text-red-600">{errors['shipment.dimensions']}</p>
                )}
              </div>

              <div className="mt-4">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Description / Notes for carrier
                </label>
                <textarea
                  id="description"
                  rows={3}
                  maxLength={500}
                  value={formData.shipment.description}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      shipment: { ...formData.shipment, description: e.target.value },
                    })
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {formData.shipment.description.length}/500 characters
                </p>
              </div>
            </div>

            {/* Section 5: Accessorials */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Accessorials / Options</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {[
                  { key: 'residentialDelivery', label: 'Residential delivery' },
                  { key: 'liftgatePickup', label: 'Liftgate at pickup' },
                  { key: 'liftgateDelivery', label: 'Liftgate at delivery' },
                  { key: 'insidePickup', label: 'Inside pickup' },
                  { key: 'insideDelivery', label: 'Inside delivery' },
                  { key: 'limitedAccessPickup', label: 'Limited access pickup' },
                  { key: 'limitedAccessDelivery', label: 'Limited access delivery' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center">
                    <input
                      type="checkbox"
                      id={key}
                      checked={formData.accessorials[key as keyof typeof formData.accessorials]}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          accessorials: {
                            ...formData.accessorials,
                            [key]: e.target.checked,
                          },
                        })
                      }
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor={key} className="ml-2 block text-sm text-gray-700">
                      {label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Getting Rates...
                  </span>
                ) : (
                  'Get Rates'
                )}
              </button>
            </div>
          </form>

          {rates.length > 0 && (
            <div className="mt-8">
              <RatesTable rates={rates} onBook={handleBook} loading={loading} />
            </div>
          )}

          {rates.length === 0 && !loading && quoteId && (
            <div className="mt-8 rounded-md bg-yellow-50 p-4">
              <p className="text-sm text-yellow-800">
                No rates found. Try adjusting weight/pieces or accessorials.
              </p>
            </div>
          )}

          {bookingConfirmation && (
            <div className="mt-8">
              <BookingConfirmation confirmation={bookingConfirmation} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
