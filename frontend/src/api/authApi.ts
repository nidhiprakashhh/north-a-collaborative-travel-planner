import { apiRequest } from '../lib/apiClient';
import type { AuthResult } from '../types/api';

export function register(email: string, password: string, name: string): Promise<AuthResult> {
  return apiRequest<AuthResult>('/api/auth/register', {
    method: 'POST',
    body: { email, password, name },
  });
}

export function login(email: string, password: string): Promise<AuthResult> {
  return apiRequest<AuthResult>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}
