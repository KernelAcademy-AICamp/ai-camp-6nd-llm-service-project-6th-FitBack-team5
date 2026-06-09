# FitBack

운동 회원권 관리 + 식단 + 홈트레이닝 앱. 웹을 먼저 출시하고, 이후 동일 코드베이스로 iOS / Android 스토어에 배포합니다.

## 기술 스택

- **Expo (React Native) + Expo Router + React Native Web** — 한 코드로 웹·iOS·Android
- **Supabase** — DB / Auth / Storage
- **TanStack Query** — 서버 상태
- **Zustand** — 클라이언트 상태
- **TypeScript** (strict)

자세한 설계 메모는 [CLAUDE.md](CLAUDE.md) 참고.

## 사전 준비

- Node LTS, npm
- [Supabase](https://app.supabase.com) 프로젝트 1개
- (선택) iOS/Android 폰에 **Expo Go** 설치 — 폰에서 바로 띄워보고 싶을 때

## 설치 & 셋업

```bash
git clone <repo-url>
cd FItBack
npm install
cp .env.example .env
```

### Supabase 셋업

1. [Supabase 대시보드](https://app.supabase.com) → 새 프로젝트 생성
2. **Project Settings → API** 에서 URL / anon key 복사 → `.env`에 입력
3. **Authentication → Users → Add user** 로 개발용 테스트 계정 생성 (**Auto Confirm User 체크**)(선택)
4. 생성한 이메일/비밀번호를 `.env`의 `EXPO_PUBLIC_DEV_TEST_EMAIL` / `EXPO_PUBLIC_DEV_TEST_PASSWORD`에 입력
5. **SQL Editor** 열고 [supabase/migrations/01_init_profiles.sql](supabase/migrations/01_init_profiles.sql) 내용 전체 실행
   - `profiles` 테이블, RLS, 자동 프로필 생성 트리거, `is_admin()` 헬퍼가 한 번에 셋업됨

`.env` 예시:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
EXPO_PUBLIC_DEV_TEST_EMAIL=dev@fitback.local
EXPO_PUBLIC_DEV_TEST_PASSWORD=devpassword123
```

## 실행

```bash
npm run web        # 웹 (Chrome)
npm run ios        # iOS 시뮬레이터 (Xcode 필요)
npm run android    # Android 에뮬레이터 (Android Studio 필요)
npm start          # Expo Dev Tools — Expo Go로 폰에서 QR 스캔
npm run lint
```

폰에서 보는 가장 빠른 방법: `npm start` → 터미널 QR을 iPhone 카메라 / Android Expo Go 앱으로 스캔.(선택)

## 프로젝트 구조

```
src/
├── app/            # Expo Router 라우트
│   ├── _layout.tsx     # 인증 상태에 따라 LoginScreen / Tabs 분기
│   ├── index.tsx       # 회원권 탭 (랜딩)
│   ├── diet.tsx        # 식단 탭
│   └── workout.tsx     # 홈트 탭
├── components/     # 공용 UI (테마 컴포넌트, 탭바)
├── features/
│   └── auth/           # LoginScreen, useAuthBootstrap, useProfile
├── lib/                # supabase, queryClient
└── stores/             # Zustand (auth)

supabase/
└── migrations/         # SQL 마이그레이션 (Supabase SQL Editor에 붙여넣기)
```

## 현재 진행 상황

- [x] Expo + Expo Router + RN Web 골격
- [x] Supabase 클라이언트 (Web: localStorage / Native: AsyncStorage)
- [x] TanStack Query + Zustand 셋업
- [x] 개발용 LoginScreen (테스트 계정 자동 채우기)
- [x] `profiles` 테이블 + RLS + `is_admin()` 헬퍼 (member/admin 역할, 자가-승격 방지)
- [x] 회원권 / 식단 / 홈트 3탭 화면 (가데이터)
- [ ] 회원권 Supabase 연동 (`memberships` 테이블)
- [ ] 식단/홈트 Supabase 연동
- [ ] 실제 로그인/회원가입 화면 (개발용 LoginScreen 대체)
- [ ] 배포 (웹 → EAS Build → 스토어)

## 메모

- **로그인 화면은 개발용**입니다. `.env`의 테스트 계정으로만 로그인되며, 입력란 아래에 자동 채우기 버튼이 있습니다.
- **역할(role)** 은 `member` / `admin` 두 가지. 현재는 admin 정책 미적용 (컬럼만 존재). 자세한 전략은 [CLAUDE.md](CLAUDE.md#역할role-전략).
- 탭 아이콘은 임시로 템플릿 이미지를 재사용 중 — 디자인 에셋 확정 시 교체 예정.
