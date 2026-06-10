import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  BottomTabInset,
  Elevation,
  MaxContentWidth,
  Radius,
  ScreenPaddingX,
  Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface Meal {
  id: string;
  time: string;
  name: string;
  kcal: number;
}

const dummyMeals: Meal[] = [
  { id: '1', time: '08:10', name: '시리얼 + 우유 + 바나나', kcal: 380 },
  { id: '2', time: '12:30', name: '닭가슴살 샐러드', kcal: 420 },
  { id: '3', time: '15:00', name: '아메리카노 + 견과류', kcal: 180 },
  { id: '4', time: '19:00', name: '현미밥 + 고등어구이 + 나물', kcal: 620 },
];

const dailyGoal = 2000;

function MealCard({ item }: { item: Meal }) {
  const theme = useTheme();
  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, { borderColor: theme.lineDefault }, Elevation.level1]}>
      <View style={styles.cardHeader}>
        <ThemedText type="small" themeColor="textSecondary">
          {item.time}
        </ThemedText>
        <ThemedText type="smallBold" themeColor="primary">
          {item.kcal} kcal
        </ThemedText>
      </View>
      <ThemedText type="subtitle">{item.name}</ThemedText>
    </ThemedView>
  );
}

export default function DietScreen() {
  const theme = useTheme();
  const totalKcal = dummyMeals.reduce((acc, m) => acc + m.kcal, 0);
  const remaining = Math.max(dailyGoal - totalKcal, 0);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">오늘의 식단</ThemedText>

        <ThemedView
          type="backgroundElement"
          style={[styles.summary, { borderColor: theme.lineDefault }, Elevation.level1]}>
          <View style={styles.summaryRow}>
            <ThemedText type="small" themeColor="textSecondary">
              섭취
            </ThemedText>
            <ThemedText type="display" themeColor="primary">
              {totalKcal}
              <ThemedText type="subtitle" themeColor="primary">
                {' '}
                kcal
              </ThemedText>
            </ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <ThemedText type="small" themeColor="textSecondary">
              목표 {dailyGoal} kcal
            </ThemedText>
            <ThemedText type="smallBold" themeColor="textBody">
              남은 {remaining} kcal
            </ThemedText>
          </View>
        </ThemedView>

        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}>
          {dummyMeals.map((m) => (
            <MealCard key={m.id} item={m} />
          ))}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: ScreenPaddingX,
    paddingTop: Spacing.lg,
    paddingBottom: BottomTabInset + Spacing.md,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.md,
  },
  summary: {
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  list: {
    gap: Spacing.md,
    paddingBottom: Spacing.md,
  },
  card: {
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
