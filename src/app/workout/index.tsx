import { useRouter } from 'expo-router';
import { ArrowRight, Wrench } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoachTipCard } from '@/components/coach-tip-card';
import { sheetPresentation } from '@/components/modal-presentation';
import { GnbBar } from '@/components/gnb-bar';
import { MonthCalendar } from '@/features/home/MonthCalendar';

const GNB_HEIGHT = 68; // 52 헤더 + 16 하단 패딩
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CoachChat } from '@/features/coach/CoachChat';
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
  const [showCoach, setShowCoach] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <GnbBar onMenu={() => setShowMyPanel(true)} onCalendar={() => setShowCalendar(true)} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>

          {/* 오늘 운동 요약 카드 */}
          <View style={[styles.topCard, Elevation.level1]}>
            <Image
              source={require('../../../assets/images/character.png')}
              style={styles.mascot}
              resizeMode="contain"
            />
            <SelectedDayCard
              date={selectedDate}
              onPressMore={() =>
                router.push({ pathname: '/workout/summary', params: { date: selectedDate } })
              }
            />
          </View>

          {/* 핏쌤의 한 마디 */}
          <CoachTipCard>
            <ThemedText type="body" style={{ color: Palette.gray700 }}>
              이번 주는 2번만 더 가면 페이스 회복 돼요. 오늘 가볍게 시작해볼까요?
            </ThemedText>
          </CoachTipCard>

          {/* 섹션 타이틀 */}
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            오늘 운동, 갈까 말까?
          </ThemedText>

          {/* 센터/홈트/개발용 — 16px 간격 */}
          <View style={styles.bannerGroup}>

          {/* 센터 가기 — primary 컬러 */}
          <Pressable
            onPress={() => void routeToCustom(router)}
            style={({ pressed }) => [
              styles.bannerCard,
              { backgroundColor: Palette.primary, opacity: pressed ? 0.9 : 1 },
            ]}>
            <View style={styles.bannerLeft}>
              <View style={styles.bannerTitleRow}>
                <ThemedText type="h2" style={styles.bannerTitle}>
                  센터 가기
                </ThemedText>
                <View style={styles.arrowCircle}>
                  <ArrowRight color={Palette.white} size={16} />
                </View>
              </View>
              <ThemedText type="body" style={styles.bannerSubtitle}>
                오늘 운동 루틴 만들기
              </ThemedText>
            </View>
            <Image
              source={require('../../../assets/images/dumbbell.png')}
              style={styles.dumbbellImg}
              resizeMode="contain"
            />
          </Pressable>

          {/* 홈트하기 — secondary(blue) 컬러 */}
          <Pressable
            onPress={() => router.push('/workout/coach?mode=preset')}
            style={({ pressed }) => [
              styles.bannerCard,
              { backgroundColor: Palette.secondary, opacity: pressed ? 0.9 : 1 },
            ]}>
            <View style={styles.bannerLeft}>
              <View style={styles.bannerTitleRow}>
                <ThemedText type="h2" style={styles.bannerTitle}>
                  홈트하기
                </ThemedText>
                <View style={styles.arrowCircle}>
                  <ArrowRight color={Palette.white} size={16} />
                </View>
              </View>
              <ThemedText type="body" style={styles.bannerSubtitle}>
                핏쌤 추천 루틴 시작하기
              </ThemedText>
            </View>
            <Image
              source={require('../../../assets/images/Home_dumbbell.png')}
              style={styles.dumbbellImg}
              resizeMode="contain"
            />
          </Pressable>

          {/* 개발용 (3운동 고정) — 흰색 버튼 */}
          <Pressable
            onPress={() => router.push('/workout/coach?mode=dev')}
            style={({ pressed }) => [styles.devButton, { opacity: pressed ? 0.85 : 1 }]}>
            <Wrench color={Palette.gray500} size={16} />
            <ThemedText type="body" themeColor="textSecondary">
              개발용 (3운동 고정)
            </ThemedText>
          </Pressable>

          </View>

        </ScrollView>
      </SafeAreaView>

      {/* FAB — AI 코치 */}
      <Pressable
        onPress={() => setShowCoach(true)}
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
        accessibilityLabel="AI 코치 열기">
        <Image
          source={require('../../../assets/images/Chat_floting.png')}
          style={{ width: 62, height: 62 }}
          resizeMode="contain"
        />
      </Pressable>

      <Modal
        visible={showCalendar}
        animationType="slide"
        presentationStyle={sheetPresentation}
        onRequestClose={() => setShowCalendar(false)}>
        <ThemedView style={{ flex: 1 }}>
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
            <MonthCalendar onClose={() => setShowCalendar(false)} />
          </SafeAreaView>
        </ThemedView>
      </Modal>

      <Modal
        visible={showMyPanel}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMyPanel(false)}>
        <MyPanel onClose={() => setShowMyPanel(false)} />
      </Modal>

      <Modal
        visible={showCoach}
        animationType="slide"
        presentationStyle={sheetPresentation}
        onRequestClose={() => setShowCoach(false)}>
        <CoachChat onClose={() => setShowCoach(false)} />
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
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: ScreenPadding,
    paddingTop: GNB_HEIGHT,
    // 네이티브: NativeTabs 자체 inset 처리 → BottomTabInset 불필요. 웹: fixed 탭바 보정.
    paddingBottom: (Platform.OS === 'web' ? BottomTabInset : 0) + Spacing.lg,
  },
  // 오늘 운동 요약 카드
  topCard: {
    backgroundColor: Palette.bgSurface,
    borderRadius: Radius.card,
    padding: Spacing.md,
    overflow: 'hidden',
  },
  mascot: {
    width: 88,
    height: 88,
    alignSelf: 'center',
  },
  // 섹션 타이틀
  sectionTitle: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.xs + Spacing.sm,
  },
  // 배너 카드
  bannerCard: {
    height: 110,
    borderRadius: Radius.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.sm,
    overflow: 'hidden',
  },
  bannerLeft: {
    flex: 1,
    gap: Spacing.xs,
  },
  bannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bannerTitle: {
    color: Palette.white,
  },
  arrowCircle: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerSubtitle: {
    color: 'rgba(224,227,255,0.9)',
  },
  dumbbellImg: {
    width: 90,
    height: 90,
  },
  bannerGroup: {
    gap: Spacing.xs + Spacing.sm,
  },
  // 개발용 버튼
  devButton: {
    backgroundColor: Palette.bgSurface,
    borderRadius: Radius.button,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.lineDefault,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  fab: {
    position: 'absolute',
    right: ScreenPadding,
    bottom: BottomTabInset + Spacing.md,
    width: 62,
    height: 62,
  },
});
