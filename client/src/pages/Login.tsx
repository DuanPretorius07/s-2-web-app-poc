import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import AnimatedBackground from '../components/AnimatedBackground';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [clientName, setClientName] = useState('');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await register(email, password, clientName);
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative" style={{ backgroundColor: 'transparent' }}>
      <AnimatedBackground />
      <div className="max-w-md w-full space-y-8 relative z-10">
        <div className="flex flex-col items-center">
          <img 
            src="/s2-logo.png" 
            alt="S-2 International Logo" 
            className="h-32 w-32 md:h-36 md:w-36 object-contain mb-4"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (!target.src.includes('s2-logo.png')) {
                target.src = '/logo.png';
              }
            }}
          />
          <h2 className="mt-6 text-center text-3xl font-extrabold text-s2-red">
            {isRegister ? 'Create Account' : 'Sign in to your account'}
          </h2>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-8 bg-opacity-95">
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}
          <div className="rounded-md shadow-sm -space-y-px">
            {isRegister && (
              <div>
                <label htmlFor="client-name" className="sr-only">
                  Client Name
                </label>
                <input
                  id="client-name"
                  name="clientName"
                  type="text"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-s2-red focus:border-s2-red focus:z-10 sm:text-sm"
                  placeholder="Company/Client Name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </div>
            )}
            <div>
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-s2-red focus:border-s2-red focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-s2-red focus:border-s2-red focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-s2-red hover:bg-s2-red-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-s2-red disabled:opacity-50 transition-colors shadow-md hover:shadow-lg"
            >
              {loading ? 'Processing...' : isRegister ? 'Register' : 'Sign in'}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
              className="text-sm text-s2-red hover:text-s2-red-dark font-medium"
            >
              {isRegister
                ? 'Already have an account? Sign in'
                : "Don't have an account? Register"}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
