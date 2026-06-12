# FitBack 아키텍처 레퍼런스

> CLAUDE.md의 상세 보충 문서. 코드(`fitback-작업`) 기준 사실관계. 깊은 내용이 필요할 때만 참조.

## 데이터 모델 (마이그레이션 01~17)

| 테이블 | 용도 | 핵심 컬럼 |
| --- | --- | --- |
| `profiles` | 사용자 | role(member/admin) |
| `memberships` | 회원권 | name, cost, period(month/3·6·12month), start_date, end_date, **type(free/session/class)**, max_visits(nullable) |
| `centers` | 센터(위치 검증 기준) | name, latitude, longitude |
| `visits` | 출석/체크인 | user_id, membership_id, center_name, status('checked_in'), check_in_time(default now()) |
| `exercise_records` | 운동 기록 | visit 연결, 부위/타입별 |
| `user_preferences` | 온보딩 설정 | |
| `workout_logs` | 홈트 기록 | body_part |
| `exercises` | 운동 종목 | |
| `meals` / `food_favorites` | 식단 (독립 기능, ROI 비핵심) | |

남은 횟수 = `max_visits − visits.count`. `usedVisits`는 visits FK 집계로 파생(저장 안 함).

## ROI / 위험도 모델 — `src/features/membership/dashboard.ts`

**페이스 기반 위험도** 모델 (손익분기 모델 아님).

`computeRisk(membership, visitsThisMonth) → RiskInfo`
- 회당 단가 `costPerSession = cost / max_visits` (횟수제만)
- 사용 가치 `valueUsed = used × costPerSession`
- **위험 금액 `valueAtRisk = remaining × costPerSession`** (만료 시 소멸 = 핵심 지표)
- 페이스: `requiredPace = remaining ÷ (남은일/7)`, `actualPace = visitsThisMonth ÷ 4.3`
  - `ratio < 0.7` → danger(적자) / `< 1.0` → warning / `≥ 1.0` → safe(흑자)
- 만료(`remainingDays ≤ 0`) → danger (free 포함. free는 valueAtRisk=0이라 금액 영향 없음)
- **free(자유이용, max_visits 없음, 미만료) → neutral** (손익분기 계산 안 함)

`summarize()` → 대시보드 집계
- `recoverable` = danger 회원권 valueAtRisk (살릴 수 있는 돈 → 히어로)
- `lost` = 만료 회원권 valueAtRisk (이미 잃은 돈 → 회색)
- `valueUsedThisMonth` = Σ(monthlyVisits × costPerSession)
- `topPriorityName/Pace` = 가장 급한 회원권 + 주당 필요 방문수

색·접근성: `RISK_COLORS` → design 손익 컬러(`Palette.loss/profit/warning`). 색 단독 금지, 아이콘+라벨+색 3중(`RISK_META`).

## 출석·체크인 검증 (확정 B = 검증된 기록) — `CheckInFlow.tsx` + `location.ts`

**구현됨**
- `getPosition()` — 웹 `navigator.geolocation`(고정밀 실패 시 저정밀 폴백) / 네이티브 `expo-location`.
- 도착 단계에서 `distanceKm(현재, 센터)` → **100m 이내(`CHECK_IN_RADIUS_KM`)일 때만** 체크인 버튼 활성화.
- 가는 중 `watchPosition` 실시간 추적, GPS 실패 시 시뮬레이션(데모용). CheckInFlow.tsx에서 `navigator.geolocation.watchPosition` 직접 호출(RN polyfill 경유) — `getPosition()`과 달리 location.ts를 거치지 않는다.

**갭 (B 엄격화하려면 보완)**
1. 검증 결과가 DB에 안 남음 — `visits`에 lat/lng/verified 없이 center_name+status만 저장.
2. 폴백 우회로 — 거리 밖/GPS 실패 시 "운동 기록으로 출석"(`checkIn(true)`)으로 인정 가능 → 자기신고 여지.

보완안: `visits`에 `lat/lng/verified/method` 추가 + 폴백을 `verified=false`로 표시, ROI 반영 정책 결정.

## AI 코치 — `useCoach.ts` → `coach` Edge Function

- Edge Function `coach`가 Claude 호출(키 서버 보관). 입력: 회원권 risk·valueAtRisk·requiredWeeklyPace·월 통계(부위별)·방문 패턴(요일/시간대).
- 출력: `CoachTip { headline, insight, action }`.
- 6시간 캐시 + 입력 시그니처 캐싱. 회원권 없으면 비활성.
- `coach`(ROI/회원권 코치)와 `ai-feedback`(음식명 → 식약처 조회 + Claude 식단 피드백)은 역할이 다름. ⚠️ 정리 대상은 `ai-feedback` ↔ `food-search` 사이 — 둘 다 음식 입력 → Claude 피드백 흐름이고, `ai-feedback`은 헤더에 "시작용 스캐폴드" 표기 상태.

## 외부 연동 — Edge Functions (`supabase/functions/`)

`route`(카카오 자동차) · `transit`(대중교통) · `weather` · `geocode`(장소검색) · `coach` · `ai-feedback` · `food-search`.
클라 훅: `useRoute/useTransit/useWeather/useGeocode/useCoach`. OCR: `ocr.ts`+`parseReceipt.ts`(영수증 회원권 등록).

## 확정 결정 이력

1. 백엔드 = Supabase 올인원 (Express/Postgres/Redis 미채택)
2. 플랫폼 = 웹앱 우선·앱 기준. 위치는 웹·앱 모두 동작(웹도 GPS 검증)
3. 클라 상태 = Zustand + TanStack Query (Redux 미채택)
4. AI = ROI 숫자에 묶음 (coach 페이로드가 risk 기반)
5. 인증 = 현행(이메일/비번 + RLS)
6. 출석 신뢰성 = B(검증된 기록), 현재 부분 구현

## 역할(Role) 전략

- 현재 `member`만 사용. `admin`은 컬럼만 존재하고 정책엔 참조 안 함. `is_admin()` 헬퍼는 이미 정의됨.
- admin이 필요해지면:
  1. SQL Editor에서 첫 admin 직접 승격: `update profiles set role='admin' where id='<uuid>'`
  2. 테이블별 정책에 `or is_admin()` 추가
  3. admin 전용 화면 가드: `useProfile().data?.role === 'admin'`

## 신규 개발자 셋업

1. Supabase 대시보드 → Authentication → Users → **Add user** (Auto Confirm User 체크)
2. `.env`에 `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_DEV_TEST_EMAIL`, `EXPO_PUBLIC_DEV_TEST_PASSWORD` 채우기
3. Supabase SQL Editor에서 `supabase/migrations/` **01~17 순서대로** 실행
4. `npm run web` → 로그인 화면 "자동 채우기" → 로그인 확인
