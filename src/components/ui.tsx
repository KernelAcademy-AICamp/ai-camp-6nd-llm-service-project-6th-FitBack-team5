/**
 * FitBack 공용 UI 컴포넌트 — docs/design-system.md §9 기준.
 * Button / Card / Icon / ProgressBar / Chip / Input.
 */
import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Elevation, Palette, Radius, Spacing } from '@/constants/theme';

// ── 아이콘 (Lucide, outline 통일 · 24px · stroke 1.5) ──────
export function Icon({
  icon: IconCmp,
  size = 24,
  color = Palette.gray700,
  strokeWidth = 1.5,
}: {
  icon: LucideIcon;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return <IconCmp size={size} color={color} strokeWidth={strokeWidth} />;
}

// ── 버튼 ──────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BTN_BG: Record<ButtonVariant, string> = {
  primary: Palette.primary,
  secondary: Palette.gray100,
  ghost: 'transparent',
  danger: Palette.loss,
};
const BTN_FG: Record<ButtonVariant, string> = {
  primary: Palette.white,
  secondary: Palette.gray900,
  ghost: Palette.primary,
  danger: Palette.white,
};
const BTN_PRESSED: Record<ButtonVariant, string> = {
  primary: Palette.primaryPressed,
  secondary: Palette.gray300,
  ghost: Palette.primaryLight,
  danger: '#C01840',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: LucideIcon;
  style?: StyleProp<ViewStyle>;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.btn,
        variant === 'primary' ? styles.btnPrimary : styles.btnSecondary,
        { backgroundColor: pressed && !off ? BTN_PRESSED[variant] : BTN_BG[variant] },
        variant === 'ghost' && styles.btnGhost,
        off && styles.btnDisabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}>
      {loading ? (
        <ActivityIndicator color={BTN_FG[variant]} />
      ) : (
        <View style={styles.btnInner}>
          {icon ? <Icon icon={icon} size={20} color={BTN_FG[variant]} /> : null}
          <ThemedText type="captionBold" style={{ color: BTN_FG[variant], fontSize: 16 }}>
            {label}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

// ── 카드 ──────────────────────────────────────────────────
export function Card({
  children,
  onPress,
  style,
  elevated,
  accentColor,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
  /** 좌측 강조 보더 색 (손익 상태 등) */
  accentColor?: string;
}) {
  const cardStyle: StyleProp<ViewStyle> = [
    styles.card,
    elevated && Elevation.level1,
    accentColor ? { borderLeftWidth: 4, borderLeftColor: accentColor } : null,
    style,
  ];
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [cardStyle, pressed && styles.cardPressed]}>
        {children}
      </Pressable>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}

// ── 칩 / 배지 (필 형태) ───────────────────────────────────
export function Chip({
  label,
  color = Palette.gray700,
  bg = Palette.gray100,
  icon,
}: {
  label: string;
  color?: string;
  bg?: string;
  icon?: LucideIcon;
}) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      {icon ? <Icon icon={icon} size={14} color={color} /> : null}
      <ThemedText type="label" style={{ color }}>
        {label}
      </ThemedText>
    </View>
  );
}

// ── Input ────────────────────────────────────────────────
export function Input({
  style,
  textStyle,
  ...props
}: TextInputProps & { style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle> }) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.inputWrapper,
        focused && styles.inputWrapperFocused,
        style,
      ]}>
      <TextInput
        style={[styles.inputText, textStyle]}
        placeholderTextColor={Palette.gray500}
        onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
        {...props}
      />
    </View>
  );
}

// ── Progress (트랙 위 채움) ───────────────────────────────
export function ProgressBar({
  ratio,
  color = Palette.primary,
  trackColor = Palette.gray100,
  height = 8,
  label,
}: {
  ratio: number; // 0~1
  color?: string;
  trackColor?: string;
  height?: number;
  label?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      accessibilityLabel={label}>
      <View style={[styles.track, { height, borderRadius: height, backgroundColor: trackColor }]}>
        <View style={{ height, borderRadius: height, width: `${pct}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  btnPrimary: { height: 52 },
  btnSecondary: { height: 44 },
  btnGhost: { paddingHorizontal: Spacing.sm },
  btnDisabled: { opacity: 0.4 },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },

  card: {
    backgroundColor: Palette.bgSurface,
    borderRadius: Radius.modal, // §9 카드 반경 20
    borderWidth: 0.5,
    borderColor: Palette.lineDefault,
    padding: Spacing.card,
  },
  cardPressed: { opacity: 0.85 },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },

  track: { width: '100%', overflow: 'hidden' },

  inputWrapper: {
    width: '100%',
    height: 48,
    backgroundColor: Palette.bgSurface,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Palette.gray300,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  inputWrapperFocused: {
    borderColor: Palette.primary,
  },
  inputText: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'PretendardMedium',
    letterSpacing: -0.4,
    color: Palette.gray900,
    padding: 0,
  },
});
