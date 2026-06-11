import { Sparkles } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Icon } from '@/components/ui';
import { Palette, Spacing } from '@/constants/theme';
import { useCoach, type CoachInput } from '@/features/membership/useCoach';

/** "이번 주 추천" — AI 코치(Claude)가 데이터를 해석하고 다음 행동을 제안. */
export function CoachCard(input: CoachInput) {
  const { data, isLoading, isError } = useCoach(input);

  // 회원권이 없으면 표시하지 않음.
  if (input.withRisk.length === 0) return null;

  return (
    <Card style={styles.card} accentColor={Palette.primary}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Icon icon={Sparkles} size={16} color={Palette.primary} />
          <ThemedText type="captionBold" style={{ color: Palette.primary }}>
            이번 주 추천 · AI 코치
          </ThemedText>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={Palette.primary} />
          <ThemedText type="caption" themeColor="textSecondary">
            데이터를 분석하고 있어요…
          </ThemedText>
        </View>
      ) : isError ? (
        <ThemedText type="caption" themeColor="textSecondary">
          지금은 추천을 불러올 수 없어요. 잠시 후 다시 시도해 주세요.
        </ThemedText>
      ) : data ? (
        <View style={styles.body}>
          <ThemedText type="h2">{data.headline}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {data.insight}
          </ThemedText>
          <View style={styles.actionRow}>
            <ThemedText type="captionBold" style={{ color: Palette.primary }}>
              → {data.action}
            </ThemedText>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  loading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  body: { gap: Spacing.xs },
  actionRow: {
    marginTop: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: Palette.lineDefault,
  },
});
