import { useState } from 'react';

interface Rate {
  id: string;
  rateId?: string;
  name?: string; // Primary carrier name field
  carrierName: string; // Backward compatibility
  serviceName: string;
  transitDays?: number;
  totalCost: number;
  currency: string;
  iconUrl?: string;
  booked?: boolean;
}

interface RatesTableProps {
  rates: Rate[];
  onBook: (rateId: string) => void;
  loading: boolean;
}

type SortField = 'carrierName' | 'serviceName' | 'transitDays' | 'totalCost';
type SortDirection = 'asc' | 'desc';

export default function RatesTable({ rates, onBook, loading }: RatesTableProps) {
  const [sortField, setSortField] = useState<SortField>('totalCost');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [bookingRateId, setBookingRateId] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedRates = [...rates].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];

    if (sortField === 'totalCost') {
      aVal = a.totalCost;
      bVal = b.totalCost;
    } else if (sortField === 'transitDays') {
      aVal = a.transitDays ?? Infinity;
      bVal = b.transitDays ?? Infinity;
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleBookClick = async (rateId: string) => {
    // Prevent duplicate clicks
    if (bookingRateId === rateId || loading) {
      return;
    }
    
    setBookingRateId(rateId);
    try {
      await onBook(rateId);
    } finally {
      // Don't clear bookingRateId immediately - let parent component handle state
      // This prevents rapid re-clicks
      setTimeout(() => {
        setBookingRateId(null);
      }, 1000);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-gray-400">↕</span>;
    }
    return sortDirection === 'asc' ? <span>↑</span> : <span>↓</span>;
  };

  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Available Rates</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('carrierName')}
              >
                <div className="flex items-center space-x-1">
                  <span>Carrier</span>
                  <SortIcon field="carrierName" />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('serviceName')}
              >
                <div className="flex items-center space-x-1">
                  <span>Service</span>
                  <SortIcon field="serviceName" />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('transitDays')}
              >
                <div className="flex items-center space-x-1">
                  <span>Transit Days</span>
                  <SortIcon field="transitDays" />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('totalCost')}
              >
                <div className="flex items-center space-x-1">
                  <span>Total</span>
                  <SortIcon field="totalCost" />
                </div>
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedRates.map((rate) => (
              <tr key={rate.id} className={rate.booked ? 'bg-green-50' : ''}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  <div className="flex items-center space-x-3">
                    {rate.iconUrl ? (
                      <img
                        src={rate.iconUrl}
                        alt={rate.name || rate.carrierName}
                        className="h-8 w-8 object-contain"
                        onError={(e) => {
                          // Hide image if it fails to load
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="h-8 w-8 bg-gray-200 rounded flex items-center justify-center text-xs font-semibold text-gray-600">
                        {(rate.name || rate.carrierName).substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span>{rate.name || rate.carrierName}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {rate.serviceName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {rate.transitDays !== null && rate.transitDays !== undefined
                    ? `${rate.transitDays}`
                    : '—'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {formatCurrency(rate.totalCost, rate.currency)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {rate.booked ? (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
                      ✓ Booked
                    </span>
                  ) : (
                    <button
                      onClick={() => handleBookClick(rate.id)}
                      disabled={loading || bookingRateId === rate.id}
                      className={`inline-flex items-center px-4 py-2 rounded-lg font-semibold text-sm shadow-md hover:shadow-lg transition-colors ${
                        loading || bookingRateId === rate.id
                          ? 'bg-gray-400 cursor-not-allowed text-white'
                          : 'bg-s2-red hover:bg-s2-red-dark text-white'
                      }`}
                    >
                      {bookingRateId === rate.id ? (
                        <>
                          <svg
                            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                          Booking...
                        </>
                      ) : (
                        'Request to Book'
                      )}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
