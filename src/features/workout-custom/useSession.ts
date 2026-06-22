import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';

import type { DraftItem, SessionRow } from './types';

const KEY_ACTIVE = ['workout-custom', 'active-session'] as const;

/** 진행 중 세션(success_flag null)을 1건 조회. 자정이 지난 미완료 행은 N으로 마감 후 null 반환. */
export function useActiveSession() {
  const userId = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: [...KEY_ACTIVE, userId],
    enabled: !!userId,
    staleTime: 0,
    queryFn: async (): Promise<SessionRow | null> => {
      if (!userId) return null;

      // 미완료 세션 중 가장 최근 것 1건
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', userId)
        .is('success_flag', null)
        .order('started_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      const row = (data?.[0] ?? null) as SessionRow | null;
      if (!row) return null;

      // 자정 경계 체크: started_at 가 오늘 자정 이전이면 실패(N)로 마감.
      const started = new Date(row.started_at);
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);

      if (started < todayMidnight) {
        await supabase
          .from('workout_sessions')
          .update({ success_flag: 'N', completed_at: new Date().toISOString() })
          .eq('id', row.id);
        return null;
      }
      return row;
    },
  });
}

interface StartParams {
  body_part: string;
  exercise_type: string;
  total_duration_min: number;
  items: DraftItem[];
}

/** 3번 "루틴 시작" — 세션 insert (success_flag null) */
export function useStartSession() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (p: StartParams): Promise<SessionRow> => {
      if (!userId) throw new Error('로그인이 필요합니다.');
      const { data, error } = await supabase
        .from('workout_sessions')
        .insert({
          user_id: userId,
          body_part: p.body_part,
          exercise_type: p.exercise_type,
          total_duration_min: p.total_duration_min,
          items: p.items,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data as SessionRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_ACTIVE });
    },
  });
}

interface CompleteParams {
  sessionId: string;
  items: DraftItem[];
  memo: string;
}

/** 4번 "오운완" — items/memo 갱신 + success_flag = 'Y' */
export function useCompleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: CompleteParams): Promise<SessionRow> => {
      const { data, error } = await supabase
        .from('workout_sessions')
        .update({
          items: p.items,
          memo: p.memo,
          success_flag: 'Y',
          completed_at: new Date().toISOString(),
        })
        .eq('id', p.sessionId)
        .select('*')
        .single();
      if (error) throw error;
      return data as SessionRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_ACTIVE });
    },
  });
}
