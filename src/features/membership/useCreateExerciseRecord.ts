import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';

export interface NewExerciseInput {
  visitId: string;
  exercisePart: string | null; // 자유이용권만 사용. PT/클래스는 null.
  intensity: string | null; // 'easy' | 'normal' | 'hard'
  duration: number | null; // 분
  notes: string | null;
  /** 형태별 부가정보: { kind, trainer?, className?, status }. */
  autoData?: Record<string, unknown> | null;
}

/** 한 방문(visit)에 운동 기록 1건 추가. 성공 시 이번달 통계 무효화. */
export function useCreateExerciseRecord() {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewExerciseInput) => {
      if (!user) throw new Error('로그인이 필요합니다.');
      const { data, error } = await supabase
        .from('exercise_records')
        .insert({
          user_id: user.id,
          visit_id: input.visitId,
          exercise_part: input.exercisePart,
          intensity: input.intensity,
          duration: input.duration,
          notes: input.notes,
          auto_data: input.autoData ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthlyStats', user?.id] });
    },
  });
}
