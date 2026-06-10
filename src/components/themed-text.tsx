import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor, letterSpacingFor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'display'
    | 'title'
    | 'subtitle'
    | 'small'
    | 'smallBold'
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'], fontFamily: Fonts.sans },
        type === 'default' && styles.default,
        type === 'display' && styles.display,
        type === 'title' && styles.title,
        type === 'subtitle' && styles.subtitle,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

// design.md §5 타입 스케일
const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: letterSpacingFor(16),
  },
  display: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: letterSpacingFor(32),
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: letterSpacingFor(24),
  },
  subtitle: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '600',
    letterSpacing: letterSpacingFor(20),
  },
  small: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '400',
    letterSpacing: letterSpacingFor(14),
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    letterSpacing: letterSpacingFor(14),
  },
  link: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },
  linkPrimary: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: '#6675FF',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: '700', default: '500' }),
    fontSize: 12,
    lineHeight: 18,
  },
});
