# feat: 홈 대시보드 신설 + 기록 캘린더 + MY 코치(보류) + 회원권 도움말

> Base: `main` ← Compare: `myeongjin`
> 생성 링크: https://github.com/KernelAcademy-AICamp/ai-camp-6nd-llm-service-project-6th-FitBack-team5/compare/main...myeongjin?expand=1

## 요약
홈 대시보드를 신설해 앱의 디폴트 진입점으로 만들고(회원권 활용도 히어로 + AI 코치 카드 + 3대 기능 스트립), 방문·운동·식단 **기록 캘린더**(주간 인라인 + 월간 상세)와 **MY 코치 화면 셸**, **마이 탭**을 추가합니다. 회원권 통계에는 도움말(?) 모달을 붙였습니다. 내비게이션이 3탭 → **5탭**(홈/회원권/식단/운동/마이)으로 확장됩니다.

## 주요 변경
- **홈 대시보드(신규, `/` 디폴트)** — `src/app/index.tsx`
  - 블록① 히어로: 회원권 활용도(도넛 링·전월 비교·총결제/남은가치/1회당 비용), 솔리드 Primary
  - 블록② AI 코치 카드(기존 coach Edge Function 단발 추천)
  - 블록③ 3대 기능 스트립(회원권/운동/식단 미니카드 딥링크) — `HomeStrip.tsx`
  - **오늘 체크인** 버튼: 기존 회원권 "센터 가기" 플로우(CheckInFlow)를 홈으로 이전
  - 헤더 **MY 코치** 진입 버튼
- **기록 캘린더**
  - 화면 A 주간 인라인 `WeeklyRecord.tsx` (오늘 체크인 아래·AI 코치 위)
  - 화면 B 월간 상세 `MonthCalendar.tsx` (월 이동 + 일~토 그리드 + 요약 + 권장 페이스, 모달)
  - 집계 훅 `useHomeActivity.ts`(주간/스트릭 포함), `useCalendarMonth.ts`(임의 월)
- **MY 코치(UI 셸, 동작 보류)** — `src/features/coach/`
  - `CoachChat.tsx`: 식단 요약 카드(실데이터: kcal·매크로·태그) + 추천질문 + 입력창
  - 현재 AI 응답 미연결("준비 중" 안내). 재개용 `useCoachChat.ts` + `supabase/functions/coach-chat` 보존
- **마이 탭(신규, `/my`)** — `src/app/my.tsx`: 프로필·신체 정보·About·로그아웃
- **회원권 화면** — `membership.tsx`로 분리, 통계에 도움말(?) 모달(`HelpButton.tsx`), 전월 비교(`useMonthCompare.ts`)
- **내비게이션 5탭** — `app-tabs.tsx` / `app-tabs.web.tsx`(lucide 아이콘, main과 머지 완료)

## ⚠️ 구조 변경 (팀 확인 필요)
- 라우트 의미 변경: **`/` = 홈 대시보드**, **`/membership` = 회원권**(기존 `/`였음)
- 탭 3개 → **5개**
- 마이그레이션은 main의 16/17과 충돌 없이 순차(이 브랜치는 ~15까지, main이 16/17 추가)

## 보류 / 후속 작업
- **MY 코치 AI 연결** — `coach-chat` Edge Function 배포(`supabase functions deploy coach-chat`, 시크릿 `ANTHROPIC_API_KEY` 공유) 후 `CoachChat.send()`에서 `useCoachChat().mutate` 재연결
- 멀티턴·대화 메모리, 추천질문 동적화, dietScore 산식 — 보류
- 날씨 기능(별도 페이지 + 체크인 날씨 로깅 → 코칭) — 보류
- 권장 방문 횟수 개인화, 식단 태그 서버 룰화 — 코드에 `TODO[검토]`
- 화면 B·MY코치 모달 → 라우트 푸시 전환(루트 Stack 리팩터 필요) — 보류
- `EXPO_PUBLIC_ANTHROPIC_API_KEY`(홈트·aera) 클라이언트 노출 → 서버 프록시 이관 — 검토

## 테스트
- `npx tsc --noEmit` 통과
- 웹 번들 정상 컴파일(Metro 200)
- `origin/main` 머지 완료(충돌 1건 `app-tabs.web.tsx` = 5탭 + lucide 결합 해결)

## 리뷰 포인트
1. 라우트 의미 변경(`/`=홈, `/membership`=회원권)과 5탭 구조 수용 여부
2. 탭 라벨 "운동"(기존 "홈트")으로 통일
3. MY 코치를 보류 셸 상태로 머지할지(동작은 후속 PR)
