import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';

export function useAuthBootstrap() {
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;

      useAuthStore.setState({
        session,
        status: session ? 'authenticated' : 'unauthenticated',
        error: null,
      });
    }

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      useAuthStore.setState({
        session,
        status: session ? 'authenticated' : 'unauthenticated',
      });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);
}
