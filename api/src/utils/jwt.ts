import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthTokenPayload {
  userId: string;
  email: string;
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): AuthTokenPayload {
  // jwt.verify throws (JsonWebTokenError / TokenExpiredError) on any
  // invalid or expired token — callers should catch and turn that into 401.
  return jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
}
