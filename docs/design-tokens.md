# FitBack Design Tokens

소스: `src/constants/theme.ts` ↔ `src/tokens/colors.css` / `src/tokens/spacing.css`

> **Figma Variables 미정의**: Figma 파일(aJIudmwrEER8OoccfLmHiY)에 Variables가 설정되어 있지 않아 `theme.ts`를 단일 정규 소스로 사용합니다.
> Figma Variables가 추가되면 이 파일과 CSS 토큰을 업데이트하세요.

---

## 구조

```
Primitive (raw 값)
  └─ Semantic (Primitive 참조)
        └─ 컴포넌트 코드 (Semantic 사용)
```

CSS에서 Figma 변수명의 `/` 구분자는 `-`로 변환합니다.  
예) `brand/primary` → `--color-brand-primary`

---

## 1. 컬러 토큰 (`src/tokens/colors.css`)

### Primitive → Semantic 매핑

| theme.ts (Palette.*) | CSS Primitive | CSS Semantic | 값 |
|---|---|---|---|
| `primary` | `--color-p-indigo-400` | `--color-brand-primary` | `#6675FF` |
| `primaryHover` | `--color-p-indigo-500` | `--color-brand-primary-hover` | `#5566F7` |
| `primaryPressed` | `--color-p-indigo-600` | `--color-brand-primary-pressed` | `#4957D8` |
| `primaryLight` | `--color-p-indigo-50` | `--color-brand-primary-light` | `#EEF1FF` |
| `secondary` | `--color-p-blue-400` | `--color-brand-secondary` | `#6892FF` |
| `bgBase` | `--color-p-surface-page` | `--color-bg-base` | `#F5F5F9` |
| `bgSurface` | `--color-p-white` | `--color-bg-surface` | `#FFFFFF` |
| `bgMuted` | `--color-p-surface-muted` | `--color-bg-muted` | `#F5F5F8` |
| `success` | `--color-p-green-500` | `--color-state-success` | `#22C55E` |
| `successLight` | `--color-p-green-50` | `--color-state-success-light` | `#DCFCE7` |
| `warning` | `--color-p-amber-400` | `--color-state-warning` | `#F59E0B` |
| `error` | `--color-p-red-500` | `--color-state-error` | `#EF4444` |
| `errorLight` | `--color-p-red-50` | `--color-state-error-light` | `#FEE2E2` |
| `profit` | `--color-p-indigo-400` | `--color-roi-profit` | `#6675FF` |
| `profitLight` | `--color-p-indigo-50` | `--color-roi-profit-light` | `#EEF1FF` |
| `loss` | `--color-p-gray-800` | `--color-roi-loss` | `#222C43` |
| `lossLight` | `--color-p-gray-50` | `--color-roi-loss-light` | `#F2F2F7` |
| `gray900` | `--color-p-gray-900` | `--color-neutral-900` | `#111827` |
| `gray800` | `--color-p-gray-800` | `--color-neutral-800` | `#222C43` |
| `gray700` | `--color-p-gray-700` | `--color-neutral-700` | `#313E5B` |
| `gray500` | `--color-p-gray-500` | `--color-neutral-500` | `#6B7280` |
| `gray400` | `--color-p-gray-400` | `--color-neutral-400` | `#999999` |
| `gray300` | `--color-p-gray-300` | `--color-neutral-300` | `#D1D5DB` |
| `gray200` | `--color-p-gray-200` | `--color-neutral-200` | `#E7E9F1` |
| `gray100` | `--color-p-gray-100` | `--color-neutral-100` | `#F5F5F9` |
| `gray50` | `--color-p-gray-50` | `--color-neutral-50` | `#F2F2F7` |
| `white` | `--color-p-white` | `--color-neutral-0` | `#FFFFFF` |
| `tintOrange` | `--color-p-orange-400` | `--color-diet-tint-orange` | `#F5A623` |
| `tintYellow` | `--color-p-yellow-400` | `--color-diet-tint-yellow` | `#F2B807` |
| `tintPurple` | `--color-p-purple-500` | `--color-diet-tint-purple` | `#7C6CF0` |
| `tintIndigo` | `--color-p-indigo-300` | `--color-diet-tint-indigo` | `#8E9BFF` |
| `lineDefault` | `--color-p-black-07` | `--color-line-default` | `rgba(0,0,0,0.07)` |
| `lineStrong` | `--color-p-black-15` | `--color-line-strong` | `rgba(0,0,0,0.15)` |
| `linePrimary` | `--color-p-indigo-400` | `--color-line-primary` | `#6675FF` |
| `borderStrong` | `--color-p-gray-500` | `--color-border-strong` | `#6B7280` |

---

## 2. Spacing / Radius / Typography (`src/tokens/spacing.css`)

### Spacing

| theme.ts (Spacing.*) | CSS Primitive | CSS Semantic | 값 |
|---|---|---|---|
| `xs` | `--space-p-4` | `--spacing-xs` | `4px` |
| `sm` | `--space-p-8` | `--spacing-sm` | `8px` |
| `ms` | `--space-p-10` | `--spacing-ms` | `10px` |
| `md` | `--space-p-16` | `--spacing-md` | `16px` |
| `lg` | `--space-p-24` | `--spacing-lg` | `24px` |
| `xl` | `--space-p-32` | `--spacing-xl` | `32px` |
| `xxl` | `--space-p-48` | `--spacing-xxl` | `48px` |
| `ScreenPadding` | `--space-p-20` | `--spacing-screen-pad` | `20px` |

### Border Radius

| theme.ts (Radius.*) | CSS Primitive | CSS Semantic | 값 |
|---|---|---|---|
| `small` | `--radius-p-8` | `--radius-small` | `8px` |
| `button` | `--radius-p-12` | `--radius-button` | `12px` |
| `card` | `--radius-p-20` | `--radius-card` | `20px` |
| `modal` | `--radius-p-20` | `--radius-modal` | `20px` |
| `full` | `--radius-p-100` | `--radius-full` | `100px` |

### Typography Font Size

| theme.ts (Typography.*) | CSS Semantic (font-size) | CSS Semantic (line-height) | px |
|---|---|---|---|
| `display` | `--font-size-display` | `--line-height-display` | 32 / 40 |
| `display2` | `--font-size-display2` | `--line-height-display2` | 28 / 36 |
| `h1` | `--font-size-h1` | `--line-height-h1` | 24 / 30 |
| `h2` | `--font-size-h2` | `--line-height-h2` | 20 / 25 |
| `subtitle` | `--font-size-subtitle` | `--line-height-subtitle` | 18 / 23 |
| `body` | `--font-size-body` | `--line-height-body` | 16 / 24 · Medium (16_M) |
| `bodySemibold` | `--font-size-body` | `--line-height-body` | 16 / 24 · SemiBold (16_SB) |
| `caption` | `--font-size-caption` | `--line-height-caption` | 14 / 21 |
| `label` | `--font-size-label` | `--line-height-label` | 12 / 18 |

---

## 3. 사용 규칙

- **RN 코드** → `theme.ts` (`Palette.*` / `Spacing.*` / `Radius.*`)
- **Web CSS / NativeWind** → `src/tokens/*.css` CSS custom properties
- raw hex / raw 숫자 하드코딩 금지 (CLAUDE.md 절대 규칙)
- `--color-roi-profit` / `--color-roi-loss` 는 ROI 손익 화면에만 사용

## 4. Figma Variables 추가 시 업데이트 방법

1. Figma에서 Variables 패널에 컬러/스페이싱 추가
2. `get_variable_defs` 재실행 → 변수 목록 확인
3. Primitive → Semantic 참조 구조 그대로 이 파일 및 CSS 파일 업데이트
4. `theme.ts`와 동기화
