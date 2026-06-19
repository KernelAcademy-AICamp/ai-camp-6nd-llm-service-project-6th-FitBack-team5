import { posthog } from 'posthog-js';

// EXPO_PUBLIC_POSTHOG_KEY가 없으면 전부 무동작(안전). 키는 Vercel/.env에 설정.
const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

let started = false;

export function initAnalytics(): void {
  if (started || !KEY || typeof window === 'undefined') return;
  posthog.init(KEY, {
    api_host: HOST,
    capture_pageview: true, // 웹 라우트 page_view 자동 수집
    person_profiles: 'identified_only', // 익명 프로필 남발 방지
  });
  started = true;
}

export function identifyUser(id: string, props?: Record<string, unknown>): void {
  if (!started) return;
  posthog.identify(id, props);
}

export function captureEvent(name: string, props?: Record<string, unknown>): void {
  if (!started) return;
  posthog.capture(name, props);
}

export function resetAnalytics(): void {
  if (!started) return;
  posthog.reset();
}
