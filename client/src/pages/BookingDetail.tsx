import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface BookingDetail {
  id: string;
  bookingIdExternal?: string;
  confirmationNumber?: string;
  status: string;
  createdAt: string;
  rate: {
    id: string;
    carrierName: string;
    serviceName: string;
    transitDays?: number;
    totalCost: number;
    currency: string;
  };
  quoteRequest: {
    id: string;
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
  };
}

export default function BookingDetail() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { logout } = useAuth();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBooking();
  }, [bookingId]);

  const loadBooking = async () => {
    try {
      const response = await fetch(`/api/history/bookings/${bookingId}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setBooking(data);
      }
    } catch (error) {
      console.error('Failed to load booking:', error);
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

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-red-600">Booking not found</div>
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
              <h1 className="text-2xl font-bold text-gray-900 mt-2">Booking Details</h1>
              <p className="text-sm text-gray-500 mt-1">Created: {formatDate(booking.createdAt)}</p>
            </div>

            <div className="space-y-6">
              {/* Booking Info */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h2 className="text-lg font-medium text-green-900 mb-3">Booking Confirmation</h2>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-green-700">Confirmation Number</dt>
                    <dd className="mt-1 text-sm text-green-900 font-semibold">
                      {booking.confirmationNumber || booking.bookingIdExternal || booking.id}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-green-700">Status</dt>
                    <dd className="mt-1">
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
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Rate Info */}
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-3">Selected Rate</h2>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Carrier</dt>
                    <dd className="mt-1 text-sm text-gray-900">{booking.rate.carrierName}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Service</dt>
                    <dd className="mt-1 text-sm text-gray-900">{booking.rate.serviceName}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Total Cost</dt>
                    <dd className="mt-1 text-sm font-semibold text-gray-900">
                      {formatCurrency(booking.rate.totalCost, booking.rate.currency)}
                    </dd>
                  </div>
                  {booking.rate.transitDays && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Transit Days</dt>
                      <dd className="mt-1 text-sm text-gray-900">{booking.rate.transitDays}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Contact */}
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-3">Contact Information</h2>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Full Name</dt>
                    <dd className="mt-1 text-sm text-gray-900">{booking.quoteRequest.contact.fullName}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Email</dt>
                    <dd className="mt-1 text-sm text-gray-900">{booking.quoteRequest.contact.email}</dd>
                  </div>
                  {booking.quoteRequest.contact.phone && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Phone</dt>
                      <dd className="mt-1 text-sm text-gray-900">{booking.quoteRequest.contact.phone}</dd>
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
                      <dd className="mt-1 text-sm text-gray-900">
                        {booking.quoteRequest.origin.postalCode}
                      </dd>
                    </div>
                    {booking.quoteRequest.origin.city && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">City</dt>
                        <dd className="mt-1 text-sm text-gray-900">{booking.quoteRequest.origin.city}</dd>
                      </div>
                    )}
                    {booking.quoteRequest.origin.state && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">State</dt>
                        <dd className="mt-1 text-sm text-gray-900">{booking.quoteRequest.origin.state}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Country</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {booking.quoteRequest.origin.countryCode}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <h2 className="text-lg font-medium text-gray-900 mb-3">Destination</h2>
                  <dl className="space-y-2">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Postal Code</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {booking.quoteRequest.destination.postalCode}
                      </dd>
                    </div>
                    {booking.quoteRequest.destination.city && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">City</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {booking.quoteRequest.destination.city}
                        </dd>
                      </div>
                    )}
                    {booking.quoteRequest.destination.state && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">State</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {booking.quoteRequest.destination.state}
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Country</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {booking.quoteRequest.destination.countryCode}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Shipment */}
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-3">Shipment Details</h2>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {booking.quoteRequest.shipment.shipDate && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Ship Date</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {booking.quoteRequest.shipment.shipDate}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Pieces</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {booking.quoteRequest.shipment.pieces}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Weight</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {booking.quoteRequest.shipment.totalWeight}{' '}
                      {booking.quoteRequest.shipment.weightUnit}
                    </dd>
                  </div>
                  {booking.quoteRequest.shipment.dimensions && (
                    <div className="sm:col-span-3">
                      <dt className="text-sm font-medium text-gray-500">Dimensions</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {booking.quoteRequest.shipment.dimensions.length} ×{' '}
                        {booking.quoteRequest.shipment.dimensions.width} ×{' '}
                        {booking.quoteRequest.shipment.dimensions.height}{' '}
                        {booking.quoteRequest.shipment.dimensions.dimUnit}
                      </dd>
                    </div>
                  )}
                  {booking.quoteRequest.shipment.description && (
                    <div className="sm:col-span-3">
                      <dt className="text-sm font-medium text-gray-500">Description</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {booking.quoteRequest.shipment.description}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Accessorials */}
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-3">Accessorials</h2>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(booking.quoteRequest.accessorials)
                    .filter(([_, value]) => value)
                    .map(([key, _]) => (
                      <div key={key} className="text-sm text-gray-900">
                        • {key.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                    ))}
                  {Object.values(booking.quoteRequest.accessorials).every((v) => !v) && (
                    <div className="text-sm text-gray-500">None</div>
                  )}
                </div>
              </div>

              {/* Link to Quote */}
              <div className="pt-4 border-t border-gray-200">
                <Link
                  to={`/history/quotes/${booking.quoteRequest.id}`}
                  className="text-indigo-600 hover:text-indigo-900 text-sm"
                >
                  View original quote →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
