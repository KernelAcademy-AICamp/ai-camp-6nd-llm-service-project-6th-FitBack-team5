import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';

export interface NewVisitInput {
  membershipId: string;
  centerName?: string | null;
  /** 명세 §6: 검증/자기신고 구분 */
  method?: 'geofence' | 'fallback';
  verifyStatus?: 'verified' | 'unverified';
  recoveredAmount?: number; // unverified면 0
  centerLat?: number | null;
  centerLng?: number | null;
  distanceM?: number | null;
}

/**
 * 센터 도착 = 체크인. visits에 한 건 insert (check_in_time은 DB default now()).
 * 성공 시 memberships(visit 집계)와 monthlyStats를 무효화해 위험도·방문수가 갱신된다.
 */
export function useCreateVisit() {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewVisitInput) => {
      if (!user) throw new Error('로그인이 필요합니다.');
      const { data, error } = await supabase
        .from('visits')
        .insert({
          user_id: user.id,
          membership_id: input.membershipId,
          center_name: input.centerName ?? null,
          status: 'checked_in',
          method: input.method ?? null,
          verify_status: input.verifyStatus ?? null,
          recovered_amount: input.recoveredAmount ?? 0,
          center_lat: input.centerLat ?? null,
          center_lng: input.centerLng ?? null,
          distance_m: input.distanceM ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memberships', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['monthlyStats', user?.id] });
    },
  });
}
