interface BookingConfirmationProps {
  confirmation: {
    bookingId: string;
    confirmationNumber?: string;
    status: string;
    rate: {
      carrierName: string;
      serviceName: string;
      totalCost: number;
      currency: string;
    };
  };
}

export default function BookingConfirmation({ confirmation }: BookingConfirmationProps) {
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  return (
    <div className="rounded-md bg-green-50 p-6 border border-green-200">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-lg font-medium text-green-800 mb-4">Booked successfully</h3>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-green-700">Confirmation Number</dt>
              <dd className="mt-1 text-sm text-green-900">
                {confirmation.confirmationNumber || confirmation.bookingId}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-green-700">Status</dt>
              <dd className="mt-1 text-sm text-green-900 capitalize">{confirmation.status}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-green-700">Carrier</dt>
              <dd className="mt-1 text-sm text-green-900">{confirmation.rate.carrierName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-green-700">Service</dt>
              <dd className="mt-1 text-sm text-green-900">{confirmation.rate.serviceName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-green-700">Total Cost</dt>
              <dd className="mt-1 text-sm text-green-900 font-semibold">
                {formatCurrency(confirmation.rate.totalCost, confirmation.rate.currency)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
