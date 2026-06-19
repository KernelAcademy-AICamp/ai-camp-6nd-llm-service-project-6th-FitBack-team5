import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';

// 회원 탈퇴(데이터만 삭제 · 계정 유지). 사용자 데이터를 비우고 프로필을 초기화해 재온보딩 상태로 되돌린다.
// auth 계정은 유지 → 같은 세션에서 다시 온보딩.
const USER_TABLES = [
  'visits',
  'centers',
  'schedules',
  'meals',
  'workout_logs',
  'exercise_records',
  'food_favorites',
  'events',
  'user_preferences',
  'memberships', // FK 의존 테이블 정리 후 마지막
] as const;

export function useDeleteAccountData() {
  const user = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('로그인이 필요합니다.');
      for (const t of USER_TABLES) {
        const { error } = await supabase.from(t).delete().eq('user_id', user.id);
        if (error) throw error;
      }
      // 프로필 초기화(계정·이메일은 유지) → 재온보딩
      const { error: pErr } = await supabase
        .from('profiles')
        .update({ onboarded: false, age: null, gender: null, height: null, weight: null })
        .eq('id', user.id);
      if (pErr) throw pErr;
    },
    onSuccess: () => {
      qc.invalidateQueries(); // 전체 무효화 → 온보딩으로 전환
    },
  });
}
