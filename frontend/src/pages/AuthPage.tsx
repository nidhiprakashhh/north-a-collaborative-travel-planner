import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/apiClient';

export function AuthPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      navigate('/trips');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-800">North</h1>
        <div className="flex gap-2 text-sm">
          <button
            className={mode === 'login' ? 'font-semibold text-slate-800' : 'text-slate-400'}
            onClick={() => setMode('login')}
          >
            Log in
          </button>
          <span className="text-slate-300">/</span>
          <button
            className={mode === 'register' ? 'font-semibold text-slate-800' : 'text-slate-400'}
            onClick={() => setMode('register')}
          >
            Register
          </button>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <input
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <input
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-slate-800 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
