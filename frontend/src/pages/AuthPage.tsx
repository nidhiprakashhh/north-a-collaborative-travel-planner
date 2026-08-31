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

  async function handleDemoLogin() {
    setError(null);
    setSubmitting(true);
    try {
      await login('demo@example.com', 'NorthDemo2026');
      navigate('/trips');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sun">
      <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-sm">
        <h1 className="font-display text-2xl font-semibold text-ink">
          North<span className="text-sky">.</span>
        </h1>
        <div className="flex gap-3 text-sm">
          <button
            className={mode === 'login' ? 'font-semibold text-ink' : 'text-ink-faint'}
            onClick={() => setMode('login')}
          >
            Log in
          </button>
          <span className="text-haze-200">/</span>
          <button
            className={mode === 'register' ? 'font-semibold text-ink' : 'text-ink-faint'}
            onClick={() => setMode('register')}
          >
            Register
          </button>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <input
              className="w-full rounded-lg border border-haze-200 bg-white px-3 py-2 text-sm focus:border-sky focus:outline-none"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <input
            className="w-full rounded-lg border border-haze-200 bg-white px-3 py-2 text-sm focus:border-sky focus:outline-none"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full rounded-lg border border-haze-200 bg-white px-3 py-2 text-sm focus:border-sky focus:outline-none"
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
            className="w-full rounded-lg bg-sky py-2 text-sm font-medium text-white transition hover:bg-sky-dark disabled:opacity-40"
          >
            {mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <div className="rounded-lg border border-haze-200 bg-white p-3 text-xs text-ink-soft">
          <p className="font-medium text-ink">Just want to look around?</p>
          <p className="mt-1">
            Demo account: <span className="font-mono">demo@example.com</span> /{' '}
            <span className="font-mono">NorthDemo2026</span>
          </p>
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={submitting}
            className="mt-2 rounded-lg border border-haze-200 bg-white px-2 py-1 text-xs font-medium text-ink-soft transition hover:border-sky hover:text-sky disabled:opacity-40"
          >
            Log in as demo
          </button>
        </div>
      </div>
    </div>
  );
}
