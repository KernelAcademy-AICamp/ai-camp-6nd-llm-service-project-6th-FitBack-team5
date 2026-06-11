import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';

export interface VisitPattern {
  total: number;
  /** 요일별 방문 수 (0=일 … 6=토). */
  byWeekday: number[];
  /** 시간대별 방문 수. */
  byTimeBucket: { morning: number; afternoon: number; evening: number; night: number };
}

const WEEKDAY_LABEL = ['일', '월', '화', '수', '목', '금', '토'];

/** 최근 60일 방문의 요일·시간대 분포 (AI 코치 입력용). */
export function useVisitPattern() {
  const user = useCurrentUser();
  return useQuery<VisitPattern>({
    queryKey: ['visitPattern', user?.id],
    enabled: !!user,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from('visits')
        .select('check_in_time')
        .gte('check_in_time', since);
      if (error) throw error;
      const byWeekday = [0, 0, 0, 0, 0, 0, 0];
      const byTimeBucket = { morning: 0, afternoon: 0, evening: 0, night: 0 };
      for (const v of data ?? []) {
        const d = new Date((v as { check_in_time: string }).check_in_time);
        byWeekday[d.getDay()] += 1;
        const h = d.getHours();
        if (h >= 5 && h < 12) byTimeBucket.morning += 1;
        else if (h >= 12 && h < 18) byTimeBucket.afternoon += 1;
        else if (h >= 18) byTimeBucket.evening += 1;
        else byTimeBucket.night += 1;
      }
      return { total: data?.length ?? 0, byWeekday, byTimeBucket };
    },
  });
}

/** 요일 분포를 사람이 읽는 형태로 ("수 3회, 토 2회"). */
export function describeWeekday(byWeekday: number[]): string {
  return byWeekday
    .map((n, i) => ({ n, label: WEEKDAY_LABEL[i] }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .map((x) => `${x.label} ${x.n}회`)
    .join(', ');
}
