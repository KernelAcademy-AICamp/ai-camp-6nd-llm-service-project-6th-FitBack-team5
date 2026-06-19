# FitBack 분석 — PostHog(행동/퍼널/리텐션) + Supabase(사업지표) 하이브리드

> 행동·퍼널·리텐션·마케팅 = **PostHog**, 회원권 활용도·회수액·ROI = **Supabase SQL 뷰**.
> 이벤트는 `logEvent()` 한 곳에서 **양쪽에 동시 전송**(이중 적재).

## 1. 구조
```
앱 행동 → logEvent(name, props)
            ├─ PostHog(웹: posthog-js)   → 퍼널·리텐션·코호트·마케팅 UI
            └─ Supabase events 테이블     → 도메인 조인·사업지표 SQL
```
- `src/features/analytics/events.ts` — `logEvent` + `EVENTS` 상수(단일 출처).
- `posthog.ts`(기본/네이티브 무동작) · `posthog.web.ts`(posthog-js) — 플랫폼 분리.
- init·identify·reset = `useAuthBootstrap`에서 자동(로그인 시 identify, 로그아웃 시 reset).

## 2. 설정 (키 없으면 전부 무동작 — 안전)
`.env`(로컬) / Vercel 환경변수:
```
EXPO_PUBLIC_POSTHOG_KEY=phc_xxx        # PostHog 프로젝트 API 키(공개 가능)
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com   # (기본값, EU면 eu.i.posthog.com)
```
- 키 발급: PostHog → Project Settings → Project API Key(`phc_…`). **개인 토큰 아님**.
- 키는 클라이언트 공개용이라 `EXPO_PUBLIC_*` 허용(서버 시크릿 아님).

## 3. 핵심 이벤트 (이미 계측됨 · PRD §06 매핑)
| 이벤트 | 발생 | 퍼널/지표 |
|---|---|---|
| `signup` | 가입 성공 | 활성화 퍼널 1 |
| `onboarding_complete` | 온보딩 완료 | 활성화 퍼널 2 |
| `membership_added` | 회원권 등록 | 활성화 퍼널 3(핵심) |
| `checkin_started` | 체크인 시작 | 핵심 행동 |
| `checkin_verified` | 지오펜스 검증 체크인 | **출시 NSM** |
| `checkin_fallback` | 자기신고 체크인 | 품질 분모 |
| `schedule_added` | 일정 추가 | 핵심 행동 |
| `diet_logged` | 식단 기록 | 핵심 행동 |
| `workout_completed` | 운동 완료 | 핵심 행동 |
| `coach_open` | 코치 진입 | 추천 노출 |
| `recommend_click` | AI 추천 실행 | 추천 전환 |

## 4. PostHog에서 만들 뷰
- **활성화 퍼널(베타 NSM)**: `signup → onboarding_complete → membership_added → (checkin_started|recommend_click|schedule_added|diet_logged|workout_completed)`. 베타 목표 4/5.
- **출시 NSM**: `checkin_verified` 주간 트렌드 + WAU.
- **리텐션**: `signup` 기준 N-day retention(복귀 = 핵심 행동 발생).
- **코호트**: 가입 주차별 / 회원권 형태별(props.type).
- **추천 전환**: `coach_open → recommend_click` 퍼널.

## 5. 마케팅(유입) — 후속
- 웹 `capture_pageview: true`로 page_view 자동. UTM은 PostHog가 자동 파싱.
- GA4는 광고 attribution 본격화 시에만 추가 검토(현재 불필요 — PostHog로 유입 상당 부분 커버).

## 6. Android(추후)
- `posthog-react-native` 추가 → `posthog.native.ts`(또는 `posthog.ts`) 구현 교체. `events.ts`/`EVENTS`는 그대로 재사용.

## 7. 데이터 거버넌스
- 이벤트가 외부(PostHog)로 전송됨 → 개인정보 최소화(props에 식별정보 금지, id만). EU/셀프호스팅 옵션 검토.
