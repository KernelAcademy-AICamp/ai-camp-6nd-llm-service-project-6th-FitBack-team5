import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';

export interface MonthlyStats {
  visitCount: number;
  byPart: { part: string; count: number }[];
  /** membership_id → 이번 달 방문 횟수 */
  byMembership: Record<string, number>;
}

/** 이번 달 1일 00:00 (UTC) ISO. */
function monthStartISO(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01T00:00:00Z`;
}

/**
 * 이번 달 방문(visits)과 부위별 운동(exercise_records)을 집계한다.
 * 방문은 전체 합계(visitCount)와 회원권별(byMembership) 둘 다 제공하고,
 * 부위별(byPart)은 전체 기준. RLS로 본인 데이터만 잡힌다.
 */
export function useMonthlyStats() {
  const user = useCurrentUser();
  return useQuery<MonthlyStats>({
    queryKey: ['monthlyStats', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return { visitCount: 0, byPart: [], byMembership: {} };
      const start = monthStartISO();

      const { data: vrows, error: vErr } = await supabase
        .from('visits')
        .select('membership_id')
        .eq('user_id', user.id)
        .gte('check_in_time', start);
      if (vErr) throw vErr;

      const byMembership: Record<string, number> = {};
      for (const v of (vrows ?? []) as { membership_id: string }[]) {
        if (!v.membership_id) continue;
        byMembership[v.membership_id] = (byMembership[v.membership_id] ?? 0) + 1;
      }

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

      return { visitCount: vrows?.length ?? 0, byPart, byMembership };
    },
  });
}
