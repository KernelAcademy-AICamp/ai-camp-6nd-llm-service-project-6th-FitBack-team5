import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export interface ExerciseRow {
  id: string;
  exercise_part: string | null;
  intensity: string | null;
  duration: number | null;
  notes: string | null;
  auto_data: { kind?: string; trainer?: string | null; className?: string | null; status?: string } | null;
}

export interface VisitWithExercises {
  id: string;
  check_in_time: string;
  center_name: string | null;
  status: string;
  exercise_records: ExerciseRow[];
}

/** 한 회원권의 방문 이력(최신순) + 각 방문의 운동 기록. */
export function useMembershipVisits(membershipId: string | null) {
  return useQuery<VisitWithExercises[]>({
    queryKey: ['membershipVisits', membershipId],
    enabled: !!membershipId,
    queryFn: async () => {
      if (!membershipId) return [];
      const { data, error } = await supabase
        .from('visits')
        .select(
          'id, check_in_time, center_name, status, exercise_records(id, exercise_part, intensity, duration, notes, auto_data)',
        )
        .eq('membership_id', membershipId)
        .order('check_in_time', { ascending: false });
      if (error) throw error;
      return (data ?? []) as VisitWithExercises[];
    },
  });
}
