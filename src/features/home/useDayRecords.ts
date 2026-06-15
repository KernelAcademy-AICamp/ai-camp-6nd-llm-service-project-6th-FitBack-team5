import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';

export interface DayVisit {
  id: string;
  time: string; // HH:MM (local)
  centerName: string | null;
}
export interface DayWorkout {
  id: string;
  label: string; // 부위(body_part) 우선, 없으면 루틴명
  durationMin: number | null;
}
export interface DayMeal {
  id: string;
  mealType: string; // 아침/점심/저녁/간식
  name: string;
  protein: number; // g
  kcal: number;
}
export interface DayRecords {
  visits: DayVisit[];
  workouts: DayWorkout[];
  meals: DayMeal[];
}

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 선택한 하루의 방문·운동·식단 상세 기록(실제 기록 있는 것만). 화면 B 날짜 선택 리스트용. */
export function useDayRecords(date: string | null) {
  const user = useCurrentUser();
  return useQuery<DayRecords>({
    queryKey: ['dayRecords', user?.id, date],
    enabled: !!user && !!date,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const start = new Date(`${date}T00:00:00`);
      const end = new Date(start.getTime() + 86_400_000);
      const startISO = start.toISOString();
      const endISO = end.toISOString();

      const [v, w, m] = await Promise.all([
        supabase
          .from('visits')
          .select('id, check_in_time, center_name')
          .eq('user_id', user!.id)
          .gte('check_in_time', startISO)
          .lt('check_in_time', endISO)
          .order('check_in_time', { ascending: true }),
        supabase
          .from('workout_logs')
          .select('id, routine_title, body_part, duration_min, completion_status, created_at')
          .eq('user_id', user!.id)
          .gte('created_at', startISO)
          .lt('created_at', endISO)
          .order('created_at', { ascending: true }),
        supabase
          .from('meals')
          .select('id, meal_type, name, protein, kcal, eaten_at')
          .eq('user_id', user!.id)
          .eq('log_date', date!)
          .order('eaten_at', { ascending: true }),
      ]);
      if (v.error) throw v.error;
      if (w.error) throw w.error;
      if (m.error) throw m.error;

      const visits: DayVisit[] = ((v.data ?? []) as { id: string; check_in_time: string; center_name: string | null }[]).map(
        (r) => ({ id: r.id, time: hhmm(r.check_in_time), centerName: r.center_name ?? null }),
      );
      const workouts: DayWorkout[] = (
        (w.data ?? []) as {
          id: string;
          routine_title: string | null;
          body_part: string | null;
          duration_min: number | null;
          completion_status: string;
        }[]
      )
        .filter((r) => r.completion_status !== 'missed')
        .map((r) => ({ id: r.id, label: r.body_part || r.routine_title || '운동', durationMin: r.duration_min ?? null }));
      const meals: DayMeal[] = (
        (m.data ?? []) as { id: string; meal_type: string; name: string; protein: number | null; kcal: number | null }[]
      ).map((r) => ({
        id: r.id,
        mealType: r.meal_type,
        name: r.name,
        protein: Math.round(r.protein ?? 0),
        kcal: Math.round(r.kcal ?? 0),
      }));

      return { visits, workouts, meals };
    },
  });
}
