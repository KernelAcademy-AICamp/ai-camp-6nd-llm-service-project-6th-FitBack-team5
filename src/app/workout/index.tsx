import { useRouter } from 'expo-router';
import { ChevronRight, Zap } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  BottomTabInset,
  Elevation,
  MaxContentWidth,
  Palette,
  Radius,
  ScreenPadding,
  Spacing,
} from '@/constants/theme';
import { DayWorkoutList } from '@/features/workout/DayWorkoutList';
import { SelectedDayCard } from '@/features/workout/SelectedDayCard';
import { WeekStatusCard } from '@/features/workout/WeekStatusCard';
import { WorkoutDateStrip } from '@/features/workout/WorkoutDateStrip';

function todayIso(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function WorkoutScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string>(() => todayIso());

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="title">홈트레이닝</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              지금 바로, 움직여볼까요?
            </ThemedText>
          </View>

          {/* 가로 날짜 스트립 — 오늘 ±7일. 선택 시 아래 카드 갱신. */}
          <WorkoutDateStrip selected={selectedDate} onSelect={setSelectedDate} />

          {/* 선택한 일자의 운동 데이터 (운동시간 / 칼로리 / 완료여부 + AI 피드백). */}
          <SelectedDayCard date={selectedDate} />

          {/* 이번 주 월~일 운동 현황 — 선택일이 속한 주의 데이터. 전부완료(보라) · 일부완료(주황). */}
          <WeekStatusCard selectedDate={selectedDate} />

          {/* 선택일에 한 모든 운동 컴팩트 목록 — 클릭 액션 없음. */}
          <DayWorkoutList date={selectedDate} />

          {/* AI 추천 루틴 받기 입구 카드 — 탭하면 챗봇이 6가지 항목을 차례로 물어봄. */}
          <Pressable
            onPress={() => router.push('/workout/coach')}
            style={({ pressed }) => [
              styles.entryCard,
              {
                backgroundColor: Palette.primaryLight,
                borderColor: Palette.lineDefault,
                opacity: pressed ? 0.85 : 1,
              },
              Elevation.level1,
            ]}>
            <View style={[styles.entryIconWrap, { backgroundColor: Palette.primary }]}>
              <Zap color={Palette.white} size={20} fill={Palette.white} />
            </View>
            <View style={styles.entryTexts}>
              <ThemedText type="subtitle" style={{ color: Palette.primary }}>
                AI 추천 홈트 루틴
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                내 상황에 맞는 루틴을 추천해드려요
              </ThemedText>
            </View>
            <ChevronRight color={Palette.primary} size={20} />
          </Pressable>
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
  scrollContent: {
    paddingHorizontal: ScreenPadding,
    paddingTop: Spacing.lg,
    paddingBottom: BottomTabInset + Spacing.lg,
    gap: Spacing.md,
  },
  header: { gap: Spacing.xs },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  entryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryTexts: {
    flex: 1,
    gap: Spacing.xs,
  },
});
