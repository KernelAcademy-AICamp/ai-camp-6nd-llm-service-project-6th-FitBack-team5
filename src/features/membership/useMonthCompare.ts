import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';

export interface MonthCompare {
  thisMonth: number;
  lastMonth: number;
  /** 전월 대비 방문 증감률(%). 지난달 0이면 null. */
  changePct: number | null;
}

function monthStartISO(y: number, mZeroBased: number): string {
  return `${y}-${String(mZeroBased + 1).padStart(2, '0')}-01T00:00:00Z`;
}

/** 이번 달 vs 지난 달 방문 수 비교 (홈 히어로 '지난 달보다 +N%'). */
export function useMonthCompare() {
  const user = useCurrentUser();
  return useQuery<MonthCompare>({
    queryKey: ['monthCompare', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return { thisMonth: 0, lastMonth: 0, changePct: null };
      const now = new Date();
      const y = now.getUTCFullYear();
      const m = now.getUTCMonth();
      const thisStart = monthStartISO(y, m);
      const lastStart = monthStartISO(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1);

      const { data, error } = await supabase
        .from('visits')
        .select('check_in_time')
        .eq('user_id', user.id)
        .gte('check_in_time', lastStart);
      if (error) throw error;

      const thisStartMs = new Date(thisStart).getTime();
      let thisMonth = 0;
      let lastMonth = 0;
      for (const v of (data ?? []) as { check_in_time: string }[]) {
        if (new Date(v.check_in_time).getTime() >= thisStartMs) thisMonth += 1;
        else lastMonth += 1;
      }
      const changePct =
        lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;
      return { thisMonth, lastMonth, changePct };
    },
  });
}
