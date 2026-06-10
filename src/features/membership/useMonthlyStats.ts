import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';

export interface MonthlyStats {
  visitCount: number;
  byPart: { part: string; count: number }[];
}

/** 이번 달 1일 00:00 (UTC) ISO. */
function monthStartISO(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01T00:00:00Z`;
}

/**
 * 이번 달 방문 횟수(visits) + 부위별 운동 횟수(exercise_records)를 집계한다.
 * RLS로 본인 데이터만 잡히고, 부위 그룹핑은 클라이언트에서 수행.
 */
export function useMonthlyStats() {
  const user = useCurrentUser();
  return useQuery<MonthlyStats>({
    queryKey: ['monthlyStats', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return { visitCount: 0, byPart: [] };
      const start = monthStartISO();

      const { count, error: vErr } = await supabase
        .from('visits')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('check_in_time', start);
      if (vErr) throw vErr;

      const { data: recs, error: eErr } = await supabase
        .from('exercise_records')
        .select('exercise_part')
        .eq('user_id', user.id)
        .gte('recorded_at', start);
      if (eErr) throw eErr;

      const map = new Map<string, number>();
      for (const r of (recs ?? []) as { exercise_part: string }[]) {
        map.set(r.exercise_part, (map.get(r.exercise_part) ?? 0) + 1);
      }
      const byPart = Array.from(map, ([part, c]) => ({ part, count: c })).sort(
        (a, b) => b.count - a.count,
      );

      return { visitCount: count ?? 0, byPart };
    },
  });
}
