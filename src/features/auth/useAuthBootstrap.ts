import { useEffect } from 'react';

import { identifyUser, initAnalytics, resetAnalytics } from '@/features/analytics/posthog';
import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';

const BOOTSTRAP_TIMEOUT_MS = 8_000;

export function useAuthBootstrap() {
  useEffect(() => {
    let cancelled = false;
    initAnalytics();

    async function bootstrap() {
      const timeoutId = setTimeout(() => {
        if (cancelled) return;
        useAuthStore.setState({ session: null, status: 'unauthenticated', error: null });
      }, BOOTSTRAP_TIMEOUT_MS);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        useAuthStore.setState({
          session,
          status: session ? 'authenticated' : 'unauthenticated',
          error: null,
        });
      } finally {
        clearTimeout(timeoutId);
      }
    }

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        queryClient.cancelQueries();
        queryClient.clear();
      }
      useAuthStore.setState({
        session,
        status: session ? 'authenticated' : 'unauthenticated',
      });
      if (session?.user?.id) identifyUser(session.user.id);
      else resetAnalytics();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);
}
