import { StyleSheet, View, ViewStyle } from 'react-native';
import { Palette, Spacing } from '@/constants/theme';

interface LineBarProps {
  style?: ViewStyle;
}

export function LineBar({ style }: LineBarProps) {
  return <View style={[styles.line, style]} />;
}

const styles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Palette.lineDefault,
    marginVertical: Spacing.sm,
  },
});
