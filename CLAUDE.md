@AGENTS.md

# 프로젝트: FitBack

운동 회원권의 **ROI(본전 회수율)** 를 관리하는 AI 운동 코치. 웹앱 우선, 동일 코드로 iOS/Android 확장.
모든 판단 기준: **"사용자가 실제로 운동하러 가게 만드는가?"** ROI(흑자/적자)를 숫자로 보여주는 게 핵심 차별점.

## 핵심 원칙 (카파시 4원칙 · 강제)

1. **Think Before Coding** — 모호하면 멈추고 질문. 추측을 사실처럼 단정 금지.
2. **Simplicity First** — 새로 만들기 전 기존 컴포넌트·토큰·훅 재사용. 요청 안 한 추상화 금지.
3. **Surgical Changes** — 변경한 모든 줄이 요청과 1:1. 범위 밖 리팩토링·포맷 변경 금지.
4. **Goal-Driven Execution** — 측정 가능한 완료 조건. 자체 검증 전 "완료" 선언 금지.

## 기술 스택

- Expo SDK 56 (React Native) + Expo Router (`src/app/`) + React Native Web
- Supabase — DB + Auth + **Edge Functions** (`supabase/functions/`)
- TanStack Query(서버 상태) · Zustand(클라 상태) · TypeScript strict
- `lucide-react-native`(아이콘) · `expo-font`+Pretendard · `expo-location`

## 절대 규칙 (디자인 토큰)

- 색·여백·radius **하드코딩 금지**. 반드시 `src/constants/theme.ts` 토큰 사용(`Palette.*`/`Spacing.*`/`Radius.*`). raw hex·raw 숫자 = 위반.
- 텍스트는 `ThemedText`, 아이콘은 Lucide. `docs/design-system.md`에 없는 값이면 먼저 질문.
- 손익 컬러(`Palette.loss/profit`)는 ROI 손익에만. 색 단독 의존 금지 → 아이콘+라벨+색 3중.

## 절대 규칙 (Figma 구현)

- 원본 텍스트·variant만 사용(자의 추가·변경 금지). variant마다 컴포넌트 쪼개지 말 것 — 단일 컴포넌트 + props.
- 컴포넌트는 `width:100%`/`flex:1`, 바깥 여백은 부모가 padding으로.

## 출석 검증 규칙 (확정: 검증된 기록)

- 체크인은 센터 **100m 이내**에서만 활성(`CheckInFlow`의 지오펜스). 위치는 웹·앱 모두 `getPosition()`.
- 자기신고로 ROI를 움직이지 않는다. 폴백 출석을 추가할 땐 검증 여부를 구분해 기록할 것.

## 도메인 요약 (상세 → `docs/architecture.md`)

- **회원권 타입**: `free`(자유) / `session`(PT) / `class`(클래스). 남은횟수 = `max_visits − visits.count`.
- **ROI 핵심 지표**: `valueAtRisk = remaining × (cost/max_visits)` = 만료 시 소멸 금액. 페이스로 danger/warning/safe. free는 neutral(만료 시엔 danger, 단 valueAtRisk=0이라 금액 영향 없음). → `dashboard.ts`
- **AI 코치**: `coach` Edge Function이 risk·pace 받아 `CoachTip` 1장 생성(6h 캐시). → `useCoach.ts`
- **실제 테이블**: profiles, memberships, centers, visits, exercise_records, user_preferences, workout_logs, exercises, meals, food_favorites.
- 식단(`diet.tsx`/`meals`)·홈트는 **독립 기능(ROI 비핵심)** — 코드는 유지, 신규 작업 시 ROI 우선.

## 프로젝트 구조

```
src/app/        # 라우트 (index, diet, workout/*)
src/features/   # 도메인 훅·UI (auth, membership, onboarding, diet, workout)
src/components/ # 공용 컴포넌트 (themed-text, ui/)
src/constants/  # theme.ts (토큰)
src/lib/        # supabase, queryClient
src/stores/     # zustand
supabase/migrations/  # 01~17  ·  supabase/functions/  # Edge Functions
```

## 빌드 명령어

```bash
npm run web      # 웹    npm run ios / android
npm run lint     # ESLint
```

## 작업 원칙

- 단계별 진행, 각 단계 후 사용자 확인. 크로스플랫폼 분기는 `Platform.OS` / `.web.tsx` / `.native.tsx`.
- Expo v56 공식 문서 우선(AGENTS.md). 상세 모델·결정 이력·검증 갭은 `docs/architecture.md` 참조.
