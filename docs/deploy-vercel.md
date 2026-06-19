# FitBack 웹 배포 (Vercel)

Expo SDK 56 (React Native Web + Expo Router, `web.output: "static"`) → Vercel 정적 호스팅.

## 1. 빌드 설정
- `vercel.json` (리포 루트):
  - `buildCommand`: `npx expo export --platform web` → `dist/` 생성
  - `outputDirectory`: `dist`
  - `rewrites`: 모든 경로 → `/index.html` (SPA fallback). Vercel은 **정적 파일을 먼저** 서빙하고, 매칭 없을 때만 rewrite하므로 JS/asset 로딩을 깨지 않음.
- 로컬 빌드 확인: `npm run build:web` → `dist/` 산출 확인.

## 2. Vercel 프로젝트 환경변수 (Settings → Environment Variables)
빌드 타임에 번들로 인라인됨 → **공개되어도 되는 값만**:

| 키 | 값 | 비고 |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | 공개 OK |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | anon public key | 공개 OK (RLS로 보호) |

> ⚠️ **절대 금지**: `service_role` 키, `SUPABASE_DB_URL`, `ANTHROPIC_API_KEY`, `SUPABASE_ACCESS_TOKEN` 등은 `EXPO_PUBLIC_*`로 넣지 말 것(번들 노출). AI 키는 서버(Edge Function) 시크릿으로만.

## 3. Supabase Auth 설정
- **Authentication → URL Configuration**: Site URL + Redirect URLs에 Vercel 도메인 추가
  (예: `https://fitback.vercel.app`, 프리뷰 도메인 패턴 포함).
- 이메일 확인(Confirm email) 사용 시 리다이렉트가 위 도메인으로 가야 함.

## 4. 웹 호환 점검 (배포 전)
네이티브 모듈의 웹 동작 확인 — `npm run build:web` + 로컬 서빙으로 점검:
- `expo-video`(홈트 영상), `expo-location`(체크인), TTS/오디오 → 웹 미지원 기능은 graceful fallback 필요.
- 체크인 지오펜스: 웹은 `navigator.geolocation` 권한 흐름 확인.

## 5. 배포 순서
1. GitHub 리포를 Vercel에 Import (브랜치: main).
2. Framework Preset = Other(자동), Build/Output은 `vercel.json`이 지정.
3. 환경변수 등록(§2) → Deploy.
4. 배포 도메인을 Supabase Auth URL에 등록(§3).

## 참고
- 모바일 앱(iOS/Android)은 별도(EAS) — 본 문서는 웹 한정.
