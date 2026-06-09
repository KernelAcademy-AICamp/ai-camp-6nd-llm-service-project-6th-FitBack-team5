import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

interface Routine {
  id: string;
  name: string;
  durationMin: number;
  exercises: number;
  level: '입문' | '중급' | '상급';
}

const dummyRoutines: Routine[] = [
  { id: '1', name: '전신 스트레칭', durationMin: 15, exercises: 8, level: '입문' },
  { id: '2', name: '상체 집중 (가슴/어깨)', durationMin: 30, exercises: 10, level: '중급' },
  { id: '3', name: '하체 + 코어', durationMin: 35, exercises: 12, level: '중급' },
  { id: '4', name: 'HIIT 풀바디', durationMin: 25, exercises: 9, level: '상급' },
];

function levelColor(level: Routine['level']) {
  if (level === '입문') return '#22c55e';
  if (level === '중급') return '#3b82f6';
  return '#ef4444';
}

function RoutineCard({ item }: { item: Routine }) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText type="subtitle">{item.name}</ThemedText>
        <View style={[styles.badge, { backgroundColor: levelColor(item.level) }]}>
          <ThemedText type="smallBold" style={styles.badgeText}>
            {item.level}
          </ThemedText>
        </View>
      </View>
      <ThemedText type="small">
        {item.durationMin}분 · 운동 {item.exercises}개
      </ThemedText>
    </ThemedView>
  );
}

export default function WorkoutScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">홈트레이닝</ThemedText>
        <ThemedText type="small">추천 루틴</ThemedText>
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}>
          {dummyRoutines.map((r) => (
            <RoutineCard key={r.id} item={r} />
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
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.two,
  },
  badgeText: { color: '#fff' },
});
