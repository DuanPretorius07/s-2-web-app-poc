import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import AnimatedBackground from '../components/AnimatedBackground';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { login, register } = useAuth();
  const navigate = useNavigate();

  // Password validation function
  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[a-zA-Z]/.test(pwd)) {
      return 'Password must contain at least one letter';
    }
    if (!/[0-9]/.test(pwd)) {
      return 'Password must contain at least one number';
    }
    return null; // Valid
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setPasswordError(null);
    setLoading(true);

    try {
      if (isRegister) {
        // Client-side validation
        const pwdError = validatePassword(password);
        if (pwdError) {
          setPasswordError(pwdError);
          setLoading(false);
          return;
        }

        try {
          await register({
            email,
            password,
            firstName,
            lastName,
            companyName: companyName || undefined,
            // HubSpot/CRM sync is now always enabled for new registrations
            hubspotOptIn: true,
          });
          navigate('/');
        } catch (err: any) {
          // Handle structured validation errors from backend
          const errorData = (err as any).errorData;
          if (errorData && errorData.errorCode === 'VALIDATION_ERROR' && errorData.errors) {
            const errors: Record<string, string> = {};
            errorData.errors.forEach((errItem: any) => {
              const fieldName = errItem.field || errItem.path?.join('.') || '';
              errors[fieldName] = errItem.message;
            });
            setFieldErrors(errors);
            setError('Please fix the errors below');
          } else {
            setError(err.message || 'Registration failed');
          }
        }
      } else {
        await login(email, password);
        navigate('/');
      }
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
              <>
                <div>
                  <label htmlFor="first-name" className="sr-only">
                    First name
                  </label>
                  <input
                    id="first-name"
                    name="firstName"
                    type="text"
                    required
                    className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${
                      fieldErrors.firstName ? 'border-red-500' : 'border-gray-300'
                    } placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-s2-red focus:border-s2-red focus:z-10 sm:text-sm`}
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      if (fieldErrors.firstName) {
                        setFieldErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors.firstName;
                          return newErrors;
                        });
                      }
                    }}
                  />
                  {fieldErrors.firstName && (
                    <p className="text-red-500 text-sm mt-1">{fieldErrors.firstName}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="last-name" className="sr-only">
                    Last name
                  </label>
                  <input
                    id="last-name"
                    name="lastName"
                    type="text"
                    required
                    className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${
                      fieldErrors.lastName ? 'border-red-500' : 'border-gray-300'
                    } placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-s2-red focus:border-s2-red focus:z-10 sm:text-sm`}
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      if (fieldErrors.lastName) {
                        setFieldErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors.lastName;
                          return newErrors;
                        });
                      }
                    }}
                  />
                  {fieldErrors.lastName && (
                    <p className="text-red-500 text-sm mt-1">{fieldErrors.lastName}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="company-name" className="sr-only">
                    Company name (optional)
                  </label>
                  <input
                    id="company-name"
                    name="companyName"
                    type="text"
                    className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${
                      fieldErrors.clientName ? 'border-red-500' : 'border-gray-300'
                    } placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-s2-red focus:border-s2-red focus:z-10 sm:text-sm`}
                    placeholder="Company name (optional)"
                    value={companyName}
                    onChange={(e) => {
                      setCompanyName(e.target.value);
                      if (fieldErrors.clientName) {
                        setFieldErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors.clientName;
                          return newErrors;
                        });
                      }
                    }}
                  />
                  {fieldErrors.clientName && (
                    <p className="text-red-500 text-sm mt-1">{fieldErrors.clientName}</p>
                  )}
                </div>
              </>
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
                className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${
                  fieldErrors.email ? 'border-red-500' : 'border-gray-300'
                } placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-s2-red focus:border-s2-red focus:z-10 sm:text-sm`}
                placeholder="Email address"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) {
                    setFieldErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors.email;
                      return newErrors;
                    });
                  }
                }}
              />
              {fieldErrors.email && (
                <p className="text-red-500 text-sm mt-1">{fieldErrors.email}</p>
              )}
            </div>
            <div className="relative">
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
                className={`appearance-none rounded-none relative block w-full px-3 pr-10 py-2 border ${
                  passwordError || fieldErrors.password
                    ? 'border-red-500'
                    : 'border-gray-300'
                } placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-s2-red focus:border-s2-red focus:z-10 sm:text-sm`}
                placeholder="Password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (isRegister) {
                    const error = validatePassword(e.target.value);
                    setPasswordError(error);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <svg
                  className="h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {showPassword ? (
                    <>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M3 3l18 18M10.477 10.489A3 3 0 0113.5 13.5M6.228 6.228C4.38 7.418 3 9.273 3 12c1.5 3.5 4.5 5.5 9 5.5 1.61 0 3.03-.26 4.272-.75M9.88 9.88A3 3 0 0114.12 14.12M9.88 9.88L7.05 7.05M14.12 14.12L16.95 16.95"
                      />
                    </>
                  ) : (
                    <>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M2.25 12C3.75 8.5 6.75 6.5 11.25 6.5s7.5 2 9 5.5c-1.5 3.5-4.5 5.5-9 5.5s-7.5-2-9-5.5z"
                      />
                      <circle
                        cx="11.25"
                        cy="12"
                        r="2.25"
                        strokeWidth={1.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </>
                  )}
                </svg>
              </button>
            </div>
            {/* Password requirements and error messages */}
            {isRegister && (
              <div className="mt-2">
                <div className="text-xs text-gray-600 mb-2">
                  Password must:
                  <ul className="list-disc ml-5 mt-1 space-y-0.5">
                    <li className={password.length >= 8 ? 'text-green-600' : ''}>
                      Be at least 8 characters
                    </li>
                    <li className={/[a-zA-Z]/.test(password) ? 'text-green-600' : ''}>
                      Contain at least one letter
                    </li>
                    <li className={/[0-9]/.test(password) ? 'text-green-600' : ''}>
                      Contain at least one number
                    </li>
                  </ul>
                </div>
                {passwordError && (
                  <p className="text-red-500 text-sm mt-1">{passwordError}</p>
                )}
                {fieldErrors.password && (
                  <p className="text-red-500 text-sm mt-1">{fieldErrors.password}</p>
                )}
              </div>
            )}
          </div>

          {!isRegister && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={(e) => e.preventDefault()}
                className="text-sm text-s2-red hover:text-s2-red-dark font-medium"
              >
                Forgot password?
              </button>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-s2-red hover:bg-s2-red-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-s2-red disabled:opacity-50 transition-colors shadow-md hover:shadow-lg"
            >
              {loading ? 'Processing...' : isRegister ? 'Register' : 'Sign in'}
            </button>
          </div>

          {/* CRM sync notice - moved to bottom after submit button */}
          {isRegister && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-xs text-blue-800 text-center">
                ℹ️ Your contact information will be automatically synced to our CRM system to provide you with the best service.
              </p>
            </div>
          )}

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
