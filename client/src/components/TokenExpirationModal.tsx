import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface TokenExpirationModalProps {
  isOpen: boolean;
}

export default function TokenExpirationModal({ isOpen }: TokenExpirationModalProps) {
  const { logout, setTokenExpired } = useAuth();
  const navigate = useNavigate();

  const handleRedirect = async () => {
    // Clear expiration state first to prevent modal from showing during logout
    setTokenExpired(false);
    await logout();
    navigate('/login', { replace: true });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-50"
      onClick={handleRedirect}
    >
      <div
        className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0">
            <svg
              className="h-6 w-6 text-yellow-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="ml-3 text-lg font-medium text-gray-900">
            Session Expired
          </h3>
        </div>
        <div className="mt-2">
          <p className="text-sm text-gray-500">
            Your session has expired. Click the button below to return to the login page where you can log in again to refresh your session.
          </p>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleRedirect}
            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-s2-red border border-transparent rounded-md hover:bg-s2-red-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-s2-red"
          >
            Return to Login
          </button>
        </div>
      </div>
    </div>
  );
}
