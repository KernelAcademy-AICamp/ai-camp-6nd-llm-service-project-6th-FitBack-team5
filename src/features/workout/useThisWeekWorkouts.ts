/**
 * 이번 주(월~일) 운동 기록 일자별 상태.
 *
 * 운동 홈 화면의 "이번 주 홈트 현황" 카드용.
 * 우선순위: 'completed' > 'partial' > null (같은 날 여러 건이면 가장 높은 상태로).
 */

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';

export type DayStatus = 'completed' | 'partial' | null;

export interface WeekDay {
  date: string; // YYYY-MM-DD (local)
  day: number; // 1~31
  weekdayLabel: string; // 월/화/수/목/금/토/일
  isToday: boolean;
  isFuture: boolean;
  status: DayStatus;
}

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 해당 시각이 속한 주(월요일) 자정 ms. */
function weekStartMs(d: Date): number {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const off = (x.getDay() + 6) % 7; // Mon=0, ..., Sun=6
  x.setDate(x.getDate() - off);
  return x.getTime();
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * referenceDate(YYYY-MM-DD)가 속한 주(월~일) 7일 데이터.
 * 미지정 시 오늘 기준.
 */
export function useThisWeekWorkouts(referenceDate?: string) {
  const user = useCurrentUser();
  return useQuery<WeekDay[]>({
    queryKey: ['thisWeekWorkouts', user?.id, referenceDate ?? 'today'],
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
        .from('workout_logs')
        .select('created_at, completion_status')
        .eq('user_id', user!.id)
        .gte('created_at', wkStart.toISOString())
        .lt('created_at', wkEnd.toISOString());
      if (error) throw error;

      // 일자별 최고 상태 집계: completed > partial > null.
      const byDate = new Map<string, DayStatus>();
      for (const row of (data ?? []) as { created_at: string; completion_status: string }[]) {
        const k = ymd(new Date(row.created_at));
        const prev = byDate.get(k);
        if (row.completion_status === 'completed') {
          byDate.set(k, 'completed');
        } else if (row.completion_status === 'partial' && prev !== 'completed') {
          byDate.set(k, 'partial');
        }
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
          status: byDate.get(key) ?? null,
        });
      }
      return days;
    },
  });
}
