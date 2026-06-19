// 기본(네이티브) 구현 — 현재는 무동작 스텁.
// Android 배포 시 posthog-react-native를 여기(또는 posthog.native.ts)에 연결한다.
// 웹은 posthog.web.ts가 우선 적용된다(Metro 플랫폼 확장 해석).

export function initAnalytics(): void {}
export function identifyUser(_id: string, _props?: Record<string, unknown>): void {}
export function captureEvent(_name: string, _props?: Record<string, unknown>): void {}
export function resetAnalytics(): void {}
