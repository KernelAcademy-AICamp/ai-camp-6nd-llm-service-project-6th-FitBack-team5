import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';
import type { ActivityDay } from '@/features/home/useHomeActivity';

export interface CalendarMonth {
  year: number;
  month: number; // 1~12
  days: ActivityDay[];
  visitCount: number; // 이번 달 방문 일수
}

function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 임의 연/월의 방문·운동·식단 기록 그리드. 화면 B(월 캘린더 상세)용. */
export function useCalendarMonth(year: number, month: number) {
  const user = useCurrentUser();
  return useQuery<CalendarMonth>({
    queryKey: ['calendarMonth', user?.id, year, month],
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const first = new Date(year, month - 1, 1);
      const last = new Date(year, month, 0);
      const startYmd = ymdLocal(first);
      const endExclusive = new Date(year, month, 1); // 다음 달 1일 00:00 (local)
      const startISO = first.toISOString();
      const endISO = endExclusive.toISOString();

      const [visitsRes, workoutsRes, mealsRes] = await Promise.all([
        supabase
          .from('visits')
          .select('check_in_time')
          .eq('user_id', user!.id)
          .gte('check_in_time', startISO)
          .lt('check_in_time', endISO),
        supabase
          .from('workout_logs')
          .select('created_at, completion_status')
          .eq('user_id', user!.id)
          .gte('created_at', startISO)
          .lt('created_at', endISO),
        supabase
          .from('meals')
          .select('log_date')
          .eq('user_id', user!.id)
          .gte('log_date', startYmd)
          .lte('log_date', ymdLocal(last)),
      ]);
      if (visitsRes.error) throw visitsRes.error;
      if (workoutsRes.error) throw workoutsRes.error;
      if (mealsRes.error) throw mealsRes.error;

      const visited = new Set<string>();
      for (const v of (visitsRes.data ?? []) as { check_in_time: string }[]) {
        visited.add(ymdLocal(new Date(v.check_in_time)));
      }
      const workout = new Set<string>();
      for (const w of (workoutsRes.data ?? []) as { created_at: string; completion_status: string }[]) {
        if (w.completion_status !== 'missed') workout.add(ymdLocal(new Date(w.created_at)));
      }
      const diet = new Set<string>();
      for (const m of (mealsRes.data ?? []) as { log_date: string }[]) diet.add(m.log_date);

      const daysInMonth = last.getDate();
      const days: ActivityDay[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        days.push({ day: d, date, visited: visited.has(date), workout: workout.has(date), diet: diet.has(date) });
      }

      return { year, month, days, visitCount: visited.size };
    },
  });
}
