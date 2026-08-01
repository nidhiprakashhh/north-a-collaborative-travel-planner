import { env } from '../config/env';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
}

// A thin fetch wrapper — not axios, since the only things every call needs
// (base URL, JSON body, parsed error message) are a handful of lines and
// don't warrant a dependency.
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  const res = await fetch(`${env.apiUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    // Auth now rides on an httpOnly cookie, not a header we attach — this is
    // what makes the browser actually send/accept it, including cross-port
    // in local dev (localhost:5173 -> localhost:4000).
    credentials: 'include',
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? `Request failed with status ${res.status}`);
  }

  return data as T;
}
