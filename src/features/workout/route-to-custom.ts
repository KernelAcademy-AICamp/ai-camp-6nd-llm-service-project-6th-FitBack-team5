/**
 * '오늘 운동 커스텀' 진입 라우팅 — 진행 중 세션이 있으면 record 화면, 자정 지난 미완료는 N으로 마감 후 select.
 */
import type { useRouter } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { useCustomWorkoutDraft } from '@/stores/workout-custom';

type Router = ReturnType<typeof useRouter>;

export async function routeToCustom(router: Router) {
  const resetDraft = useCustomWorkoutDraft.getState().reset;
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) {
    resetDraft();
    router.push('/workout/custom/select');
    return;
  }
  const { data } = await supabase
    .from('workout_sessions')
    .select('id, started_at')
    .eq('user_id', userId)
    .is('success_flag', null)
    .order('started_at', { ascending: false })
    .limit(1);
  const row = data?.[0];
  if (row) {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    if (new Date(row.started_at) < todayMidnight) {
      await supabase
        .from('workout_sessions')
        .update({ success_flag: 'N', completed_at: new Date().toISOString() })
        .eq('id', row.id);
      resetDraft();
      router.push('/workout/custom/select');
      return;
    }
    router.push('/workout/custom/record');
    return;
  }
  resetDraft();
  router.push('/workout/custom/select');
}
