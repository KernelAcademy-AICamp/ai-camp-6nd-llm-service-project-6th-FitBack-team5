/**
 * FitBack Design System tokens — docs/design-system.md 기준.
 * 라이트 전용(웜 오프화이트). 다크 테마는 라이트와 동일하게 매핑해 사실상 단일 테마.
 */

import '@/global.css';

import { Platform, type TextStyle, type ViewStyle } from 'react-native';

// ── 4. 컬러 시스템 (raw palette) ──────────────────────────
export const Palette = {
  // Primary (인디고)
  primary: '#6675FF',
  primaryHover: '#5566F7',
  primaryPressed: '#4957D8',
  primaryLight: '#EEF1FF',

  // Background
  bgBase: '#FAF9F7',
  bgSurface: '#FFFFFF',
  bgMuted: '#F3F4F6',

  // Semantic — UI 상태
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',

  // Semantic — 손익 상태 (게이지·회당 실비용 전용)
  profit: '#00C47A',
  profitLight: '#E6FBF3',
  loss: '#E11D48',
  lossLight: '#FCEEF4',

  // Neutral
  gray900: '#111827',
  gray700: '#374151',
  gray500: '#6B7280',
  gray300: '#D1D5DB',
  gray100: '#F3F4F6',
  gray50: '#F9FAFB',
  white: '#FFFFFF',

  // Line / Border
  lineDefault: 'rgba(0, 0, 0, 0.07)',
  lineStrong: 'rgba(0, 0, 0, 0.15)',
  linePrimary: '#6675FF',
  lineDanger: '#E11D48',
  lineSuccess: '#00C47A',
} as const;

// 기존 ThemedText/ThemedView 호환용 시맨틱 키 (라이트 전용).
const lightTheme = {
  text: Palette.gray900,
  textSecondary: Palette.gray500,
  background: Palette.bgBase,
  backgroundElement: Palette.bgSurface, // 카드/모달 표면
  backgroundSelected: Palette.gray100,
} as const;

export const Colors = {
  light: lightTheme,
  dark: lightTheme, // 라이트 전용: 다크도 라이트로 매핑
} as const;

export type ThemeColor = keyof typeof Colors.light;

// ── 5. 타이포그래피 ───────────────────────────────────────
// Pretendard. 자간 -2.5% = -0.025 * fontSize (RN은 px 단위).
export const FontFamily = {
  regular: 'Pretendard',
  medium: 'PretendardMedium',
  semibold: 'PretendardSemiBold',
  bold: 'PretendardBold',
} as const;

type TypeToken = Pick<
  TextStyle,
  'fontSize' | 'lineHeight' | 'fontFamily' | 'letterSpacing' | 'fontWeight'
>;

export const Typography = {
  display: { fontSize: 32, lineHeight: 40, fontFamily: FontFamily.bold, letterSpacing: -0.8, fontWeight: '700' },
  h1: { fontSize: 24, lineHeight: 30, fontFamily: FontFamily.bold, letterSpacing: -0.6, fontWeight: '700' },
  h2: { fontSize: 20, lineHeight: 25, fontFamily: FontFamily.semibold, letterSpacing: -0.5, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontFamily: FontFamily.regular, letterSpacing: -0.4, fontWeight: '400' },
  bodyMedium: { fontSize: 16, lineHeight: 24, fontFamily: FontFamily.medium, letterSpacing: -0.4, fontWeight: '500' },
  caption: { fontSize: 14, lineHeight: 21, fontFamily: FontFamily.regular, letterSpacing: -0.35, fontWeight: '400' },
  captionBold: { fontSize: 14, lineHeight: 21, fontFamily: FontFamily.semibold, letterSpacing: -0.35, fontWeight: '600' },
  label: { fontSize: 12, lineHeight: 18, fontFamily: FontFamily.medium, letterSpacing: -0.3, fontWeight: '500' },
} as const satisfies Record<string, TypeToken>;

export const Fonts = Platform.select({
  ios: { sans: FontFamily.regular, serif: 'ui-serif', rounded: FontFamily.regular, mono: 'ui-monospace' },
  default: { sans: FontFamily.regular, serif: 'serif', rounded: FontFamily.regular, mono: 'monospace' },
  web: { sans: FontFamily.regular, serif: 'var(--font-serif)', rounded: FontFamily.regular, mono: 'var(--font-mono)' },
});

// ── 6. 스페이싱 (8pt grid) ────────────────────────────────
// 디자인 토큰. 기존 코드 호환을 위해 half/one/two/three/four/five/six 별칭 유지.
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  // legacy aliases (점진 마이그레이션)
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** 전 화면 공통 좌우 여백 */
export const ScreenPadding = 20;

// ── 7. Border Radius ──────────────────────────────────────
export const Radius = {
  small: 8,
  button: 12,
  card: 16,
  modal: 20,
  full: 100,
} as const;

// ── 8. Elevation ──────────────────────────────────────────
// 네이티브 shadow* + web boxShadow 동시 제공.
export const Elevation: Record<'level1' | 'level2', ViewStyle> = {
  level1: Platform.select({
    web: { boxShadow: '0 2px 8px rgba(15,23,42,0.06)' } as ViewStyle,
    default: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
  }) as ViewStyle,
  level2: Platform.select({
    web: { boxShadow: '0 8px 24px rgba(15,23,42,0.08)' } as ViewStyle,
    default: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 24,
      elevation: 8,
    },
  }) as ViewStyle,
};

export const BottomTabInset = Platform.select({ ios: 50, android: 80, web: 80 }) ?? 0;
export const MaxContentWidth = 800;