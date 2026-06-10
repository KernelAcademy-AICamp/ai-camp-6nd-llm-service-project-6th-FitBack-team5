import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';

import type { MembershipPeriod, MembershipType } from './useMemberships';

export interface NewMembershipInput {
  name: string;
  cost: number;
  period: MembershipPeriod;
  startDate: string; // 'YYYY-MM-DD'
  type: MembershipType;
  /** session/class only; ignored (stored null) for free. */
  maxVisits: number | null;
}

const PERIOD_MONTHS: Record<MembershipPeriod, number> = {
  month: 1,
  '3month': 3,
  '6month': 6,
  '12month': 12,
};

/** end_date = start_date + period months. Both 'YYYY-MM-DD'. */
export function computeEndDate(startDate: string, period: MembershipPeriod): string {
  const d = new Date(`${startDate}T00:00:00`);
  d.setMonth(d.getMonth() + PERIOD_MONTHS[period]);
  return d.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' that actually parses to that calendar date. */
export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Inserts a membership for the current user (onboarding STEP 3~5).
 * end_date is derived from start_date + period; max_visits is forced null for
 * free memberships. Invalidates the memberships list on success.
 */
export function useCreateMembership() {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewMembershipInput) => {
      if (!user) throw new Error('로그인이 필요합니다.');
      const { data, error } = await supabase
        .from('memberships')
        .insert({
          user_id: user.id,
          name: input.name.trim(),
          cost: input.cost,
          period: input.period,
          start_date: input.startDate,
          end_date: computeEndDate(input.startDate, input.period),
          type: input.type,
          max_visits: input.type === 'free' ? null : input.maxVisits,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memberships', user?.id] });
    },
  });
}
