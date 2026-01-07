import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import RatesForm from './pages/RatesForm';
import History from './pages/History';
import QuoteDetail from './pages/QuoteDetail';
import BookingDetail from './pages/BookingDetail';
import ProtectedRoute from './components/ProtectedRoute';
import HubSpotEmbed from './components/HubSpotEmbed';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <RatesForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <History />
          </ProtectedRoute>
        }
      />
      <Route
        path="/history/quotes/:quoteId"
        element={
          <ProtectedRoute>
            <QuoteDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/history/bookings/:bookingId"
        element={
          <ProtectedRoute>
            <BookingDetail />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <HubSpotEmbed>
          <AppRoutes />
        </HubSpotEmbed>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
