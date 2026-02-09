import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AnimatedBackground from '../components/AnimatedBackground';
import Navbar from '../components/Navbar';
import QuoteForm from '../components/QuoteForm';

export default function RatesForm() {
  const { user, logout } = useAuth();
  const location = useLocation();

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'RatesForm.tsx:return',
        message: 'RatesForm rendering with QuoteForm',
        data: { hasAnimatedBg: true, hasNavbar: true, pathname: location.pathname },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run-quoteform',
        hypothesisId: 'C2',
      }),
    }).catch(() => {});
  }, [location.pathname]);
  // #endregion

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: 'transparent' }}>
      <AnimatedBackground />
      <Navbar currentPath={location.pathname} userEmail={user?.email} onLogout={logout} />

      <div className="py-8 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-6xl mx-auto">
          <QuoteForm />
        </div>
      </div>
    </div>
  );
}

