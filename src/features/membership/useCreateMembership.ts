import { useMutation, useQueryClient } from '@tanstack/react-query';

import { EVENTS, logEvent } from '@/features/analytics/events';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';

import type { MembershipInputMethod, MembershipPeriod, MembershipType } from './useMemberships';

export interface NewMembershipInput {
  name: string;
  cost: number;
  period: MembershipPeriod;
  startDate: string; // 'YYYY-MM-DD'
  type: MembershipType;
  /** 인세권(session) 총 횟수. 기간권(period)은 null. */
  maxVisits: number | null;
  /** 기간권(period) 주당 목표 방문. 인세권은 null. */
  weeklyGoal?: number | null;
  inputMethod?: MembershipInputMethod;
  /** 선택: 센터명 + 좌표(현재 위치). 좌표가 있으면 centers에 함께 저장(GPS·날씨·경로용). */
  centerName?: string | null;
  centerLat?: number | null;
  centerLng?: number | null;
}

const PERIOD_MONTHS: Record<MembershipPeriod, number> = {
  month: 1,
  '3month': 3,
  '6month': 6,
  '12month': 12,
};

/** end_date = start_date + period months. Both 'YYYY-MM-DD'.
 * UTC로 다뤄야 toISOString()이 타임존만큼 날짜를 밀지 않는다. */
export function computeEndDate(startDate: string, period: MembershipPeriod): string {
  const d = new Date(`${startDate}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + PERIOD_MONTHS[period]);
  return d.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' that actually parses to that calendar date.
 * UTC 파싱이라 round-trip 비교가 로컬 타임존 영향을 받지 않는다. */
export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
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
          max_visits: input.type === 'session' ? input.maxVisits : null,
          weekly_goal: input.type === 'period' ? input.weeklyGoal ?? null : null,
          input_method: input.inputMethod ?? 'manual',
        })
        .select()
        .single();
      if (error) throw error;
      // 센터 좌표가 있으면 centers에 함께 저장 (GPS·날씨·경로용). 실패해도 회원권은 유지.
      if (input.centerLat != null && input.centerLng != null) {
        await supabase.from('centers').insert({
          user_id: user.id,
          membership_id: (data as { id: string }).id,
          name: input.centerName?.trim() || input.name.trim(),
          latitude: input.centerLat,
          longitude: input.centerLng,
        });
      }
      return data;
    },
    onSuccess: (data) => {
      logEvent(EVENTS.membershipAdded, { type: (data as { type?: string })?.type });
      queryClient.invalidateQueries({ queryKey: ['memberships', user?.id] });
    },
  });
}
