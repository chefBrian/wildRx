import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../firebase/client';

interface Ctx { user: User | null; loading: boolean; }
const AuthCtx = createContext<Ctx>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setLoading(false); }), []);
  return <AuthCtx.Provider value={{ user, loading }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
