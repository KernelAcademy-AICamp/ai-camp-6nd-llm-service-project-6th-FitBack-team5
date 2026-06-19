import { useMutation } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';

// 회원 탈퇴(데이터만 삭제 · 계정 유지). 사용자 데이터를 비우고 프로필을 초기화한다.
// auth 계정은 유지하되, 탈퇴 후엔 로그아웃해 랜딩 화면으로 보낸다(재로그인 시 재온보딩).
// ※ 무효화(invalidateQueries)는 하지 않는다 — 탈퇴 직후 로그인 상태에서 온보딩으로 튀는 것을 막고,
//   작별 모달을 안정적으로 보여준 뒤 로그아웃 시점에 캐시가 정리되도록 한다.
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
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('로그인이 필요합니다.');
      for (const t of USER_TABLES) {
        const { error } = await supabase.from(t).delete().eq('user_id', user.id);
        if (error) throw error;
      }
      // 프로필 초기화(계정·이메일은 유지) → 재로그인 시 재온보딩
      const { error: pErr } = await supabase
        .from('profiles')
        .update({ onboarded: false, age: null, gender: null, height: null, weight: null })
        .eq('id', user.id);
      if (pErr) throw pErr;
    },
  });
}
