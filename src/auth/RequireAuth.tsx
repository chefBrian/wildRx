import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import type { ReactNode } from 'react';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="p-4 text-ink2">Loading…</div>;
  if (!user) return <Navigate to="/admin/login" state={{ from: loc }} replace />;
  return <>{children}</>;
}
