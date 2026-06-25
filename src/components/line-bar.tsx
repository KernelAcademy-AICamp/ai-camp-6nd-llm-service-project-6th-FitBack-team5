import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Palette, Spacing } from '@/constants/theme';

export function LineBar({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.lineBar, style]} />;
}

const styles = StyleSheet.create({
  lineBar: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: Palette.lineDefault,
    marginVertical: Spacing.card,
  },
});
