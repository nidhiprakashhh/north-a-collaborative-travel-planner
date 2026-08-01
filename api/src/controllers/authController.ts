import { Request, Response } from 'express';
import { registerUser, loginUser, getUserById } from '../services/authService';
import { HttpError } from '../utils/httpError';
import { AUTH_COOKIE_NAME, authCookieOptions } from '../utils/cookies';

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, name } = req.body as { email?: string; password?: string; name?: string };

  if (!email || !password || !name) {
    res.status(400).json({ error: 'email, password, and name are required' });
    return;
  }

  try {
    const { token, user } = await registerUser({ email, password, name });
    res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
    res.status(201).json({ user });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    console.error('[auth] register failed', err);
    res.status(500).json({ error: 'Failed to register user' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  try {
    const { token, user } = await loginUser({ email, password });
    res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
    res.status(200).json({ user });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    console.error('[auth] login failed', err);
    res.status(500).json({ error: 'Failed to log in' });
  }
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, authCookieOptions());
  res.status(204).send();
}

// Lets the frontend hydrate "am I logged in" on page load without ever
// being able to read the token itself (it's httpOnly) — requireAuth has
// already verified the cookie and set req.userId by the time this runs.
export async function me(req: Request, res: Response): Promise<void> {
  const user = await getUserById(req.userId!);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.status(200).json({ user });
}
