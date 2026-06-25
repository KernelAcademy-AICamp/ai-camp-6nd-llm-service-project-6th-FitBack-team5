import { Zap } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Palette, Radius, Spacing } from '@/constants/theme';

export function CoachTipCard({ children }: { children: ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Zap size={16} color={Palette.primary} strokeWidth={2.5} />
        <ThemedText type="subtitle" style={{ color: Palette.primary }}>
          핏쌤의 한 마디
        </ThemedText>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: Spacing.md,
    backgroundColor: Palette.gray200,
    borderRadius: Radius.card,
    borderWidth: 0.5,
    borderColor: Palette.lineDefault,
    padding: Spacing.card,
    gap: Spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
