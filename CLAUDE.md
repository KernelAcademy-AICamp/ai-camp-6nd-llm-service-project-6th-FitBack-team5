@AGENTS.md

# FitBack

운동 회원권 관리 + 식단 + 홈트레이닝 앱.
웹을 먼저 출시하고, 이후 동일 코드베이스로 iOS / Android 스토어 배포 예정.

## 개발 환경

- **OS**: macOS
- **패키지 매니저**: npm (Expo 기본값)
- **Expo SDK**: 56
- **Node**: LTS

## 기술 스택

| 레이어 | 선택 |
| --- | --- |
| 프레임워크 | Expo (React Native) + Expo Router |
| 웹 지원 | React Native Web (한 코드로 웹/iOS/Android) |
| 백엔드/DB/Auth/Storage | Supabase ([src/lib/supabase.ts](src/lib/supabase.ts)) |
| 서버 상태 | TanStack Query ([src/lib/queryClient.ts](src/lib/queryClient.ts), Provider는 [src/app/_layout.tsx](src/app/_layout.tsx)) |
| 클라이언트 상태 | Zustand ([src/stores/auth.ts](src/stores/auth.ts)) |
| 언어 | TypeScript |

## 디자인 시스템

전체 스펙은 [design.md](design.md) 참고. 코드 토큰은 [src/constants/theme.ts](src/constants/theme.ts)에 정의.

**적용된 것**
- 컬러 팔레트 (Primary `#6675FF`, BG Base `#FAF9F7`, Semantic UI/손익, Neutral, Line)
- Spacing — 8pt 그리드 (semantic 별칭 `xs/sm/md/lg/xl/xxl`) + 좌우 여백 `ScreenPaddingX = 20`
- Radius — `small(8)/button(12)/card(20)/modal(20)/full(100)`
- Elevation — `level1/level2` (웹 `boxShadow` + 네이티브 `shadow*` 자동 분기)
- 타입 스케일 — [ThemedText](src/components/themed-text.tsx) `default/display/title/subtitle/small/smallBold` 가 design §5 기준으로 매핑됨, 자간 -2.5% 자동 적용
- 화면 적용 — 로그인, 회원권, 식단, 홈트, 탭바(웹/네이티브), 로딩 상태

**보류 (별도 작업 필요)**
- **Pretendard 폰트** — `expo-font` 셋업 + 폰트 파일 추가 필요. 현재 시스템 sans-serif fallback.
- **Lucide 아이콘** — `lucide-react-native` 설치 + 탭/UI 아이콘 교체. 현재 템플릿 PNG 재사용.
- **AI 피드백 Voice/Tone** — 아직 AI 기능 없음. AI 멘트 도입 시 design §12 톤 가이드 적용.

**디자인 사용 금지 (design.md §14) — 코드 작성 시 준수**
- 그라데이션 배경 (손익 게이지 제외)
- Primary 컬러를 에러/경고에 사용 금지
- 손익 컬러(흑자/적자)를 일반 성공/실패에 혼용 금지
- 카드 내 카드 중첩 금지
- Primary 버튼 화면당 1개
- 이모티콘 금지 (Lucide 아이콘 사용)

## 프로젝트 구조

`create-expo-app` 기본 템플릿(SDK 56) 그대로 사용 중. 라우트는 `app/`이 아니라 `src/app/`에 위치한다.

```
FItBack/
├── src/
│   ├── app/              # Expo Router 라우트 (_layout.tsx, index.tsx, diet.tsx, workout.tsx)
│   ├── components/
│   ├── constants/
│   ├── features/         # 도메인별 훅·로직 (auth, membership, diet, workout 등)
│   │   └── auth/         # useAuthBootstrap, useProfile 등
│   ├── hooks/
│   ├── lib/              # supabase, queryClient 등 외부 연동
│   ├── stores/           # Zustand 스토어 (auth 등)
│   └── global.css
├── supabase/
│   └── migrations/       # SQL 마이그레이션 (Supabase SQL Editor에 붙여넣기)
├── assets/
├── scripts/
├── app.json
├── package.json
├── tsconfig.json
├── .env.example          # Supabase 키 템플릿 (.env로 복사 후 실제 값 입력)
├── AGENTS.md             # Expo v56 문서 우선 참조 지침
└── CLAUDE.md
```

## 실행 명령

```bash
npm run web        # 웹
npm run ios        # iOS 시뮬레이터
npm run android    # Android 에뮬레이터
npm start          # Expo Dev Tools
npm run lint
```

## 진행 상황

- [x] **Phase 0**: Expo + Expo Router + RN Web 골격 생성
- [x] **Supabase 클라이언트 설치 및 구성** ([src/lib/supabase.ts](src/lib/supabase.ts))
  - Web: localStorage, Native(iOS/Android): AsyncStorage
  - 환경변수 `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` 사용
  - **사용자 작업 필요**: Supabase 프로젝트 생성 후 `.env.example` → `.env` 복사하고 값 채우기
- [x] **TanStack Query 셋업** — `QueryClient` + 루트 `QueryClientProvider` ([src/app/_layout.tsx](src/app/_layout.tsx))
- [x] **Zustand auth 스토어** ([src/stores/auth.ts](src/stores/auth.ts))
- [x] **세션 부트스트랩** ([src/features/auth/useAuthBootstrap.ts](src/features/auth/useAuthBootstrap.ts))
  - 앱 시작 시 `getSession()`으로 기존 세션 복원, `onAuthStateChange` 구독
  - 자동 로그인은 제거 (로그인 화면이 대신함)
- [x] **개발용 로그인 화면** ([src/features/auth/LoginScreen.tsx](src/features/auth/LoginScreen.tsx))
  - 세션 없으면 자동으로 노출 ([src/app/_layout.tsx](src/app/_layout.tsx) `AppShell`에서 분기)
  - 이메일/비밀번호 입력 + 에러 표시
  - 입력란 아래에 `.env`의 테스트 계정/비밀번호 노출 + "자동 채우기" 버튼
  - 사실상 테스트 계정으로만 로그인 가능 (Supabase에 다른 유저가 없음). 실제 로그인/회원가입 UI는 추후 별도 구현.
- [x] **`profiles` 테이블 + RLS** ([supabase/migrations/01_init_profiles.sql](supabase/migrations/01_init_profiles.sql))
  - `role` 컬럼 (member/admin) 포함, 기본 `member`. admin 정책은 미적용 (헬퍼 `is_admin()`만 정의).
  - 가입 시 `handle_new_user` 트리거로 자동 profile 생성
  - 자가-승격 방지 트리거 (`prevent_role_self_elevation`)
  - 클라이언트: [src/features/auth/useProfile.ts](src/features/auth/useProfile.ts) — `useProfile()` 훅
  - **사용자 작업 필요**: Supabase SQL Editor에서 위 SQL 실행
- [x] **도메인 화면 골격 (가데이터)** — 3탭 구조 ([src/components/app-tabs.tsx](src/components/app-tabs.tsx))
  - 회원권 ([src/app/index.tsx](src/app/index.tsx)) — 로그인 후 랜딩, `AuthFooter`(이메일+로그아웃) 포함
  - 식단 ([src/app/diet.tsx](src/app/diet.tsx))
  - 홈트 ([src/app/workout.tsx](src/app/workout.tsx))
  - 모든 데이터는 가데이터(`dummy*`). Supabase 연동 전 단계.
  - 탭 아이콘은 임시(home.png/explore.png 재사용) — 아이콘 에셋 별도 디자인 필요
- [ ] **회원권 Supabase 연동** — `memberships` 테이블 + RLS + `useMemberships()` 훅 → 가데이터 교체
- [ ] 식단 Supabase 연동 (`meals`, `foods`, `nutrition_logs`)
- [ ] 홈트 Supabase 연동 (`workouts`, `exercises`, `routines`) + TTS
- [ ] 실제 로그인/회원가입 화면 (개발용 LoginScreen 대체 시점)
- [ ] 배포 (웹 → EAS Build)

## 작업 원칙

1. **단계별 진행**: 한 번에 전부 만들지 않는다. 각 단계 완료 후 사용자 확인 받고 다음으로.
2. **크로스 플랫폼 우선**: 모든 기능은 웹/iOS/Android에서 동작해야 한다. 플랫폼 분기는 `Platform.OS` 또는 `.web.tsx` / `.native.tsx` 파일 분리.
3. **TypeScript strict 모드** 지향.
4. **Expo v56 공식 문서 우선 참조** (AGENTS.md 지침).

## 역할(Role) 전략

- 현재는 `member`만 사용. `admin`은 컬럼만 존재하고 정책에는 참조 안 함.
- admin이 필요해지면:
  1. SQL Editor에서 첫 admin 직접 승격: `update profiles set role='admin' where id='<uuid>'`
  2. 테이블별 정책에 `or is_admin()` 추가
  3. admin 전용 화면 추가 (`useProfile().data?.role === 'admin'` 가드)
- `is_admin()` 헬퍼 함수는 이미 정의되어 있어 정책 추가 시 즉시 사용 가능.

## 다음 작업

사용자 선행 작업:
1. Supabase 대시보드 → Authentication → Users → **Add user** 로 테스트 계정 생성 (Auto Confirm User 체크)
2. `.env`에 `EXPO_PUBLIC_DEV_TEST_EMAIL`, `EXPO_PUBLIC_DEV_TEST_PASSWORD` 채우기
3. Supabase SQL Editor에서 [supabase/migrations/01_init_profiles.sql](supabase/migrations/01_init_profiles.sql) 실행
4. `npm run web` → 로그인 화면에서 "자동 채우기" 클릭 후 로그인 → 탭 화면 진입 확인

그 후 진행할 후보:
- 회원권 Supabase 연동: `memberships` 테이블 + RLS + `useMemberships()` 훅 → [src/app/index.tsx](src/app/index.tsx)의 `dummyMemberships` 교체
