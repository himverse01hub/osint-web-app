import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export const LoginPage = () => {
  const { login, verifyMfa } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Set after credentials pass but MFA is required: login returns a single-use
  // challenge token that must be exchanged for a session with a TOTP code.
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [totp, setTotp] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('expired') === '1') {
      setNotice('Your session has expired. Please sign in again.');
      try {
        sessionStorage.removeItem('hp_session_expired');
      } catch {
        /* ignore */
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login({ username, password });
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      if (err?.mfaRequired && err?.challengeToken) {
        // Credentials verified — now collect the 6-digit authenticator code.
        setChallengeToken(err.challengeToken);
        setTotp('');
      } else {
        setError(err.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeToken) return;
    setLoading(true);
    setError(null);
    try {
      await verifyMfa(challengeToken, totp);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-police-950">
      <div className="w-full max-w-md space-y-8 p-6">
        <div className="text-center">
          <div className="mx-auto h-12 w-12">
            <svg className="h-12 w-12 text-accent-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gradient">Haryana Police OSINT</h2>
          <p className="text-police-400">Intelligence Platform</p>
        </div>
        {challengeToken ? (
          <form className="space-y-6" onSubmit={handleMfaSubmit}>
            <div className="text-center">
              <p className="text-sm text-police-300">
                Two-factor authentication is enabled for this account. Enter the 6-digit code from your
                authenticator app to continue.
              </p>
            </div>
            <div>
              <label htmlFor="totp" className="block text-sm font-medium text-police-300 mb-2">
                Verification code
              </label>
              <input
                id="totp"
                type="text"
                required
                autoFocus
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="one-time-code"
                className="input-field w-full text-center text-2xl tracking-[0.5em] font-mono"
                value={totp}
                onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading || totp.length !== 6}>
              {loading ? 'Verifying...' : 'Verify and sign in'}
            </button>
            <button
              type="button"
              className="w-full text-sm text-police-400 hover:text-police-300"
              onClick={() => {
                setChallengeToken(null);
                setTotp('');
                setError(null);
              }}
            >
              ← Back to sign in
            </button>
          </form>
        ) : (
          <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-police-300 mb-2">
              Username
            </label>
            <input
              id="username"
              type="text"
              required
              autoComplete="username"
              className="input-field w-full"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-police-300 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                className="input-field w-full pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-police-400 hover:text-police-300"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                    <line x1="3" y1="3" x2="21" y2="21"></line>
                  </svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
          </div>
          <button
            type="submit"
            className="btn-primary w-full"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
          {notice && (
            <div className="bg-amber-900/40 border border-amber-700 text-amber-300 px-4 py-3 rounded-lg">
              {notice}
            </div>
          )}
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          </form>
        )}
        <div className="text-center text-police-500 text-sm">
          <p>
            This is a secured system. Access is restricted to authorised personnel only.
          </p>
          <p className="mt-1">
            Login credentials are set from Settings → Account. All activities are monitored and logged.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;