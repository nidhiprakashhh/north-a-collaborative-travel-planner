import { apiRequest } from '../lib/apiClient';
import type { AuthUser } from '../types/api';

export function register(email: string, password: string, name: string): Promise<{ user: AuthUser }> {
  return apiRequest('/api/auth/register', {
    method: 'POST',
    body: { email, password, name },
  });
}

export function login(email: string, password: string): Promise<{ user: AuthUser }> {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export function logout(): Promise<void> {
  return apiRequest('/api/auth/logout', { method: 'POST' });
}

// Called on app load to hydrate auth state from the httpOnly cookie — the
// frontend can never read the token itself, this is the only way it learns
// "is there a valid session" after a refresh.
export function me(): Promise<{ user: AuthUser }> {
  return apiRequest('/api/auth/me');
}
