import { useRouter } from 'expo-router';
import { ChevronRight, Dumbbell, Sliders, Wrench } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GnbBar } from '@/components/gnb-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MyPanel } from '@/features/auth/MyPanel';
import {
  BottomTabInset,
  Elevation,
  MaxContentWidth,
  Palette,
  Radius,
  ScreenPadding,
  Spacing,
} from '@/constants/theme';
import { routeToCustom } from '@/features/workout/route-to-custom';
import { SelectedDayCard } from '@/features/workout/SelectedDayCard';

function todayIso(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function WorkoutScreen() {
  const router = useRouter();
  const [selectedDate] = useState<string>(() => todayIso());
  const [showMyPanel, setShowMyPanel] = useState(false);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <GnbBar onMenu={() => setShowMyPanel(true)} showCalendar={false} />

          {/* 운동 시작 진입 카드 3종 — 일일달력 바로 밑. AI 추천이 맨 위(강조).
              각 카드는 coach 모드 선택을 건너뛰고 곧장 해당 흐름으로 진입. */}
          <View style={styles.modeCardCol}>
            {/* AI 추천 — 기존 entryCard 스타일(primaryLight 배경 + 강조), 아이콘만 Dumbbell. */}
            <Pressable
              onPress={() => router.push('/workout/coach?mode=preset')}
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
                <Dumbbell color={Palette.white} size={20} />
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

            <Pressable
              onPress={() => void routeToCustom(router)}
              style={({ pressed }) => [
                styles.modeCard,
                { borderColor: Palette.lineDefault, opacity: pressed ? 0.85 : 1 },
              ]}>
              <View style={[styles.modeIcon, { backgroundColor: Palette.bgMuted }]}>
                <Sliders color={Palette.gray500} size={24} />
              </View>
              <View style={styles.modeText}>
                <ThemedText type="subtitle">오늘 운동 커스텀</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  운동을 직접 선택해서 만들어요
                </ThemedText>
              </View>
              <ChevronRight color={Palette.gray500} size={20} />
            </Pressable>

            {/* ── dev: 영상 시범 테스트용. 제거 시 이 Pressable 블록만 삭제. ── */}
            <Pressable
              onPress={() => router.push('/workout/coach?mode=dev')}
              style={({ pressed }) => [
                styles.modeCard,
                { borderColor: Palette.lineDefault, opacity: pressed ? 0.85 : 1 },
              ]}>
              <View style={[styles.modeIcon, { backgroundColor: Palette.bgMuted }]}>
                <Wrench color={Palette.gray500} size={24} />
              </View>
              <View style={styles.modeText}>
                <ThemedText type="subtitle">개발용 (3운동 고정)</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  코브라 → 플랭크 → 스쿼트, 영상 테스트 전용
                </ThemedText>
              </View>
              <ChevronRight color={Palette.gray500} size={20} />
            </Pressable>
          </View>

          {/* 오늘의 홈트 요약 — 총 소모 칼로리/총 운동시간. 더보기는 주차/일일/피드백 상세 페이지로. */}
          <SelectedDayCard
            date={selectedDate}
            onPressMore={() =>
              router.push({ pathname: '/workout/summary', params: { date: selectedDate } })
            }
          />
        </ScrollView>
      </SafeAreaView>
      <Modal
        visible={showMyPanel}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMyPanel(false)}>
        <MyPanel onClose={() => setShowMyPanel(false)} />
      </Modal>
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
    backgroundColor: Palette.bgBase,
  },
  scrollContent: {
    paddingHorizontal: ScreenPadding,
    paddingTop: Spacing.lg,
    paddingBottom: BottomTabInset + Spacing.lg,
    gap: Spacing.md,
  },
  header: { gap: Spacing.xs },
  modeCardCol: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
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
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: Palette.bgSurface,
  },
  modeIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeText: {
    flex: 1,
    gap: Spacing.xs,
  },
});
