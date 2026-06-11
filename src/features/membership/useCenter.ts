import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export interface CenterInfo {
  name: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** 회원권에 연결된 센터(좌표 포함)를 조회. 없으면 null. */
export function useCenter(membershipId: string | null) {
  return useQuery<CenterInfo | null>({
    queryKey: ['center', membershipId],
    enabled: !!membershipId,
    queryFn: async () => {
      if (!membershipId) return null;
      const { data, error } = await supabase
        .from('centers')
        .select('name, latitude, longitude')
        .eq('membership_id', membershipId)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as CenterInfo) ?? null;
    },
  });
}
