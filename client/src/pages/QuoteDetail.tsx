import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface QuoteDetail {
  id: string;
  createdAt: string;
  contact: {
    fullName: string;
    email: string;
    phone?: string;
  };
  origin: {
    countryCode: string;
    postalCode: string;
    state?: string;
    city?: string;
  };
  destination: {
    countryCode: string;
    postalCode: string;
    state?: string;
    city?: string;
  };
  shipment: {
    shipDate?: string;
    pieces: number;
    totalWeight: number;
    weightUnit: string;
    dimensions?: {
      length: number;
      width: number;
      height: number;
      dimUnit: string;
    };
    description?: string;
  };
  accessorials: Record<string, boolean>;
  rates: Array<{
    id: string;
    carrierName: string;
    serviceName: string;
    transitDays?: number;
    totalCost: number;
    currency: string;
  }>;
  bookings: Array<{
    id: string;
    confirmationNumber?: string;
    status: string;
    createdAt: string;
    rate: {
      carrierName: string;
      serviceName: string;
      totalCost: number;
      currency: string;
    };
  }>;
}

export default function QuoteDetail() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const { logout } = useAuth();
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuote();
  }, [quoteId]);

  const loadQuote = async () => {
    try {
      const response = await fetch(`/api/history/quotes/${quoteId}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setQuote(data);
      }
    } catch (error) {
      console.error('Failed to load quote:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US');
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-red-600">Quote not found</div>
      </div>
    );
  }

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
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
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

      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="mb-6">
              <Link to="/history" className="text-indigo-600 hover:text-indigo-900 text-sm">
                ← Back to History
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 mt-2">Quote Details</h1>
              <p className="text-sm text-gray-500 mt-1">Created: {formatDate(quote.createdAt)}</p>
            </div>

            <div className="space-y-6">
              {/* Contact */}
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-3">Contact Information</h2>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Full Name</dt>
                    <dd className="mt-1 text-sm text-gray-900">{quote.contact.fullName}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Email</dt>
                    <dd className="mt-1 text-sm text-gray-900">{quote.contact.email}</dd>
                  </div>
                  {quote.contact.phone && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Phone</dt>
                      <dd className="mt-1 text-sm text-gray-900">{quote.contact.phone}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Origin & Destination */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <h2 className="text-lg font-medium text-gray-900 mb-3">Origin</h2>
                  <dl className="space-y-2">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Postal Code</dt>
                      <dd className="mt-1 text-sm text-gray-900">{quote.origin.postalCode}</dd>
                    </div>
                    {quote.origin.city && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">City</dt>
                        <dd className="mt-1 text-sm text-gray-900">{quote.origin.city}</dd>
                      </div>
                    )}
                    {quote.origin.state && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">State</dt>
                        <dd className="mt-1 text-sm text-gray-900">{quote.origin.state}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Country</dt>
                      <dd className="mt-1 text-sm text-gray-900">{quote.origin.countryCode}</dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <h2 className="text-lg font-medium text-gray-900 mb-3">Destination</h2>
                  <dl className="space-y-2">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Postal Code</dt>
                      <dd className="mt-1 text-sm text-gray-900">{quote.destination.postalCode}</dd>
                    </div>
                    {quote.destination.city && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">City</dt>
                        <dd className="mt-1 text-sm text-gray-900">{quote.destination.city}</dd>
                      </div>
                    )}
                    {quote.destination.state && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">State</dt>
                        <dd className="mt-1 text-sm text-gray-900">{quote.destination.state}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Country</dt>
                      <dd className="mt-1 text-sm text-gray-900">{quote.destination.countryCode}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Shipment */}
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-3">Shipment Details</h2>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {quote.shipment.shipDate && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Ship Date</dt>
                      <dd className="mt-1 text-sm text-gray-900">{quote.shipment.shipDate}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Pieces</dt>
                    <dd className="mt-1 text-sm text-gray-900">{quote.shipment.pieces}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Weight</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {quote.shipment.totalWeight} {quote.shipment.weightUnit}
                    </dd>
                  </div>
                  {quote.shipment.dimensions && (
                    <div className="sm:col-span-3">
                      <dt className="text-sm font-medium text-gray-500">Dimensions</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {quote.shipment.dimensions.length} × {quote.shipment.dimensions.width} ×{' '}
                        {quote.shipment.dimensions.height} {quote.shipment.dimensions.dimUnit}
                      </dd>
                    </div>
                  )}
                  {quote.shipment.description && (
                    <div className="sm:col-span-3">
                      <dt className="text-sm font-medium text-gray-500">Description</dt>
                      <dd className="mt-1 text-sm text-gray-900">{quote.shipment.description}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Accessorials */}
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-3">Accessorials</h2>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(quote.accessorials)
                    .filter(([_, value]) => value)
                    .map(([key, _]) => (
                      <div key={key} className="text-sm text-gray-900">
                        • {key.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                    ))}
                  {Object.values(quote.accessorials).every((v) => !v) && (
                    <div className="text-sm text-gray-500">None</div>
                  )}
                </div>
              </div>

              {/* Rates */}
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-3">Available Rates</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Carrier
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Service
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Transit Days
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {quote.rates.map((rate) => (
                        <tr key={rate.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {rate.carrierName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {rate.serviceName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {rate.transitDays ?? '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatCurrency(rate.totalCost, rate.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bookings */}
              {quote.bookings.length > 0 && (
                <div>
                  <h2 className="text-lg font-medium text-gray-900 mb-3">Bookings</h2>
                  <div className="space-y-4">
                    {quote.bookings.map((booking) => (
                      <div key={booking.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {booking.confirmationNumber || booking.id}
                            </p>
                            <p className="text-sm text-gray-500">
                              {booking.rate.carrierName} {booking.rate.serviceName} •{' '}
                              {formatCurrency(booking.rate.totalCost, booking.rate.currency)}
                            </p>
                          </div>
                          <div className="text-right">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                booking.status === 'confirmed'
                                  ? 'bg-green-100 text-green-800'
                                  : booking.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {booking.status}
                            </span>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDate(booking.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
