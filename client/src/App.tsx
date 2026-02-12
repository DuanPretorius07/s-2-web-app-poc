import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import RatesForm from './pages/RatesForm';
// NOTE: History-related pages are intentionally commented out per client request.
// They remain in the codebase for future use but are not exposed in the UI.
// import History from './pages/History';
// import QuoteDetail from './pages/QuoteDetail';
// import BookingDetail from './pages/BookingDetail';
import ProtectedRoute from './components/ProtectedRoute';
import HubSpotEmbed from './components/HubSpotEmbed';
import HelpButton from './components/HelpButton';
import RateTokensNotification from './components/RateTokensNotification';

function AppRoutes() {
  const { user, loading } = useAuth();

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:AppRoutes:render',message:'AppRoutes rendering',data:{loading,hasUser:!!user,userEmail:user?.email,pathname:window.location.pathname},timestamp:Date.now(),runId:'debug-blank-screen',hypothesisId:'H2'})}).catch(()=>{});
  }, [loading, user]);
  // #endregion

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
      {/*
        History and detail routes are disabled for now.
        They can be re-enabled by uncommenting these routes when the client is ready.

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
      */}
    </Routes>
  );
}

function App() {
  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:App:mount',message:'App component mounted',data:{pathname:window.location.pathname,userAgent:navigator.userAgent.substring(0,100)},timestamp:Date.now(),runId:'debug-blank-screen',hypothesisId:'H3'})}).catch(()=>{});
  }, []);
  // #endregion

  return (
    <BrowserRouter>
      <AuthProvider>
        <HubSpotEmbed>
          <AppRoutes />
          <HelpButton />
        </HubSpotEmbed>
        <RateTokensNotification />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
