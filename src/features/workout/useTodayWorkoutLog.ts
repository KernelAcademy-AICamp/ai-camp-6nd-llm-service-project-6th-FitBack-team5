import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';
import type { WorkoutContext, WorkoutPart } from '@/features/diet/guide';

interface WorkoutLogRow {
  id: string;
  routine_title: string;
  routine_meta: string;
  duration_min: number;
  body_part: string | null;
  completion_status: 'completed' | 'partial' | 'missed';
  created_at: string;
}

// routine_title 키워드로 부위 추정 (body_part 컬럼이 없는 기존 로그 호환)
function parsePartFromTitle(title: string): WorkoutPart | null {
  if (title.includes('하체')) return 'lower';
  if (title.includes('상체')) return 'upper';
  if (title.includes('전신')) return 'full';
  if (title.includes('유산소') || title.includes('cardio')) return 'cardio';
  return null;
}

// 완료한 운동의 부위 → 소모 칼로리 추정 (duration_min 기준)
function estimateBurnedKcal(part: WorkoutPart | null, durationMin: number): number {
  const rate = part === 'cardio' ? 8 : 7; // kcal/min
  return Math.round(durationMin * rate);
}

export interface TodayWorkoutSummary {
  hasWorkout: boolean;
  context: WorkoutContext;
  durationMin: number;
  burnedKcal: number;
}

// 오늘 날짜 KST 기준 ISO date string
function todayISO(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const STEP_KCAL = 249; // 걸음 소모 기본값 (실데이터 없을 때 폴백)

// 오늘 완료된 운동 로그 중 가장 최근 1건 조회
export function useTodayWorkoutLog() {
  const user = useCurrentUser();
  return useQuery<TodayWorkoutSummary>({
    queryKey: ['today-workout-log', user?.id, todayISO()],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<TodayWorkoutSummary> => {
      if (!user) return fallback();
      const today = todayISO();
      const { data, error } = await supabase
        .from('workout_logs')
        .select('id, routine_title, routine_meta, duration_min, body_part, completion_status, created_at')
        .eq('user_id', user.id)
        .in('completion_status', ['completed', 'partial'])
        .gte('created_at', `${today}T00:00:00+09:00`)
        .lte('created_at', `${today}T23:59:59+09:00`)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      if (!data || data.length === 0) return fallback();
      const row = data[0] as WorkoutLogRow;
      const part: WorkoutPart | null =
        (row.body_part as WorkoutPart | null) ?? parsePartFromTitle(row.routine_title);
      const durationMin = row.duration_min;
      const burnedKcal = estimateBurnedKcal(part, durationMin);
      return {
        hasWorkout: true,
        context: {
          source: 'recent',
          goal: 'maintain',
          ...(part ? { part } : {}),
        },
        durationMin,
        burnedKcal,
      };
    },
  });
}

function fallback(): TodayWorkoutSummary {
  return {
    hasWorkout: false,
    context: { source: 'none', goal: 'maintain' },
    durationMin: 0,
    burnedKcal: STEP_KCAL,
  };
}
