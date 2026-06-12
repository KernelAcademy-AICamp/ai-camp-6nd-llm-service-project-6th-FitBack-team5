import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';

export interface ActivityDay {
  day: number; // 1~말일
  date: string; // YYYY-MM-DD (local)
  visited: boolean;
  workout: boolean;
  diet: boolean;
}

export interface HomeActivity {
  year: number;
  month: number; // 1~12
  days: ActivityDay[];
  weekWorkouts: number; // 이번 주(월~) 완료/부분 운동 수
  lastRoutine: string | null;
  streakWeeks: number; // 현재 주부터 연속 활동 주
}

function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** 해당 날짜가 속한 주(월요일) 자정 ms. */
function weekStartMs(d: Date): number {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const off = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - off);
  return x.getTime();
}

/** 홈 누적 기록(캘린더)·주간 운동 집계. 최근 56일 방문/운동/식단을 한 번에 조회. */
export function useHomeActivity() {
  const user = useCurrentUser();
  return useQuery<HomeActivity>({
    queryKey: ['homeActivity', user?.id],
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const sinceISO = new Date(now.getTime() - 56 * 86_400_000).toISOString();

      const [visitsRes, workoutsRes, mealsRes] = await Promise.all([
        supabase.from('visits').select('check_in_time').eq('user_id', user!.id).gte('check_in_time', sinceISO),
        supabase
          .from('workout_logs')
          .select('created_at, completion_status, routine_title')
          .eq('user_id', user!.id)
          .gte('created_at', sinceISO)
          .order('created_at', { ascending: false }),
        supabase.from('meals').select('log_date').eq('user_id', user!.id).gte('log_date', ymdLocal(new Date(now.getTime() - 56 * 86_400_000))),
      ]);
      if (visitsRes.error) throw visitsRes.error;
      if (workoutsRes.error) throw workoutsRes.error;
      if (mealsRes.error) throw mealsRes.error;

      const visited = new Set<string>();
      for (const v of (visitsRes.data ?? []) as { check_in_time: string }[]) {
        visited.add(ymdLocal(new Date(v.check_in_time)));
      }
      const workout = new Set<string>();
      const workoutRows = (workoutsRes.data ?? []) as {
        created_at: string;
        completion_status: string;
        routine_title: string;
      }[];
      for (const w of workoutRows) {
        if (w.completion_status !== 'missed') workout.add(ymdLocal(new Date(w.created_at)));
      }
      const diet = new Set<string>();
      for (const m of (mealsRes.data ?? []) as { log_date: string }[]) diet.add(m.log_date);

      // 이번 달 그리드
      const daysInMonth = new Date(year, month, 0).getDate();
      const days: ActivityDay[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        days.push({ day: d, date, visited: visited.has(date), workout: workout.has(date), diet: diet.has(date) });
      }

      // 이번 주 운동 수
      const wkStart = weekStartMs(now);
      const weekWorkouts = workoutRows.filter(
        (w) => w.completion_status !== 'missed' && new Date(w.created_at).getTime() >= wkStart,
      ).length;
      const lastRoutine = workoutRows[0]?.routine_title ?? null;

      // 연속 주 (현재 주부터, 활동 있는 주만)
      const allDates = new Set<string>([...visited, ...workout, ...diet]);
      const allMs = [...allDates].map((ds) => new Date(`${ds}T00:00:00`).getTime());
      let streakWeeks = 0;
      for (let w = 0; w < 8; w++) {
        const ws = wkStart - w * 7 * 86_400_000;
        const we = ws + 7 * 86_400_000;
        const has = allMs.some((t) => t >= ws && t < we);
        if (has) streakWeeks += 1;
        else break;
      }

      return { year, month, days, weekWorkouts, lastRoutine, streakWeeks };
    },
  });
}
