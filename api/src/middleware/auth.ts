import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { AUTH_COOKIE_NAME } from '../utils/cookies';

// Reads the httpOnly auth cookie, verifies it, and attaches the decoded
// userId to the request for downstream route handlers.
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[AUTH_COOKIE_NAME] as string | undefined;

  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
