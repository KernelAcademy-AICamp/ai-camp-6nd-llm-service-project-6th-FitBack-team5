import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  BottomTabInset,
  MaxContentWidth,
  Palette,
  Radius,
  ScreenPadding,
  Spacing,
} from '@/constants/theme';
import { CenterDayCard, CenterDayFeedback, CenterWeekStatusCard } from '@/features/membership/CenterRecords';
import { DayWorkoutList } from '@/features/workout/DayWorkoutList';
import { SelectedDayFeedback } from '@/features/workout/SelectedDayCard';
import { WeekStatusCard } from '@/features/workout/WeekStatusCard';
import { WorkoutDateStrip } from '@/features/workout/WorkoutDateStrip';
function todayIso(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function WorkoutSummaryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const initial = typeof params.date === 'string' && params.date ? params.date : todayIso();
  const [selectedDate, setSelectedDate] = useState<string>(initial);
  const [tab, setTab] = useState<'center' | 'home'>('center');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}>
            <ChevronLeft color={Palette.gray900} size={24} />
          </Pressable>
          <ThemedText type="subtitle">홈트 상세</ThemedText>
          <View style={styles.backBtn} />
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <WorkoutDateStrip selected={selectedDate} onSelect={setSelectedDate} />

          <View style={styles.tabs}>
            <Pressable
              onPress={() => setTab('center')}
              style={[styles.tab, tab === 'center' && styles.tabActive]}>
              <ThemedText
                type="smallBold"
                style={{ color: tab === 'center' ? Palette.white : Palette.gray500 }}>
                센터
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setTab('home')}
              style={[styles.tab, tab === 'home' && styles.tabActive]}>
              <ThemedText
                type="smallBold"
                style={{ color: tab === 'home' ? Palette.white : Palette.gray500 }}>
                홈트
              </ThemedText>
            </Pressable>
          </View>

          {tab === 'home' ? (
            <>
              <WeekStatusCard selectedDate={selectedDate} />
              <DayWorkoutList date={selectedDate} />
              <SelectedDayFeedback date={selectedDate} />
            </>
          ) : (
            <>
              <CenterWeekStatusCard selectedDate={selectedDate} />
              <CenterDayCard date={selectedDate} />
              <CenterDayFeedback date={selectedDate} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ScreenPadding,
    paddingVertical: Spacing.sm,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: ScreenPadding,
    paddingTop: Spacing.sm,
    paddingBottom: BottomTabInset + Spacing.lg,
    gap: Spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Palette.bgMuted,
    borderRadius: Radius.full,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: Palette.primary,
  },
});
