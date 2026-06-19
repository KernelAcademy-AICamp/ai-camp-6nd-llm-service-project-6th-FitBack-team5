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

export interface WeekDay extends ActivityDay {
  weekday: number; // 0=월 ~ 6=일
  isToday: boolean;
}

export interface HomeActivity {
  year: number;
  month: number; // 1~12
  days: ActivityDay[];
  weekDays: WeekDay[]; // 이번 주 월~일 7일
  weekVisits: number; // 이번 주 방문 일수
  lastWeekVisits: number; // 지난주 방문 일수 (증감 비교용)
  weekWorkouts: number; // 이번 주(월~) 완료/부분 운동 수
  lastRoutine: string | null;
  streakWeeks: number; // 현재 연속 주(주 단위, 프리즈 1회 보호 포함)
  maxStreakWeeks: number; // 최고 연속 주(하드 리셋 방지용 병행 표시)
  streakFreezeAvailable: boolean; // 스트릭 프리즈 잔여(이번 스트릭에서 미사용 여부)
}

// 권장 페이스(가이드 상수) — 실제 데이터가 아니라 제품 권장값.
// TODO[검토]: 회원권 페이스(remaining/주수) 기반으로 개인화할지.
export const RECOMMENDED_WEEKLY_VISITS = 2;
export const RECOMMEND_PACE_TEXT = '일주일에 2~3회 방문이 가장 좋아요';
// 스트릭 충족 기준(주당 방문 횟수). 추천안 A(주 단위).
export const STREAK_GOAL = 2;

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

      // 이번 주 월~일 7일
      const todayYmd = ymdLocal(now);
      const weekDays: WeekDay[] = [];
      for (let i = 0; i < 7; i++) {
        const dd = new Date(wkStart + i * 86_400_000);
        const date = ymdLocal(dd);
        weekDays.push({
          day: dd.getDate(),
          date,
          weekday: i,
          isToday: date === todayYmd,
          visited: visited.has(date),
          workout: workout.has(date),
          diet: diet.has(date),
        });
      }
      const weekVisits = weekDays.filter((d) => d.visited).length;

      // 지난주 방문 일수 (증감 비교용)
      const lastWkStart = wkStart - 7 * 86_400_000;
      let lastWeekVisits = 0;
      for (let i = 0; i < 7; i++) {
        if (visited.has(ymdLocal(new Date(lastWkStart + i * 86_400_000)))) lastWeekVisits += 1;
      }

      // 주 단위 스트릭 (추천안 A) — 권장 페이스(주 STREAK_GOAL회) 충족 주가 연속되면 +1.
      // 최근 8주 주별 방문 일수.
      const visitedMs = [...visited].map((ds) => new Date(`${ds}T00:00:00`).getTime());
      const weekCounts: number[] = []; // w=0 현재 주
      for (let w = 0; w < 8; w++) {
        const ws = wkStart - w * 7 * 86_400_000;
        const we = ws + 7 * 86_400_000;
        weekCounts.push(visitedMs.filter((t) => t >= ws && t < we).length);
      }
      const met = (c: number) => c >= STREAK_GOAL;

      // 현재 스트릭: 진행 중인 이번 주는 미충족이어도 끊지 않음(아직 진행 중).
      // 과거 한 주 미충족은 프리즈 1회로 보호.
      let streakWeeks = 0;
      let freezeUsed = false;
      const startW = met(weekCounts[0]) ? 0 : 1;
      for (let w = startW; w < weekCounts.length; w++) {
        if (met(weekCounts[w])) streakWeeks += 1;
        else if (!freezeUsed && streakWeeks > 0) freezeUsed = true; // 프리즈로 보호, 끊지 않음
        else break;
      }
      const streakFreezeAvailable = !freezeUsed;

      // 최고 연속(주) — 8주 창에서 가장 긴 충족 연속.
      let maxStreakWeeks = 0;
      let run = 0;
      for (const c of weekCounts) {
        if (met(c)) {
          run += 1;
          if (run > maxStreakWeeks) maxStreakWeeks = run;
        } else run = 0;
      }
      maxStreakWeeks = Math.max(maxStreakWeeks, streakWeeks);

      return {
        year,
        month,
        days,
        weekDays,
        weekVisits,
        lastWeekVisits,
        weekWorkouts,
        lastRoutine,
        streakWeeks,
        maxStreakWeeks,
        streakFreezeAvailable,
      };
    },
  });
}
