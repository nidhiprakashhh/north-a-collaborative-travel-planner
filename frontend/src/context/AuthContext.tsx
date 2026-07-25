import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import * as authApi from '../api/authApi';
import type { AuthUser } from '../types/api';

const TOKEN_STORAGE_KEY = 'north:token';
const USER_STORAGE_KEY = 'north:user';

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState<AuthUser | null>(readStoredUser);

  const persist = useCallback((nextToken: string, nextUser: AuthUser) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await authApi.login(email, password);
      persist(result.token, result.user);
    },
    [persist],
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const result = await authApi.register(email, password, name);
      persist(result.token, result.user);
    },
    [persist],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ token, user, isAuthenticated: Boolean(token), login, register, logout }),
    [token, user, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
