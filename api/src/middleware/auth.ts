import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';

// Reads "Authorization: Bearer <token>", verifies it, and attaches the
// decoded userId to the request for downstream route handlers.
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
