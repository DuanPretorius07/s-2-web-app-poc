import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, tokenExpired } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Don't redirect if token is expired - let the expiration modal handle the redirect
  // This allows the modal to show before redirecting to login
  if (!user && !tokenExpired) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
