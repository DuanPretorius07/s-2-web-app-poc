import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface Quote {
  id: string;
  createdAt: string;
  contact: {
    fullName: string;
    email: string;
  };
  origin: {
    postalCode: string;
    countryCode: string;
  };
  destination: {
    postalCode: string;
    countryCode: string;
  };
  shipment: {
    pieces: number;
    totalWeight: number;
    weightUnit: string;
  };
  ratesCount: number;
}

interface Booking {
  id: string;
  bookingIdExternal?: string;
  confirmationNumber?: string;
  status: string;
  createdAt: string;
  carrierName: string;
  serviceName: string;
  totalCost: number;
  currency: string;
  origin: {
    postalCode: string;
  };
  destination: {
    postalCode: string;
  };
}

export default function History() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'quotes' | 'bookings'>('quotes');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    originPostal: '',
    destinationPostal: '',
    carrier: '',
    status: '',
  });

  useEffect(() => {
    loadData();
  }, [activeTab, filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.originPostal) params.append('originPostal', filters.originPostal);
      if (filters.destinationPostal) params.append('destinationPostal', filters.destinationPostal);
      if (filters.carrier) params.append('carrier', filters.carrier);
      if (filters.status) params.append('status', filters.status);

      const endpoint = activeTab === 'quotes' ? '/api/history/quotes' : '/api/history/bookings';
      const response = await fetch(`${endpoint}?${params.toString()}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (activeTab === 'quotes') {
          setQuotes(data.quotes || []);
        } else {
          setBookings(data.bookings || []);
        }
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
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
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Get Rates
                </Link>
                <Link
                  to="/history"
                  className="border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
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

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('quotes')}
                className={`${
                  activeTab === 'quotes'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Past Quotes
              </button>
              <button
                onClick={() => setActiveTab('bookings')}
                className={`${
                  activeTab === 'bookings'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Past Bookings
              </button>
            </nav>
          </div>

          {/* Filters */}
          <div className="bg-white shadow rounded-lg p-4 mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Filters</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Start Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">End Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Origin Postal</label>
                <input
                  type="text"
                  value={filters.originPostal}
                  onChange={(e) => setFilters({ ...filters, originPostal: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Destination Postal</label>
                <input
                  type="text"
                  value={filters.destinationPostal}
                  onChange={(e) => setFilters({ ...filters, destinationPostal: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Carrier</label>
                <input
                  type="text"
                  value={filters.carrier}
                  onChange={(e) => setFilters({ ...filters, carrier: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              {activeTab === 'bookings' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="">All</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Results */}
          {loading ? (
            <div className="text-center py-12">
              <div className="text-lg text-gray-500">Loading...</div>
            </div>
          ) : activeTab === 'quotes' ? (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              {quotes.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">No quotes found</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {quotes.map((quote) => (
                    <li key={quote.id}>
                      <Link
                        to={`/history/quotes/${quote.id}`}
                        className="block hover:bg-gray-50 px-4 py-4 sm:px-6"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center">
                              <p className="text-sm font-medium text-indigo-600">
                                {quote.contact.fullName}
                              </p>
                              <p className="ml-2 text-sm text-gray-500">{quote.contact.email}</p>
                            </div>
                            <div className="mt-2 flex items-center text-sm text-gray-500">
                              <span>
                                {quote.origin.postalCode} → {quote.destination.postalCode}
                              </span>
                              <span className="mx-2">•</span>
                              <span>
                                {quote.shipment.pieces} piece{quote.shipment.pieces !== 1 ? 's' : ''}
                              </span>
                              <span className="mx-2">•</span>
                              <span>
                                {quote.shipment.totalWeight} {quote.shipment.weightUnit}
                              </span>
                              <span className="mx-2">•</span>
                              <span>{quote.ratesCount} rate{quote.ratesCount !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                          <div className="ml-4 text-sm text-gray-500">
                            {formatDate(quote.createdAt)}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              {bookings.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">No bookings found</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {bookings.map((booking) => (
                    <li key={booking.id}>
                      <Link
                        to={`/history/bookings/${booking.id}`}
                        className="block hover:bg-gray-50 px-4 py-4 sm:px-6"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center">
                              <p className="text-sm font-medium text-indigo-600">
                                {booking.confirmationNumber || booking.bookingIdExternal || booking.id}
                              </p>
                              <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                booking.status === 'confirmed'
                                  ? 'bg-green-100 text-green-800'
                                  : booking.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {booking.status}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center text-sm text-gray-500">
                              <span>{booking.carrierName} {booking.serviceName}</span>
                              <span className="mx-2">•</span>
                              <span>
                                {booking.origin.postalCode} → {booking.destination.postalCode}
                              </span>
                              <span className="mx-2">•</span>
                              <span className="font-medium text-gray-900">
                                {formatCurrency(booking.totalCost, booking.currency)}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4 text-sm text-gray-500">
                            {formatDate(booking.createdAt)}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
