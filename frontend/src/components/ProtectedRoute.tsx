import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  // Wait for the initial /me check rather than redirecting immediately —
  // isAuthenticated starts false on every fresh page load (cookie can't be
  // read client-side to know in advance), so redirecting before this
  // resolves would log out an already-logged-in user on every refresh.
  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
