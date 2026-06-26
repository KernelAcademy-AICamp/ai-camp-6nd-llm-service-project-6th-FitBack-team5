/**
 * 센터 운동(= '센터 가기 > 오늘 운동 루틴 만들기' = workout_sessions) 기록 조회.
 * 홈트 상세 "센터" 탭 전용. success_flag='Y'(완료)만 집계한다.
 * (수동 출석=visits 는 일정 캘린더 전용이며 여기엔 포함하지 않는다.)
 */

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';
import type { WeekDay } from './useThisWeekWorkouts';

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function weekStartMs(d: Date): number {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const off = (x.getDay() + 6) % 7; // Mon=0 … Sun=6
  x.setDate(x.getDate() - off);
  return x.getTime();
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 완료 시각 기준 일자 — completed_at 없으면 started_at 사용. */
function sessionWhen(row: { completed_at: string | null; started_at: string }): string {
  return row.completed_at ?? row.started_at;
}

/** referenceDate가 속한 주(월~일) 센터 운동 완료 현황. WeekStatusView 재사용 위해 WeekDay[] 반환. */
export function useThisWeekCenterWorkouts(referenceDate?: string) {
  const user = useCurrentUser();
  return useQuery<WeekDay[]>({
    queryKey: ['thisWeekCenterWorkouts', user?.id, referenceDate ?? 'today'],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const now = new Date();
      const refDate = referenceDate ? parseIso(referenceDate) : now;
      const wkStartMsVal = weekStartMs(refDate);
      const wkStart = new Date(wkStartMsVal);
      const wkEnd = new Date(wkStartMsVal + 7 * 86_400_000);
      const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const todayYmd = ymd(now);

      const { data, error } = await supabase
        .from('workout_sessions')
        .select('started_at, completed_at, success_flag')
        .eq('user_id', user!.id)
        .eq('success_flag', 'Y')
        .gte('started_at', wkStart.toISOString())
        .lt('started_at', wkEnd.toISOString());
      if (error) throw error;

      const done = new Set<string>();
      for (const row of (data ?? []) as { started_at: string; completed_at: string | null; success_flag: string }[]) {
        done.add(ymd(new Date(sessionWhen(row))));
      }

      const days: WeekDay[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(wkStartMsVal + i * 86_400_000);
        const key = ymd(d);
        days.push({
          date: key,
          day: d.getDate(),
          weekdayLabel: WEEKDAY_LABELS[i],
          isToday: key === todayYmd,
          isFuture: d.getTime() > todayMs,
          status: done.has(key) ? 'completed' : null,
        });
      }
      return days;
    },
  });
}

export interface CenterWorkout {
  id: string;
  time: string; // HH:MM (local)
  bodyPart: string;
  exerciseType: string;
  durationMin: number;
  itemCount: number;
}

/** 선택일의 센터 운동(완료) 목록. */
export function useDayCenterWorkouts(date: string | null) {
  const user = useCurrentUser();
  return useQuery<CenterWorkout[]>({
    queryKey: ['dayCenterWorkouts', user?.id, date],
    enabled: !!user && !!date,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const start = new Date(`${date}T00:00:00`);
      const end = new Date(start.getTime() + 86_400_000);

      const { data, error } = await supabase
        .from('workout_sessions')
        .select('id, body_part, exercise_type, total_duration_min, items, started_at, completed_at, success_flag')
        .eq('user_id', user!.id)
        .eq('success_flag', 'Y')
        .gte('started_at', start.toISOString())
        .lt('started_at', end.toISOString())
        .order('started_at', { ascending: true });
      if (error) throw error;

      return (
        (data ?? []) as {
          id: string;
          body_part: string;
          exercise_type: string;
          total_duration_min: number;
          items: unknown[] | null;
          started_at: string;
          completed_at: string | null;
        }[]
      ).map((r) => ({
        id: r.id,
        time: hhmm(sessionWhen(r)),
        bodyPart: r.body_part,
        exerciseType: r.exercise_type,
        durationMin: r.total_duration_min,
        itemCount: Array.isArray(r.items) ? r.items.length : 0,
      }));
    },
  });
}
