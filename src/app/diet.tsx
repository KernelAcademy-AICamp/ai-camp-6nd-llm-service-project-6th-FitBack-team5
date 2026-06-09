import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

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
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText type="small">{item.time}</ThemedText>
        <ThemedText type="smallBold">{item.kcal} kcal</ThemedText>
      </View>
      <ThemedText type="subtitle">{item.name}</ThemedText>
    </ThemedView>
  );
}

export default function DietScreen() {
  const totalKcal = dummyMeals.reduce((acc, m) => acc + m.kcal, 0);
  const remaining = dailyGoal - totalKcal;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">오늘의 식단</ThemedText>

        <ThemedView type="backgroundElement" style={styles.summary}>
          <View style={styles.summaryRow}>
            <ThemedText type="small">섭취</ThemedText>
            <ThemedText type="subtitle">{totalKcal} kcal</ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <ThemedText type="small">목표 {dailyGoal} kcal</ThemedText>
            <ThemedText type="small">
              남은 {remaining > 0 ? remaining : 0} kcal
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.three,
  },
  summary: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.two,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  list: {
    gap: Spacing.three,
    paddingBottom: Spacing.three,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
