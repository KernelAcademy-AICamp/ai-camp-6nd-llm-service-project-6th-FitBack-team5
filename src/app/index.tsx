import { router } from 'expo-router';
import { AlarmClock, Bell, Calendar, ChevronRight, LogOut, Menu, Ruler, Sparkles, TrendingUp, Weight } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, Icon, ProgressBar } from '@/components/ui';
import {
  BottomTabInset,
  Elevation,
  MaxContentWidth,
  Palette,
  Radius,
  ScreenPadding,
  Spacing,
} from '@/constants/theme';
import { useProfile } from '@/features/auth/useProfile';
import { CoachChat } from '@/features/coach/CoachChat';
import { MonthCalendar } from '@/features/home/MonthCalendar';
import { CheckInFlow } from '@/features/membership/CheckInFlow';
import { MembershipStatsCard } from '@/features/membership/MembershipStatsCard';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';
import {
  computeRisk,
  formatNumber,
  sortByRisk,
  summarize,
  type RiskInfo,
} from '@/features/membership/dashboard';
import { useCoach } from '@/features/membership/useCoach';
import { useMemberships, type Membership } from '@/features/membership/useMemberships';
import { useMonthlyStats } from '@/features/membership/useMonthlyStats';
import { useVisitPattern } from '@/features/membership/useVisitPattern';

/** 만원 단위 축약: 230000 → "23만원", 4500 → "4,500원" */
function wonShort(n: number): string {
  if (n >= 10000) return `${Math.round(n / 10000)}만원`;
  return `${formatNumber(n)}원`;
}

function CharacterImage() {
  return (
    <Image
      source={require('../../assets/images/character.png')}
      style={styles.characterImage}
      resizeMode="contain"
    />
  );
}

export default function HomeScreen() {
  const { data: profile } = useProfile();
  const { data: memberships, isLoading } = useMemberships();
  const { data: stats } = useMonthlyStats();
  const { data: visitPattern } = useVisitPattern();
  const user = useCurrentUser();
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showCoach, setShowCoach] = useState(false);
  const [showMyDrawer, setShowMyDrawer] = useState(false);
  const { width: windowWidth } = useWindowDimensions();
  const [activeCard, setActiveCard] = useState(0);
  const [carouselWidth, setCarouselWidth] = useState(
    Math.min(windowWidth, MaxContentWidth) - ScreenPadding * 2,
  );
  const carouselRef = useRef<ScrollView>(null);

  const list = memberships ?? [];
  const visitsOf = (id: string) => stats?.byMembership[id] ?? 0;
  const withRisk = list.map((m) => ({
    m,
    risk: computeRisk(m, visitsOf(m.id)),
    visits: visitsOf(m.id),
  }));
  const summary = summarize(
    withRisk.map((x) => ({ risk: x.risk, monthlyVisits: x.visits, name: x.m.name })),
  );

  // 횟수제 합산 지표
  const sessioned = withRisk.filter((x) => x.risk.hasSessions);
  const totalUsed = sessioned.reduce((s, x) => s + x.risk.usedSessions, 0);
  const totalTotal = sessioned.reduce((s, x) => s + (x.risk.totalSessions ?? 0), 0);
  const sessionedCost = sessioned.reduce((s, x) => s + x.m.cost, 0);
  const utilization = totalTotal > 0 ? Math.round((totalUsed / totalTotal) * 100) : null;

  const recovered = withRisk.reduce((s, x) => s + x.risk.valueUsed, 0);
  const totalPaid = list.reduce((s, x) => s + x.cost, 0);
  const remainingValue = withRisk.reduce((s, x) => s + x.risk.valueAtRisk, 0);
  const effPrice = totalUsed > 0 ? Math.round(sessionedCost / totalUsed) : null;

  const name = profile?.display_name || '회원';

  // 알림 배너: 일정에 예약된 운동이 당일인 경우에만 표시 (미구현 — 항상 null)
  const bannerItem = null as { m: Membership; risk: RiskInfo; visits: number } | null;

  // AI 코치 훅 (말풍선용)
  const coach = useCoach({ withRisk, summary, monthly: stats, pattern: visitPattern });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

          {/* ── 헤더 ── */}
          <View style={styles.header}>
            <Pressable
              onPress={() => setShowMyDrawer(true)}
              style={({ pressed }) => [styles.headerLeft, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="메뉴 열기">
              <Icon icon={Menu} size={22} color={Palette.gray700} />
              <ThemedText type="h1">마이</ThemedText>
            </Pressable>
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => setShowCalendar(true)}
                style={({ pressed }) => [styles.headerIcon, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="달력 보기">
                <Icon icon={Calendar} size={22} color={Palette.gray700} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.headerIcon, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="알림">
                <Icon icon={Bell} size={22} color={Palette.gray700} />
              </Pressable>
            </View>
          </View>

          {/* ── 알림 배너 — 만료 임박 회원권 ── */}
          {bannerItem ? (
            <Pressable
              onPress={() => router.navigate('/membership')}
              style={({ pressed }) => [styles.banner, pressed && styles.pressed]}>
              <Icon icon={AlarmClock} size={16} color={Palette.white} />
              <ThemedText type="captionBold" style={styles.bannerText} numberOfLines={1}>
                {bannerItem.risk.hasSessions && (bannerItem.risk.remainingSessions ?? 99) <= 5
                  ? `${bannerItem.m.name} · ${formatNumber(bannerItem.risk.remainingSessions ?? 0)}회 남음`
                  : `D-${bannerItem.risk.remainingDays} ${bannerItem.m.name} 만료`}
              </ThemedText>
              <View style={styles.bannerChevron}>
                <Icon icon={ChevronRight} size={16} color={Palette.white} />
              </View>
            </Pressable>
          ) : null}

          {/* ── AI 코치 말풍선 ── */}
          {list.length > 0 ? (
            <Pressable
              onPress={() => setShowCoach(true)}
              style={({ pressed }) => [styles.bubble, pressed && styles.pressed]}
              accessibilityRole="button">
              {coach.isLoading ? (
                <View style={styles.bubbleLoading}>
                  <ActivityIndicator size="small" color={Palette.white} />
                  <ThemedText type="caption" style={{ color: Palette.white }}>
                    코치가 분석 중이에요…
                  </ThemedText>
                </View>
              ) : coach.data ? (
                <ThemedText type="caption" style={{ color: Palette.white }} numberOfLines={3}>
                  {coach.data.headline}
                  {coach.data.insight ? `\n${coach.data.insight}` : ''}
                </ThemedText>
              ) : (
                <ThemedText type="caption" style={{ color: Palette.white }}>
                  {name}님, 오늘도 파이팅!
                </ThemedText>
              )}
              {/* 말풍선 꼬리 (하단 오른쪽) */}
              <View style={styles.bubbleTail} />
            </Pressable>
          ) : null}

          {/* ── 메인 ROI 카드 ── */}
          {list.length > 0 ? (
            <View style={[styles.mainCard, Elevation.level1]}>
              {/* 캐릭터: 카드 밖으로 튀어나옴 */}
              <View style={styles.characterWrap} pointerEvents="none">
                <CharacterImage />
              </View>
              {/* 상단: 헤드라인 */}
              <View style={styles.cardTop}>
                <View style={styles.cardTopLeft}>
                  {effPrice != null ? (
                    <View style={styles.checkInBadge}>
                      <Icon icon={TrendingUp} size={12} color={Palette.primary} />
                      <ThemedText type="label" style={styles.checkInText}>
                        오늘 체크인으로 {wonShort(effPrice)} UP
                      </ThemedText>
                    </View>
                  ) : null}
                  <ThemedText type="display" style={styles.mainAmount}>
                    {formatNumber(recovered)}원
                  </ThemedText>
                </View>
              </View>

              {/* 활용도 진행바 */}
              {utilization != null ? (
                <View style={styles.utilRow}>
                  <ThemedText type="captionBold" style={{ color: Palette.primary }}>
                    활용도
                  </ThemedText>
                  <View style={styles.utilBarWrap}>
                    <ProgressBar ratio={utilization / 100} color={Palette.primary} height={10} label={`활용도 ${utilization}%`} />
                  </View>
                  <ThemedText type="captionBold" themeColor="text">
                    {utilization}%
                  </ThemedText>
                </View>
              ) : null}

              {/* 구분선 */}
              <View style={styles.divider} />

              {/* 3개 통계 */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <ThemedText type="label" themeColor="textSecondary">
                    총 회수
                  </ThemedText>
                  <ThemedText type="captionBold">{wonShort(recovered)}</ThemedText>
                </View>
                <View style={[styles.statItem, styles.statItemCenter]}>
                  <ThemedText type="label" themeColor="textSecondary">
                    남은 금액
                  </ThemedText>
                  <ThemedText type="captionBold">{wonShort(remainingValue)}</ThemedText>
                </View>
                <View style={[styles.statItem, styles.statItemRight]}>
                  <ThemedText type="label" themeColor="textSecondary">
                    원금
                  </ThemedText>
                  <ThemedText type="captionBold">{wonShort(totalPaid)}</ThemedText>
                </View>
              </View>

              {/* 회원권 활용하기 버튼 */}
              <Pressable
                onPress={() => setShowCheckIn(true)}
                style={({ pressed }) => [styles.utilBtn, pressed && styles.pressed]}
                accessibilityRole="button">
                <ThemedText type="subtitle" style={styles.utilBtnText}>
                  회원권 활용하기
                </ThemedText>
              </Pressable>
            </View>
          ) : !isLoading ? (
            /* 회원권 없을 때 */
            <Pressable
              onPress={() => router.navigate('/membership')}
              style={[styles.mainCard, Elevation.level1, styles.emptyCard]}>
              <ThemedText type="body" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                회원권을 등록하면 활용도를 분석해드려요.
              </ThemedText>
              <View style={styles.utilBtn}>
                <ThemedText type="subtitle" style={styles.utilBtnText}>
                  회원권 등록하기
                </ThemedText>
              </View>
            </Pressable>
          ) : null}

          {/* ── 등록된 회원권 캐러셀 ── */}
          {list.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <ThemedText type="captionBold">등록된 회원권</ThemedText>
                <Pressable
                  onPress={() => router.navigate('/membership')}
                  style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}
                  accessibilityRole="button">
                  <ThemedText type="label" style={{ color: Palette.gray500 }}>
                    전체보기
                  </ThemedText>
                  <Icon icon={ChevronRight} size={14} color={Palette.gray500} />
                </Pressable>
              </View>
              <ScrollView
                ref={carouselRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onLayout={(e) => setCarouselWidth(e.nativeEvent.layout.width)}
                onScroll={(e) => {
                  if (carouselWidth > 0) {
                    setActiveCard(Math.round(e.nativeEvent.contentOffset.x / carouselWidth));
                  }
                }}>
                {sortByRisk(withRisk, (x) => x.risk).map(({ m, risk, visits }) => (
                  <View key={m.id} style={{ width: carouselWidth }}>
                    <MembershipStatsCard
                      m={m}
                      risk={risk}
                      monthlyVisits={visits}
                      onPress={() => router.navigate('/membership')}
                    />
                  </View>
                ))}
              </ScrollView>
              {withRisk.length > 1 ? (
                <View style={styles.dots}>
                  {withRisk.map((_, i) => (
                    <View key={i} style={[styles.dot, i === activeCard && styles.dotActive]} />
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      {/* 체크인 모달 */}
      <Modal
        visible={showCheckIn}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCheckIn(false)}>
        <ThemedView style={styles.modalRoot}>
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            <CheckInFlow memberships={list} onClose={() => setShowCheckIn(false)} />
          </SafeAreaView>
        </ThemedView>
      </Modal>

      {/* 달력 모달 */}
      <Modal
        visible={showCalendar}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCalendar(false)}>
        <ThemedView style={styles.modalRoot}>
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            <MonthCalendar onClose={() => setShowCalendar(false)} />
          </SafeAreaView>
        </ThemedView>
      </Modal>

      {/* MY 코치 모달 */}
      <Modal
        visible={showCoach}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCoach(false)}>
        <ThemedView style={styles.modalRoot}>
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            <CoachChat onClose={() => setShowCoach(false)} />
          </SafeAreaView>
        </ThemedView>
      </Modal>

      {/* 마이 드로어 */}
      <Modal
        visible={showMyDrawer}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMyDrawer(false)}>
        <Pressable style={styles.drawerOverlay} onPress={() => setShowMyDrawer(false)}>
          <Pressable style={styles.drawerPanel} onPress={() => {}}>
            <SafeAreaView edges={['top', 'bottom']} style={styles.drawerSafe}>
              <ScrollView contentContainerStyle={styles.drawerBody} showsVerticalScrollIndicator={false}>
                <ThemedText type="h1" style={styles.drawerTitle}>마이</ThemedText>

                {/* 프로필 */}
                <Card>
                  <ThemedText type="h2">{name}</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {user?.email ?? ''}
                  </ThemedText>
                </Card>

                {/* 신체 정보 */}
                <Card>
                  <ThemedText type="captionBold">내 정보</ThemedText>
                  <View style={styles.infoRows}>
                    <View style={styles.infoRow}>
                      <View style={styles.infoRowLeft}>
                        <Icon icon={Ruler} size={16} color={Palette.gray500} />
                        <ThemedText type="caption" themeColor="textSecondary">키</ThemedText>
                      </View>
                      <ThemedText type="captionBold">
                        {profile?.height != null ? `${profile.height} cm` : '-'}
                      </ThemedText>
                    </View>
                    <View style={styles.infoRow}>
                      <View style={styles.infoRowLeft}>
                        <Icon icon={Weight} size={16} color={Palette.gray500} />
                        <ThemedText type="caption" themeColor="textSecondary">몸무게</ThemedText>
                      </View>
                      <ThemedText type="captionBold">
                        {profile?.weight != null ? `${profile.weight} kg` : '-'}
                      </ThemedText>
                    </View>
                  </View>
                </Card>

                {/* About */}
                <Card accentColor={Palette.primary}>
                  <View style={styles.aboutHead}>
                    <Icon icon={Sparkles} size={16} color={Palette.primary} />
                    <ThemedText type="captionBold" style={{ color: Palette.primary }}>
                      FitBack은 이렇게 일해요
                    </ThemedText>
                  </View>
                  <ThemedText type="caption" themeColor="textSecondary">
                    평가하지 않아요. 데이터를 보여주고, 다음 행동을 제안해요.
                  </ThemedText>
                </Card>

                {/* 로그아웃 */}
                <Pressable
                  onPress={() => supabase.auth.signOut()}
                  style={({ pressed }) => [styles.logoutBtn, pressed && styles.pressed]}
                  accessibilityRole="button">
                  <Icon icon={LogOut} size={16} color={Palette.gray500} />
                  <ThemedText type="caption" themeColor="textSecondary">로그아웃</ThemedText>
                </Pressable>
              </ScrollView>
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.bgBase },
  safeArea: {
    flex: 1,
    paddingHorizontal: ScreenPadding,
    paddingTop: Spacing.md,
    paddingBottom: BottomTabInset + Spacing.md,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  body: { gap: Spacing.md, paddingBottom: Spacing.lg },
  pressed: { opacity: 0.75 },

  // 헤더
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerActions: { flexDirection: 'row', gap: Spacing.xs },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 알림 배너
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.gray900,
    borderRadius: Radius.button,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  bannerText: { flex: 1, color: Palette.white },
  bannerChevron: { marginLeft: 'auto' },

  // 말풍선
  bubble: {
    backgroundColor: Palette.primary,
    borderRadius: Radius.card,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
  },
  bubbleLoading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  bubbleTail: {
    position: 'absolute',
    bottom: -9,
    right: 28,
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Palette.primary,
  },

  // 메인 ROI 카드
  mainCard: {
    backgroundColor: Palette.bgSurface,
    borderRadius: Radius.card,
    padding: Spacing.md,
    gap: Spacing.lg,
    borderWidth: 0.5,
    borderColor: Palette.lineDefault,
    overflow: 'visible',
  },
  characterWrap: {
    position: 'absolute',
    top: -20,
    right: Spacing.md,
    zIndex: 2,
  },
  emptyCard: { alignItems: 'center', gap: Spacing.md },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  cardTopLeft: { flex: 1, gap: Spacing.xs },
  checkInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: Palette.primaryLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  checkInText: { color: Palette.primary },
  mainAmount: { color: Palette.gray900 },

  characterImage: {
    width: 120,
    height: 120,
  },

  // 활용도 바
  utilRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  utilBarWrap: { flex: 1 },

  // 구분선
  divider: { height: 0.5, backgroundColor: Palette.lineDefault },

  // 통계 3열
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statItem: {
    flex: 1,
    gap: 4,
    backgroundColor: Palette.bgMuted,
    borderRadius: Radius.card,
    padding: Spacing.sm,
  },
  statItemCenter: {},
  statItemRight: {},

  // 회원권 활용하기 버튼 (아웃라인)
  utilBtn: {
    height: 44,
    borderRadius: Radius.button,
    borderWidth: 1.5,
    borderColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  utilBtnText: { color: Palette.primary },

  // 등록된 회원권 섹션
  section: { gap: Spacing.sm, marginTop: Spacing.sm },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingTop: Spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Palette.gray300,
  },
  dotActive: {
    width: 18,
    backgroundColor: Palette.primary,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  modalRoot: { flex: 1, backgroundColor: Palette.bgBase },
  modalSafe: { flex: 1 },

  // 마이 드로어
  drawerOverlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  drawerPanel: {
    width: '75%',
    maxWidth: 320,
    backgroundColor: Palette.bgBase,
  },
  drawerSafe: { flex: 1 },
  drawerBody: {
    gap: Spacing.md,
    padding: ScreenPadding,
    paddingBottom: Spacing.xl,
  },
  drawerTitle: { marginBottom: Spacing.xs },
  infoRows: { gap: Spacing.sm, marginTop: Spacing.sm },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoRowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  aboutHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: 4 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Palette.lineStrong,
  },
});
