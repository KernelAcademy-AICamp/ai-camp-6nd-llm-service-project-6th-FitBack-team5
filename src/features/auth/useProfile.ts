import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';

export type Role = 'member' | 'admin';

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  role: Role;
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const user = useCurrentUser();
  return useQuery<Profile | null>({
    queryKey: ['profile', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });
}
