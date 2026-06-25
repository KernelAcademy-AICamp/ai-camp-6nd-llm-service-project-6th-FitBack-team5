import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { IconArrowChevron } from './icons';
import { ThemedText } from './themed-text';
import { Elevation, FontFamily, Palette, Radius, Spacing } from '@/constants/theme';

interface RecordCardProps {
  label: string;
  value: string;
  onPress: () => void;
  children?: ReactNode;
}

export function RecordCard({ label, value, onPress, children }: RecordCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, Elevation.level1, pressed && styles.pressed]}>
      <View style={styles.head}>
        <ThemedText style={styles.label}>{label}</ThemedText>
        <IconArrowChevron size={16} color={Palette.gray300} />
      </View>
      <ThemedText style={styles.value}>{value}</ThemedText>
      {children}
    </Pressable>
  );
}

RecordCard.Pill = function Pill({ text }: { text: string }) {
  return (
    <View style={styles.pill}>
      <ThemedText style={styles.pillText}>{text}</ThemedText>
    </View>
  );
};

RecordCard.Badge = function Badge({ text }: { text: string }) {
  return (
    <View style={styles.badge}>
      <ThemedText style={styles.badgeText}>{text}</ThemedText>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '48%',
    height: 165,
    flexGrow: 1,
    backgroundColor: Palette.bgSurface,
    borderRadius: Radius.card,
    padding: Spacing.card,
    gap: Spacing.xs,
    borderWidth: 0.5,
    borderColor: Palette.lineDefault,
    minHeight: 140,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.75 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 18,
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    letterSpacing: -0.45,
    color: Palette.gray500,
  },
  value: {
    color: Palette.gray900,
    fontSize: 20,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  // Figma: card/secondary #F5F5F9, radius 99, SemiBold 16px
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: Palette.gray50,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginTop: 'auto' as never,
  },
  pillText: {
    fontSize: 16,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    letterSpacing: -0.4,
    color: Palette.gray500,
  },
  badge: {
    backgroundColor: Palette.primaryLight,
    borderRadius: 10,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto' as never,
  },
  badgeText: {
    color: Palette.primary,
    fontSize: 16,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    textAlign: 'center',
  },
});
