import { Platform } from 'react-native';

import { captureEvent } from '@/features/analytics/posthog';
import { supabase } from '@/lib/supabase';

/** 표준 이벤트 이름 — PRD §06 지표와 1:1. 새 이벤트는 여기에 추가. */
export const EVENTS = {
  signup: 'signup',
  onboardingComplete: 'onboarding_complete',
  membershipAdded: 'membership_added',
  checkinStarted: 'checkin_started',
  checkinVerified: 'checkin_verified', // NSM: 주간 검증 체크인
  checkinFallback: 'checkin_fallback', // 수동 출석(미검증)
  coachOpen: 'coach_open',
  recommendClick: 'recommend_click',
  scheduleAdded: 'schedule_added',
  dietLogged: 'diet_logged',
  workoutCompleted: 'workout_completed',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

/**
 * 이벤트 1건 적재. fire-and-forget — 실패해도 UX를 막지 않는다.
 * 인증 사용자 이벤트만 기록(events RLS owner-only). 세션은 로컬 캐시에서 읽어 네트워크 왕복 없음.
 */
export function logEvent(name: EventName | string, props?: Record<string, unknown>): void {
  // PostHog(웹) — 퍼널·리텐션용. 키 없거나 네이티브면 무동작.
  captureEvent(name, props);
  // Supabase events — 계정 단위 사업지표(SQL 집계)용.
  void (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      if (!userId) return;
      await supabase.from('events').insert({
        user_id: userId,
        name,
        props: props ?? null,
        platform: Platform.OS,
      });
    } catch {
      // analytics 실패는 무시
    }
  })();
}
