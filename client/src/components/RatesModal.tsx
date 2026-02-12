import { useState } from 'react';
import RatesTable from './RatesTable';

interface Rate {
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

interface RatesModalProps {
  rates: Rate[];
  onBook: (rateId: string) => void;
  onClose: () => void;
  loading: boolean;
}

export default function RatesModal({ rates, onBook, onClose, loading }: RatesModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Available Rates</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="overflow-y-auto flex-1 p-6">
          <RatesTable rates={rates} onBook={onBook} loading={loading} />
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
