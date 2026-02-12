interface BookingConfirmationProps {
  bookingId?: string;
  confirmationNumber?: string;
  onClose: () => void;
}

export default function BookingConfirmation({ 
  bookingId, 
  confirmationNumber,
  onClose 
}: BookingConfirmationProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-xl">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-lg font-medium text-green-800 mb-4">Request to Book Submitted!</h3>
            <div className="space-y-3">
              {confirmationNumber && (
                <div>
                  <dt className="text-sm font-medium text-gray-700">Confirmation Number</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-semibold">
                    {confirmationNumber}
                  </dd>
                </div>
              )}
              {bookingId && (
                <div>
                  <dt className="text-sm font-medium text-gray-700">Quote ID</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {bookingId}
                  </dd>
                </div>
              )}
              <p className="text-sm text-gray-600 mt-4">
                Your quote/rate request has been saved successfully. S2 International will be notified and will contact you shortly to process your booking.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="bg-s2-red text-white px-6 py-2 rounded hover:bg-s2-red-dark font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
