import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function RateTokensNotification() {
  const { user } = useAuth();
  const [showNotification, setShowNotification] = useState(false);
  const [hasShown, setHasShown] = useState(false);

  useEffect(() => {
    // Only show notification once per session
    if (hasShown || !user) return;

    const tokensRemaining = user.rateTokensRemaining ?? 3;
    const tokensUsed = user.rateTokensUsed ?? 0;
    const isNewUser = tokensUsed === 0 && tokensRemaining === 3;
    const hasNoTokens = tokensRemaining === 0;

    // Show notification for new users or users with no tokens
    if (isNewUser || hasNoTokens) {
      setShowNotification(true);
      setHasShown(true);
    }
  }, [user, hasShown]);

  if (!showNotification || !user) return null;

  const tokensRemaining = user.rateTokensRemaining ?? 3;
  const tokensUsed = user.rateTokensUsed ?? 0;
  const isNewUser = tokensUsed === 0 && tokensRemaining === 3;
  const hasNoTokens = tokensRemaining === 0;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md animate-slide-in">
      <div
        className={`rounded-lg shadow-lg p-6 border-2 ${
          hasNoTokens
            ? 'bg-red-50 border-red-200'
            : isNewUser
            ? 'bg-blue-50 border-blue-200'
            : 'bg-yellow-50 border-yellow-200'
        }`}
      >
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {hasNoTokens ? (
              <span className="text-2xl">⚠️</span>
            ) : isNewUser ? (
              <span className="text-2xl">ℹ️</span>
            ) : (
              <span className="text-2xl">📊</span>
            )}
          </div>
          <div className="ml-3 flex-1">
            <h3
              className={`text-lg font-semibold mb-2 ${
                hasNoTokens ? 'text-red-800' : isNewUser ? 'text-blue-800' : 'text-yellow-800'
              }`}
            >
              {hasNoTokens
                ? 'Rate Requests Exhausted'
                : isNewUser
                ? 'Welcome! Rate Request Limit'
                : 'Rate Requests Remaining'}
            </h3>
            <p
              className={`text-sm mb-3 ${
                hasNoTokens ? 'text-red-700' : isNewUser ? 'text-blue-700' : 'text-yellow-700'
              }`}
            >
              {hasNoTokens ? (
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
              ) : isNewUser ? (
                <>
                  You have <strong>3 rate requests</strong> available. Once you've used all 3, please
                  contact{' '}
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
                  You have <strong>{tokensRemaining} rate request{tokensRemaining === 1 ? '' : 's'}</strong> remaining
                  out of 3 total.
                </>
              )}
            </p>
            <button
              onClick={() => setShowNotification(false)}
              className={`mt-2 px-4 py-2 rounded font-semibold text-sm ${
                hasNoTokens
                  ? 'bg-red-100 text-red-800 hover:bg-red-200'
                  : isNewUser
                  ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                  : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
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
