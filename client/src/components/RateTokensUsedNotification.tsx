import { useState, useEffect } from 'react';

interface RateTokensUsedNotificationProps {
  tokensRemaining: number | null | undefined;
  tokensUsed: number | null | undefined;
  onClose: () => void;
}

export default function RateTokensUsedNotification({
  tokensRemaining,
  tokensUsed,
  onClose,
}: RateTokensUsedNotificationProps) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    // Auto-hide after 8 seconds
    const timer = setTimeout(() => {
      setShow(false);
      setTimeout(onClose, 300); // Wait for fade-out animation
    }, 8000);

    return () => clearTimeout(timer);
  }, [onClose]);

  if (!show) return null;

  const remaining = tokensRemaining ?? 0;
  const isLow = remaining <= 1;
  const isEmpty = remaining === 0;

  return (
    <div className="fixed top-4 right-4 z-[9999] max-w-md animate-slide-in">
      <div
        className={`rounded-lg shadow-lg p-6 border-2 ${
          isEmpty
            ? 'bg-red-50 border-red-200'
            : isLow
            ? 'bg-yellow-50 border-yellow-200'
            : 'bg-blue-50 border-blue-200'
        }`}
      >
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {isEmpty ? (
              <span className="text-2xl">⚠️</span>
            ) : isLow ? (
              <span className="text-2xl">📊</span>
            ) : (
              <span className="text-2xl">✅</span>
            )}
          </div>
          <div className="ml-3 flex-1">
            <h3
              className={`text-lg font-semibold mb-2 ${
                isEmpty ? 'text-red-800' : isLow ? 'text-yellow-800' : 'text-blue-800'
              }`}
            >
              {isEmpty
                ? 'Rate Requests Exhausted'
                : isLow
                ? 'Rate Requests Running Low'
                : 'Rate Request Successful'}
            </h3>
            <p
              className={`text-sm mb-3 ${
                isEmpty ? 'text-red-700' : isLow ? 'text-yellow-700' : 'text-blue-700'
              }`}
            >
              {isEmpty ? (
                <>
                  You have used all 3 rate requests. Please contact{' '}
                  <a
                    href="https://www.s-2international.com/contact"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-semibold"
                  >
                    S2 International
                  </a>{' '}
                  directly for additional quotes.
                </>
              ) : (
                <>
                  Rate request completed successfully. You have{' '}
                  <strong>{remaining} rate request{remaining === 1 ? '' : 's'}</strong> remaining
                  out of 3 total.
                </>
              )}
            </p>
            <button
              onClick={() => {
                setShow(false);
                setTimeout(onClose, 300);
              }}
              className={`mt-2 px-4 py-2 rounded font-semibold text-sm ${
                isEmpty
                  ? 'bg-red-100 text-red-800 hover:bg-red-200'
                  : isLow
                  ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                  : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
              }`}
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
