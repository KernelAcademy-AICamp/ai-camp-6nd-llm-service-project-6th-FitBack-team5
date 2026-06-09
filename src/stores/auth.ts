import { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

interface AuthState {
  session: Session | null;
  status: AuthStatus;
  error: string | null;
}

export const useAuthStore = create<AuthState>(() => ({
  session: null,
  status: 'loading',
  error: null,
}));

export const useCurrentUser = () => useAuthStore((s) => s.session?.user ?? null);
