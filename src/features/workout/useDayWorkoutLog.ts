/**
 * 특정 날짜(YYYY-MM-DD)의 운동 기록 전체 조회 (최신 정렬).
 * SelectedDayCard 는 [0] 으로 최신 1건을, DayWorkoutList 는 전체를 사용.
 */

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';

export type CompletionStatus = 'completed' | 'partial' | 'missed';
export type WorkoutBodyPart = 'lower' | 'upper' | 'full' | 'cardio';

export interface AiFeedback {
  summary?: string;
  nextAdjustment?: string;
  encouragement?: string;
}

export interface DayWorkoutLog {
  id: string;
  routineTitle: string;
  routineMeta: string;
  /** 루틴 meta 에서 파싱한 계획 시간(분). */
  durationMin: number;
  /** 사용자가 실제 세션에 머문 초. 마이그레이션 22 이전 기록은 null. */
  actualDurationSec: number | null;
  exerciseCount: number;
  calories: number;
  completionStatus: CompletionStatus;
  /** DayWorkoutList 의 아이콘 분기에 사용 (cardio → Activity, 그 외 → Dumbbell). */
  bodyPart: WorkoutBodyPart | null;
  aiFeedback: AiFeedback | null;
  createdAt: string;
}

export function useDayWorkoutLogs(date: string) {
  const user = useCurrentUser();
  return useQuery<DayWorkoutLog[]>({
    queryKey: ['day-workout-logs', user?.id, date],
    enabled: !!user && !!date,
    staleTime: 60 * 1000,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('workout_logs')
        .select(
          'id, routine_title, routine_meta, duration_min, actual_duration_sec, exercise_count, calories, completion_status, ai_feedback, created_at, body_part',
        )
        .eq('user_id', user.id)
        .gte('created_at', `${date}T00:00:00+09:00`)
        .lte('created_at', `${date}T23:59:59+09:00`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as {
        id: string;
        routine_title: string;
        routine_meta: string;
        duration_min: number;
        actual_duration_sec: number | null;
        exercise_count: number;
        calories: number | null;
        completion_status: CompletionStatus;
        ai_feedback: AiFeedback | null;
        created_at: string;
        body_part: WorkoutBodyPart | null;
      }[]).map((row) => ({
        id: row.id,
        routineTitle: row.routine_title,
        routineMeta: row.routine_meta,
        durationMin: row.duration_min,
        actualDurationSec: row.actual_duration_sec,
        exerciseCount: row.exercise_count,
        calories: row.calories ?? 0,
        completionStatus: row.completion_status,
        bodyPart: row.body_part,
        aiFeedback: row.ai_feedback,
        createdAt: row.created_at,
      }));
    },
  });
}
