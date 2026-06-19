import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';
import { computeEndDate } from '@/features/membership/useCreateMembership';
import type { MembershipInputMethod, MembershipPeriod, MembershipType } from '@/features/membership/useMemberships';

export type FitnessGoal = 'fat_loss' | 'muscle_gain' | 'health' | 'body_shape' | 'habit';

export interface OnboardingInput {
  // STEP 내 정보 (선택)
  age: number | null;
  gender: 'M' | 'F' | null;
  height: number | null;
  weight: number | null;
  // STEP 회원권 + 센터 (선택 — '다음에 등록하기' 시 null)
  membership: {
    name: string;
    cost: number;
    period: MembershipPeriod;
    startDate: string;
    type: MembershipType;
    maxVisits: number | null; // 세션권 총 횟수 (기간권 = null)
    weeklyGoal: number | null; // 기간권 주당 목표 (세션권 = null)
    inputMethod?: MembershipInputMethod;
    centerName: string | null;
    centerLat: number | null;
    centerLng: number | null;
  } | null;
  // STEP 운동 목표 (선택)
  goal: FitnessGoal | null;
}

/**
 * 온보딩 최종 저장: 프로필(키/몸무게) → 회원권(+센터) → 운동 목표 → onboarded=true.
 * 회원권 생성 로직은 useCreateMembership과 동일(computeEndDate 재사용).
 * 프로필 캐시는 건드리지 않는다(완료 화면을 보여주고, '시작하기'에서 무효화 → 탭 전환).
 */
export function useCompleteOnboarding() {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: OnboardingInput) => {
      if (!user) throw new Error('로그인이 필요합니다.');
      const m = input.membership;

      // 1) 프로필 신체 정보(선택) — 생년월일→나이, 성별 포함
      const profilePatch: Record<string, unknown> = {};
      if (input.age != null) profilePatch.age = input.age;
      if (input.gender != null) profilePatch.gender = input.gender;
      if (input.height != null) profilePatch.height = input.height;
      if (input.weight != null) profilePatch.weight = input.weight;
      if (Object.keys(profilePatch).length > 0) {
        const { error } = await supabase.from('profiles').update(profilePatch).eq('id', user.id);
        if (error) throw error;
      }

      // 2) 회원권 (선택 — 없으면 건너뜀)
      if (m) {
        const { data: created, error: mErr } = await supabase
          .from('memberships')
          .insert({
            user_id: user.id,
            name: m.name.trim(),
            cost: m.cost,
            period: m.period,
            start_date: m.startDate,
            end_date: computeEndDate(m.startDate, m.period),
            type: m.type,
            max_visits: m.type === 'session' ? m.maxVisits : null,
            weekly_goal: m.type === 'period' ? m.weeklyGoal ?? null : null,
            input_method: m.inputMethod ?? 'manual',
          })
          .select()
          .single();
        if (mErr) throw mErr;

        // 2-1) 센터 좌표가 있으면 centers에 저장(GPS·날씨·경로용)
        if (m.centerLat != null && m.centerLng != null) {
          await supabase.from('centers').insert({
            user_id: user.id,
            membership_id: (created as { id: string }).id,
            name: m.centerName?.trim() || m.name.trim(),
            latitude: m.centerLat,
            longitude: m.centerLng,
          });
        }
      }

      // 3) 운동 목표(선택) — user_preferences upsert
      if (input.goal) {
        const { error } = await supabase
          .from('user_preferences')
          .upsert({ user_id: user.id, fitness_goal: input.goal }, { onConflict: 'user_id' });
        if (error) throw error;
      }

      // 4) 온보딩 완료
      const { error: oErr } = await supabase
        .from('profiles')
        .update({ onboarded: true })
        .eq('id', user.id);
      if (oErr) throw oErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memberships', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['monthlyStats', user?.id] });
      // profile은 완료 화면의 '시작하기'에서 무효화한다.
    },
  });
}
