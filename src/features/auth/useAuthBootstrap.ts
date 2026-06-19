import { useEffect } from 'react';

import { identifyUser, initAnalytics, resetAnalytics } from '@/features/analytics/posthog';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';

export function useAuthBootstrap() {
  useEffect(() => {
    let cancelled = false;
    initAnalytics();

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
      if (session?.user?.id) identifyUser(session.user.id);
      else resetAnalytics();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);
}
