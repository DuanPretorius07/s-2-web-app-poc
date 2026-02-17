import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function RateTokensNotification() {
  const { user } = useAuth();
  const [showNotification, setShowNotification] = useState(false);
  const previousTokensRef = useRef<{ remaining: number | null; used: number | null } | null>(null);

  useEffect(() => {
    if (!user) {
      setShowNotification(false);
      previousTokensRef.current = null;
      return;
    }

    const tokensRemaining = user.rateTokensRemaining ?? 3;
    const tokensUsed = user.rateTokensUsed ?? 0;
    const previousTokens = previousTokensRef.current;

    // Show notification:
    // 1. After login (when user first loads and has tokens)
    // 2. After rate search (when tokens change)
    const shouldShow = 
      // First time user loads (after login)
      previousTokens === null ||
      // Tokens changed (after rate search)
      (previousTokens.remaining !== tokensRemaining || previousTokens.used !== tokensUsed);

    if (shouldShow) {
      setShowNotification(true);
      previousTokensRef.current = {
        remaining: tokensRemaining,
        used: tokensUsed,
      };
      
      // Auto-hide after 8 seconds
      const timer = setTimeout(() => {
        setShowNotification(false);
      }, 8000);
      
      return () => clearTimeout(timer);
    }
  }, [user]);

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
