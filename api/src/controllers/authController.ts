import { Request, Response } from 'express';
import { registerUser, loginUser } from '../services/authService';
import { HttpError } from '../utils/httpError';

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, name } = req.body as { email?: string; password?: string; name?: string };

  if (!email || !password || !name) {
    res.status(400).json({ error: 'email, password, and name are required' });
    return;
  }

  try {
    const result = await registerUser({ email, password, name });
    res.status(201).json(result);
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
    const result = await loginUser({ email, password });
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    console.error('[auth] login failed', err);
    res.status(500).json({ error: 'Failed to log in' });
  }
}
