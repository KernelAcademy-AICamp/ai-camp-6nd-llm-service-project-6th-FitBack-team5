/**
 * FitBack Design System tokens — see design.md for full spec.
 *
 * Deferred (별도 작업 필요):
 *  - Pretendard 폰트: expo-font + 폰트 파일 추가 필요. 현재 시스템 폰트 fallback.
 *  - Lucide 아이콘: 라이브러리 설치 + 탭 아이콘 교체 필요.
 */

import '@/global.css';

import { Platform } from 'react-native';

// ============================================================
// Brand palette (light/dark 공통 — design.md §4 Primary, Semantic)
// ============================================================

const Brand = {
  primary: '#6675FF',
  primaryHover: '#5566F7',
  primaryPressed: '#4957D8',
  primaryLight: '#EEF1FF',

  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',

  // 손익 (FitBack 고유) — 손익 게이지, 회당 실비용 표시에만 사용
  surplus: '#00C47A',
  surplusLight: '#E6FBF3',
  deficit: '#E11D48',
  deficitLight: '#FCEEF4',
} as const;

// ============================================================
// Theme colors
// ============================================================

export const Colors = {
  light: {
    // Background
    background: '#FAF9F7',         // BG Base (웜 오프화이트)
    backgroundElement: '#FFFFFF',  // BG Surface (카드/모달)
    backgroundMuted: '#F3F4F6',    // BG Muted (비활성)
    backgroundSelected: '#EEF1FF', // Primary Light

    // Text
    text: '#111827',         // Gray 900
    textBody: '#374151',     // Gray 700
    textSecondary: '#6B7280',// Gray 500
    textDisabled: '#D1D5DB', // Gray 300

    // Lines
    lineDefault: 'rgba(0,0,0,0.07)',
    lineStrong: 'rgba(0,0,0,0.15)',
    linePrimary: Brand.primary,
    lineDanger: Brand.deficit,
    lineSuccess: Brand.surplus,

    // Brand
    ...Brand,
  },
  dark: {
    background: '#0F1115',
    backgroundElement: '#1A1D23',
    backgroundMuted: '#25282E',
    backgroundSelected: '#2B2F4A',

    text: '#F9FAFB',
    textBody: '#E5E7EB',
    textSecondary: '#9CA3AF',
    textDisabled: '#6B7280',

    lineDefault: 'rgba(255,255,255,0.10)',
    lineStrong: 'rgba(255,255,255,0.20)',
    linePrimary: Brand.primary,
    lineDanger: Brand.deficit,
    lineSuccess: Brand.surplus,

    ...Brand,
    primaryLight: '#2B2F4A',
    surplusLight: '#0B2A1F',
    deficitLight: '#2D1019',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// ============================================================
// Typography
// ============================================================

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/** -2.5% 자간을 absolute 값으로 환산 (RN letterSpacing은 px 단위). */
export function letterSpacingFor(fontSize: number) {
  return Math.round(fontSize * -0.025 * 100) / 100;
}

// ============================================================
// Spacing — 8pt grid (design.md §6)
// ============================================================

export const Spacing = {
  // Legacy numeric keys
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,

  // Semantic (design.md §6)
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** 좌우 여백 — 전 화면 공통 (design.md §6) */
export const ScreenPaddingX = 20;

// ============================================================
// Border Radius (design.md §7, §9)
// ============================================================

export const Radius = {
  small: 8,
  button: 12,
  card: 20,   // §9 카드 spec 우선 (메인 카드)
  modal: 20,
  full: 100,
} as const;

// ============================================================
// Elevation (design.md §8)
// ============================================================

export const Elevation = {
  level1: Platform.select({
    web: { boxShadow: '0 2px 8px rgba(15,23,42,0.06)' } as object,
    default: {
      shadowColor: '#0F172A',
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
  }),
  level2: Platform.select({
    web: { boxShadow: '0 8px 24px rgba(15,23,42,0.08)' } as object,
    default: {
      shadowColor: '#0F172A',
      shadowOpacity: 0.08,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
  }),
} as const;

// ============================================================
// Layout
// ============================================================

export const BottomTabInset = Platform.select({ ios: 50, android: 80, web: 80 }) ?? 0;
export const MaxContentWidth = 800;
