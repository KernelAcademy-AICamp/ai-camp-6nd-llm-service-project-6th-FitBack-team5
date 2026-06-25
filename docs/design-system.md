# FitBack Design System

> AI 기반 운동 피드백 서비스 — 헬스장 멤버십 ROI 트래킹  
> Primary target: 여성 (20-35세) · Secondary target: 남성

> **범위** — 디자인 규칙 정본. 코드 컨벤션·프레임워크·파일 구조는 `CLAUDE.md`, UX writing은 `ux-writing.md`로 분리한다.
> **작성 원칙** — ①토큰엔 값과 함께 '언제 쓰는지'를 적는다 ②규칙은 가능한 Don't로 적는다(§3) ③핵심만 간결하게.
> **정본 출처** — Figma: `fitback` 파일 > `FitBack Design System ▸ Spec (정본)` 프레임.

**토큰 파일**:
- `src/constants/theme.ts` — RN 코드에서 직접 import (`Palette.*` / `Spacing.*` / `Radius.*`)
- `src/tokens/colors.css` — Web CSS 커스텀 프로퍼티 (컬러)
- `src/tokens/spacing.css` — Web CSS 커스텀 프로퍼티 (스페이싱·Radius·타이포)
- `docs/design-tokens.md` — Primitive→Semantic 매핑 테이블

---

## 1. 서비스 정의

FitBack은 사용자가 결제한 운동 회원권을 효과적으로 활용하고, 지속 가능한 운동 습관을 형성할 수 있도록 돕는 AI 기반 운동 피드백 서비스다. 기존 피트니스 서비스가 강한 의지와 경쟁을 강조했다면, FitBack은 운동 데이터를 분석하고 행동 변화를 유도하는 코치 역할에 집중한다.

---

## 2. 디자인 원칙

**Encourage, Not Pressure** — 사용자를 압박하기보다 자연스럽게 행동을 유도한다. "₩5,500씩 녹고 있어요"는 비난이 아닌 사실 전달이다.

**Growth Over Performance** — 운동 성과보다 꾸준한 성장 경험을 제공한다. 숫자는 경쟁 도구가 아닌 성장의 기준점이다.

**Friendly Intelligence** — AI 기술을 어렵게 보이게 하지 않고 친근한 코치처럼 전달한다. 명확함 우선, 장식은 최소.

---

## 3. 사용 금지

- 그라데이션 배경 사용 금지 (손익 게이지 제외)
- 2단계 이상 카드 중첩 금지
- 텍스트에 4가지 이상 컬러 혼용 금지
- 이모티콘 사용 금지 — 아이콘 라이브러리(Lucide) 사용
- Primary 버튼 화면당 2개 이상 금지
- Primary는 시선 유도가 필요한 핵심 요소에만 사용
- Semantic 상태 컬러(Success/Warning/Error)도 Primary처럼 남용 금지 — 실제 성공·경고·오류 상태에만 쓰고, 장식·일반 강조에는 쓰지 않는다

---

## 4. 브랜드 퍼스널리티

Reliable(데이터 기반·신뢰) · Encouraging(압박 대신 응원) · Insightful(의미 있는 인사이트) · Friendly(평가하는 트레이너가 아닌 AI 코치).

---

## 5. 컬러 시스템

### Primary & Secondary

신뢰감 있는 블루를 기반으로 AI 피드백 서비스의 혁신성과 차별성을 표현하는 인디고 계열.

| 이름 | 값 | CSS 변수 | 용도 |
|------|-----|----------|------|
| Primary | `#6675FF` | `--color-brand-primary` | CTA 버튼, 주요 수치, 액티브 상태 |
| Primary Hover | `#5566F7` | `--color-brand-primary-hover` | 버튼 hover |
| Primary Pressed | `#4957D8` | `--color-brand-primary-pressed` | 버튼 pressed |
| Primary Light | `#EEF1FF` | `--color-brand-primary-light` | 배지 배경, 카드 강조 배경, 인풋 포커스 링 |
| Secondary | `#6892FF` | `--color-brand-secondary` | 보조 강조, 그라데이션 블렌딩 |

### Background

| 이름 | 값 | CSS 변수 | 용도 |
|------|-----|----------|------|
| BG Base | `#F2F2F7` | `--color-bg-base` | 앱 전체 배경 (웜 오프화이트) |
| BG Surface | `#FFFFFF` | `--color-bg-surface` | 카드, 모달, 바텀시트 |
| BG Muted | `#F3F4F6` | `--color-bg-muted` | 비활성 영역 |

### Semantic — UI 상태

| 이름 | 값 | CSS 변수 | 용도 |
|------|-----|----------|------|
| Success | `#22C55E` | `--color-state-success` | 운동 완료·목표 달성·스트릭 유지 |
| Warning | `#F59E0B` | `--color-state-warning` | 회원권 만료 임박, 목표 미달 |
| Error | `#EF4444` | `--color-state-error` | 입력·네트워크 오류 |
| Success Light | `#DCFCE7` | `--color-state-success-light` | 성공 상태 카드 배경 |
| Error Light | `#FEE2E2` | `--color-state-error-light` | 오류 상태 카드 배경 |

### Semantic — 손익 상태

이익(흑자)은 Primary로, 손실(적자)은 **Gray 900(다크 네이비)** 으로 표현한다.  
손실에 빨강을 쓰지 않는 이유: "Encourage, Not Pressure" 원칙 — 압박이 아닌 사실 전달.  
빨강(`Error`)은 시스템 오류·입력 실패에만 사용한다.

| 이름 | 값 | CSS 변수 | 용도 |
|------|-----|----------|------|
| roi/profit | `#6675FF` | `--color-roi-profit` | 이익 상태 (Primary와 동일) |
| roi/profit-light | `#EEF1FF` | `--color-roi-profit-light` | 이익 배지·배경 |
| roi/loss | `#222C43` | `--color-roi-loss` | 손실 상태 (Gray 900과 동일 — 중립 전달) |
| roi/loss-light | `#F2F2F7` | `--color-roi-loss-light` | 손실 배지·배경 |

### Neutral

| 이름 | 값 | CSS 변수 | 용도 |
|------|-----|----------|------|
| Gray 900 | `#222C43` | `--color-neutral-900` | 주요 텍스트, 본문 |
| Gray 700 | `#374151` | `--color-neutral-700` | (하위 호환용) |
| Gray 500 | `#6B7280` | `--color-neutral-500` | 보조 설명, 라벨 |
| Gray 400 | `#999999` | `--color-neutral-400` | 플레이스홀더, 약한 보조 텍스트 |
| Gray 300 | `#D1D5DB` | `--color-neutral-300` | 비활성 텍스트, 아이콘 |
| Gray 100 | `#F3F4F6` | `--color-neutral-100` | 배경, Secondary 버튼 |
| Gray 50 | `#F2F2F7` | `--color-neutral-50` | 구분 배경 |

### Line / Border

| 이름 | 값 | CSS 변수 | 용도 |
|------|-----|----------|------|
| Border Strong | `#6B7280` | `--color-border-strong` | 아이콘 stroke, 강조 라인 |
| Line Default | `rgba(0, 0, 0, 0.07)` | `--color-line-default` | 카드 테두리, 일반 구분선 |
| Line Strong | `rgba(0, 0, 0, 0.15)` | `--color-line-strong` | 강조 구분선 |
| Line Primary | `#6675FF` | `--color-line-primary` | 선택된 탭 인디케이터, 포커스 테두리 |

---

## 6. 타이포그래피

### 폰트 패밀리

**Pretendard** — UI 전반 단일 적용

### 기본 설정

| 항목 | 값 |
|------|----|
| Letter Spacing | -2.5% |
| Heading 행간 | 125% |
| Body 행간 | 150% |

### 타입 스케일

| 이름 | 크기 | 굵기 | 행간 | CSS 변수 | 용도 |
|------|------|------|------|----------|------|
| Display | 32px | Bold | 125% | `--font-size-display` / `--line-height-display` | 메인 수치 — 회당 실비용, 달성률 |
| Display 2 | 28px | Bold | 128% | `--font-size-display2` / `--line-height-display2` | 대형 강조 수치 |
| Heading 1 | 24px | Bold | 125% | `--font-size-h1` / `--line-height-h1` | 페이지 타이틀 |
| Heading 2 | 20px | Semibold | 125% | `--font-size-h2` / `--line-height-h2` | 섹션 타이틀, 카드 타이틀 |
| Subtitle | 18px | Semibold | 125% | `--font-size-subtitle` / `--line-height-subtitle` | 서브타이틀, 버튼 |
| Body | 16px | Medium | 150% | `--font-size-body` / `--line-height-body` | 본문 |
| Caption | 14px | Medium | 150% | `--font-size-caption` / `--line-height-caption` | 보조 설명 |
| Label | 12px | Medium | 150% | `--font-size-label` / `--line-height-label` | 배지, 태그, 메타 정보 |

> 자간 -2.5%는 전체 공통 적용. 별도 예외 없음.

---

## 7. 스페이싱

8pt Grid System 기반.

| 토큰 | 값 | CSS 변수 | 용도 |
|------|----|----------|------|
| XS | 4px | `--spacing-xs` | 아이콘-텍스트 간격, 인라인 요소 |
| SM | 8px | `--spacing-sm` | 컴포넌트 내부 간격 |
| MD | 16px | `--spacing-md` | 카드 패딩, 리스트 아이템 간격 |
| LG | 24px | `--spacing-lg` | 섹션 간 간격 |
| XL | 32px | `--spacing-xl` | 페이지 상단 여백 |
| XXL | 48px | `--spacing-xxl` | 주요 섹션 구분 |

**좌우 여백** — 20px (`--spacing-screen-pad`, 전 화면 공통)

---

## 8. Border Radius

| 이름 | 값 | CSS 변수 | 용도 |
|------|----|----------|------|
| Small | 8px | `--radius-small` | 배지, 태그, 인풋 |
| Button | 12px | `--radius-button` | 버튼 |
| Card | 20px | `--radius-card` | 메인 카드 |
| Modal | 20px | `--radius-modal` | 모달, 바텀시트 |
| Full | 100px | `--radius-full` | 칩, 필 버튼 |

---

## 9. Elevation

그림자는 레이어 계층을 표현할 때만 사용한다. 장식 목적으로 사용하지 않는다.

| 레벨 | 값 | 용도 |
|------|----|------|
| Level 1 · Card | `0 2px 12px rgba(17,24,39,0.04)` | 카드 — 회원권·기록·추천 카드 |
| Level 2 · Tab Bar | `0 2px 12px rgba(34,44,67,0.08)` | 바텀 탭바 |
| Sticky | `0 -2px 12px rgba(17,24,39,0.08)` | 스티키 바·시트 상단 경계 (위 방향) |

---

## 10. 컴포넌트 가이드

### 버튼

| 타입 | 배경 | 테두리 | 텍스트 | 용도 |
|------|------|--------|--------|------|
| Primary | `--color-brand-primary` | — | `--color-neutral-0` | 핵심 CTA (운동 시작, 저장) |
| Outline | `transparent` | `1px solid var(--color-brand-primary)` | `--color-brand-primary` | 주요 보조 액션 (체크인, 출석) |
| Secondary | `--color-neutral-100` | — | `--color-neutral-900` | 보조 액션 |
| Ghost | `transparent` | — | `--color-brand-primary` | 텍스트 버튼, 취소 |
| Danger | `transparent` | — | `--color-state-error` | 손실 경고 관련 액션 (Ghost 스타일) |

- 높이: 44px (Outline/Secondary/Ghost), 52px (Primary)
- 폰트: Pretendard 18px Semibold (Subtitle)
- Primary 버튼은 화면당 1개 원칙

### 카드

모든 정보의 기본 단위 — 운동 기록·AI 피드백·회원권 활용도 등은 카드로 제공.

- 배경: `--color-bg-surface`
- 테두리: `0.5px solid var(--color-line-default)`
- 반경: `--radius-card` (20px)
- 패딩: `--spacing-md` (16px)
- 그림자: Level 1 (선택)

### 인풋

- 배경: `--color-bg-muted`
- 포커스 테두리: `1.5px solid var(--color-line-primary)`
- 포커스 배경: `--color-brand-primary-light`
- 높이: 52px

### Progress

운동 달성률·회원권 활용률·목표 진행률 표현용.

- 기본: `--color-brand-primary`
- 손익 게이지: `--color-state-error` → `--color-neutral-300` → `--color-brand-primary` (적자 → 중립 → 흑자)

### 바텀 네비게이션

- 탭: 홈 · 식단 · 홈트
- 활성 아이콘/라벨: `--color-brand-primary`
- 비활성: `--color-neutral-300`
- 배경: `--color-bg-surface`, 상단 구분선 `0.5px var(--color-line-default)`
- 그림자: Level 2 · Tab Bar

### 아이콘

- 라이브러리: Lucide (outline 통일)
- 기본 크기: 24px, 스트로크 1.5px
- stroke 색상은 `--color-border-strong` 또는 컨텍스트 색상

### 매크로 / 영양소 표기 (식단)

운동 맞춤 식단의 매크로(단백질·탄수화물·지방)는 다음 규칙을 따른다.

- **동적 강조** — 매크로를 나열할 때 그날 운동에 따라 **핵심 영양소 1개만** 강조한다. 강조는 은은하게: 라벨 색(Primary) + 바 아래 작은 기능 캡션 1줄. 나머지는 중립 표기.
  - 근력 / 하체·상체 → 단백질 (근육 회복)
  - 유산소 / 고강도 → 탄수화물 (에너지)
  - 휴식일 → 전반 균형 (강조 없음)
- **색만으로 강조 금지** — 강조 매크로는 색 + 텍스트 단서(기능 캡션)를 함께 준다. (§14 접근성)
- **목표값 노출** — 진행은 `0 / 110g`처럼 분모(목표)를 항상 보여준다. `0%` 단독 표기 금지.
- **데이터 정합성 (단일 소스)** — 매크로 목표는 하나의 소스(가이드 target)에서 산출하고, 칼로리 목표는 그 매크로 합으로 역산한다(탄·단 4kcal/g, 지 9kcal/g). 매크로 ↔ 칼로리 ↔ 코칭 문구의 수치는 어긋나면 안 된다.
- **정보 위계** — 식단·대시보드 화면 최상단은 '총 섭취 칼로리'가 아니라 '운동 목표 대비 달성률'을 둔다.

---

## 11. 모션

| 항목 | 값 |
|------|----|
| 기본 duration | 200ms |
| 이징 | ease-out |
| 수치 count-up | 500ms |
| 카드 등장 | fade + translateY(8px → 0), 150ms |
| 탭 전환 | 즉시 (빠른 반응성 우선) |

---

## 12. 타깃별 고려사항

- **여성 주타겟 (20-35세)** — 둥근 모서리·부드러운 형태, 여백 충분(정보 과밀 지양), 손실 메시지도 동기부여 톤.
- **남성 세컨드타겟** — 통계 탭은 정보 밀도 높여도 수용. 별도 테마 불필요(동일 컬러), 그래프·데이터 중심 뷰.

---

## 13. Voice & Tone

> **UX writing·Voice & Tone 정본은 [ux-writing.md](./ux-writing.md) 로 분리되었습니다.**
> 앱 카피, AI 코치 응답, 알림·버튼·에러 문구의 모든 기준(Voice 핵심 원칙 / Tone 가이드 /
> 관점별 표현 / FitBack만의 말투 / 식단 코칭 카피 / Writing Rules / 한 줄 원칙)은 그 문서를 따른다.

핵심만 옮기면:

> 한 줄 원칙 — 사용자를 평가하지 않는다. 데이터를 보여준다. 다음 행동을 제안한다. 그리고 가끔은 회원권 걱정을 대신 해준다.

- **Encouraging** 압박보다 동기부여 · **Data-Driven** 데이터 기반 · **Friendly** 친근하지만 가볍지 않게 · **Action-Oriented** 다음 행동에 집중
- 죄책감·공포감 유발 금지, 손실은 사실로만 + 항상 해결책(행동)과 함께, 응원·본전 프레이밍.

상세 예시(❌/⭕ 표)와 적용 메모는 → [ux-writing.md](./ux-writing.md)

---

## 14. Accessibility

- 텍스트 대비율 WCAG AA 준수
- 터치 영역 최소 44×44px
- 색상만으로 상태 전달 금지 — 텍스트 단서 병행
- 아이콘과 텍스트 항상 병행 제공
