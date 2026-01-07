import { useState } from 'react';

interface Rate {
  id: string;
  rateId?: string;
  carrierName: string;
  serviceName: string;
  transitDays?: number;
  totalCost: number;
  currency: string;
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
    setBookingRateId(rateId);
    try {
      await onBook(rateId);
    } finally {
      setBookingRateId(null);
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
                  {rate.carrierName}
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
                    <span className="text-green-600">Booked</span>
                  ) : (
                    <button
                      onClick={() => handleBookClick(rate.id)}
                      disabled={loading || bookingRateId === rate.id}
                      className="text-indigo-600 hover:text-indigo-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {bookingRateId === rate.id ? 'Booking...' : 'Book'}
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
