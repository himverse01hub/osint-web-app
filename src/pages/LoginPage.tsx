import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login({ email, password });
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Login failed');
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
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-police-300 mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              className="input-field w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your official email"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-police-300 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              className="input-field w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember"
                type="checkbox"
                className="h-4 w-4 text-accent-cyan focus:ring-police-500 border-police-600 rounded"
              />
              <label htmlFor="remember" className="ml-2 text-sm text-police-400">
                Remember me
              </label>
            </div>
            <button
              type="button"
              className="text-sm text-police-400 hover:text-police-300"
            >
              Forgot Password?
            </button>
          </div>
          <button
            type="submit"
            className="btn-primary w-full"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
        </form>
        <div className="text-center text-police-500 text-sm">
          <p>
            This is a secured system. Access is restricted to authorised personnel only.
          </p>
          <p className="mt-1">
            All activities are monitored and logged for audit purposes.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

