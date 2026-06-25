import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { FontFamily, Palette, Radius } from '@/constants/theme';

interface ChipProps {
  label: string;
  style?: ViewStyle;
}

export function Chip({ label, style }: ChipProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Palette.gray100,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    letterSpacing: -0.4,
    color: Palette.gray500,
  },
});
