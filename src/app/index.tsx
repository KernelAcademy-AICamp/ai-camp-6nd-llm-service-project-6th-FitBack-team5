import { router } from 'expo-router';
import { AlarmClock, Bell, Calendar, ChevronRight, Menu, TrendingUp, X } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CountUp } from '@/components/count-up';
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
import { PermissionGate } from '@/features/home/PermissionGate';
import { MembershipMiniList } from '@/features/home/MembershipMiniList';
import { WorkoutStatusCard } from '@/features/home/WorkoutStatusCard';
import { useSchedules } from '@/features/home/useSchedules';
import { MyPanel } from '@/features/auth/MyPanel';
import { CheckInFlow } from '@/features/membership/CheckInFlow';
import { MembershipForm } from '@/features/membership/MembershipForm';
import { useCurrentUser } from '@/stores/auth';
import {
  computeRisk,
  formatNumber,
  summarize,
} from '@/features/membership/dashboard';
import { useCoach } from '@/features/membership/useCoach';
import { daysUntil, useMemberships } from '@/features/membership/useMemberships';
import { summarizePortfolio } from '@/features/membership/portfolio';
import { buildPortfolioItems, todayGain } from '@/features/membership/PortfolioView';
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
  const [showAlarm, setShowAlarm] = useState(false);
  const [showMembershipForm, setShowMembershipForm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

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

  // 목표 기준 회수 지표 (명세 v1.0 활용도 화면 — portfolio). 기간권 weekly_goal 환산 포함.
  const items = buildPortfolioItems(list);
  const psummary = summarizePortfolio(items.map((x) => ({ value: x.value, expired: x.expired })));
  const recovered = psummary.recovered; // 누적 회수(상승)
  const remainingValue = psummary.remaining; // 목표까지 남은
  const totalPaid = items.filter((x) => !x.expired).reduce((s, x) => s + x.m.cost, 0); // 원금
  const utilization = Math.round(psummary.progressPct); // 활용도(목표 75% 기준)
  const effPrice = todayGain(items); // 오늘 체크인으로 버는 금액(회당 가치)

  const name = profile?.display_name || '회원';

  // 만료 D-7 알림(명세 §4) — 임박 회원권을 배너/알림 모달에 노출
  const expiring = list
    .filter((m) => m.status === 'expiring')
    .sort((a, b) => daysUntil(a.endDate) - daysUntil(b.endDate));
  const bannerItem = expiring[0] ? withRisk.find((x) => x.m.id === expiring[0].id) ?? null : null;

  // 오늘 예정된 일정(planned) — 알림에 노출 (#5 알림 연계)
  const today = new Date();
  const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const { data: monthSchedules } = useSchedules(today.getFullYear(), today.getMonth() + 1);
  const todayPlans = (monthSchedules ?? []).filter((s) => s.date === todayYmd && s.status === 'planned');
  const hasAlarm = expiring.length > 0 || todayPlans.length > 0;

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
                onPress={() => setShowAlarm(true)}
                style={({ pressed }) => [styles.headerIcon, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="알림">
                <View>
                  <Icon icon={Bell} size={22} color={hasAlarm ? Palette.gray700 : Palette.gray300} />
                  {hasAlarm ? <View style={styles.alarmDot} /> : null}
                </View>
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

          {/* ── ① 내 운동 상태 카드 (분석 비주얼 + 코치 통합) ── */}
          {list.length > 0 ? (
            <WorkoutStatusCard coach={coach} name={name} onOpenCoach={() => setShowCoach(true)} />
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
                  {effPrice > 0 ? (
                    <View style={styles.checkInBadge}>
                      <Icon icon={TrendingUp} size={12} color={Palette.primary} />
                      <ThemedText type="label" style={styles.checkInText}>
                        오늘 체크인으로 {wonShort(effPrice)} UP
                      </ThemedText>
                    </View>
                  ) : null}
                  <CountUp value={recovered} format={formatNumber} suffix="원" type="display" style={styles.mainAmount} />
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
                    {/* 25/50/75% 단계 마커 (마라톤) */}
                    {[25, 50, 75].map((mk) => (
                      <View key={mk} style={[styles.stageMarker, { left: `${mk}%` }]} />
                    ))}
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
                  회원권 출석
                </ThemedText>
              </Pressable>
            </View>
          ) : !isLoading ? (
            /* 회원권 없을 때 — 빈 상태 */
            <Pressable
              onPress={() => setShowMembershipForm(true)}
              style={[styles.mainCard, Elevation.level1, styles.emptyCard]}>
              <Icon icon={TrendingUp} size={28} color={Palette.primary} />
              <ThemedText type="subtitle" style={{ textAlign: 'center' }}>
                아직 등록된 회원권이 없어요
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                회원권을 등록하면 활용도를 분석하고{'\n'}오늘 얼마를 되찾는지 보여드려요.
              </ThemedText>
              <View style={styles.utilBtn}>
                <ThemedText type="subtitle" style={styles.utilBtnText}>
                  회원권 등록하기
                </ThemedText>
              </View>
            </Pressable>
          ) : null}

          {/* ── ② 회원권 상태 — 개수 헤더 + 부피 줄인 미니 리스트 ── */}
          {list.length > 0 ? (
            <MembershipMiniList
              items={items}
              onSeeAll={() => router.navigate('/membership')}
              onPressItem={() => router.navigate('/membership')}
            />
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

      {/* 알림 모달 — 만료 D-7 (명세 §4) */}
      <Modal
        visible={showAlarm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAlarm(false)}>
        <ThemedView style={styles.modalRoot}>
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            <View style={styles.alarmHeader}>
              <ThemedText type="h2">알림</ThemedText>
              <Pressable onPress={() => setShowAlarm(false)} hitSlop={8} accessibilityRole="button" accessibilityLabel="닫기">
                <Icon icon={X} size={22} color={Palette.gray500} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.alarmBody}>
              {!hasAlarm ? (
                <ThemedText type="caption" themeColor="textSecondary">
                  새로운 알림이 없어요.
                </ThemedText>
              ) : (
                <>
                  {todayPlans.map((s) => (
                    <Card key={s.id} accentColor={Palette.primary}>
                      <View style={styles.alarmItem}>
                        <Icon icon={Calendar} size={16} color={Palette.primary} />
                        <ThemedText type="caption">오늘 예정 · {s.title}</ThemedText>
                      </View>
                    </Card>
                  ))}
                  {expiring.map((m) => (
                    <Card key={m.id} accentColor={Palette.warning}>
                      <View style={styles.alarmItem}>
                        <Icon icon={AlarmClock} size={16} color={Palette.warning} />
                        <ThemedText type="caption">
                          {m.name} · 만료 D-{Math.max(0, daysUntil(m.endDate))}
                        </ThemedText>
                      </View>
                    </Card>
                  ))}
                </>
              )}
            </ScrollView>
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

      {/* 마이 — 전체 페이지 모달 */}
      <Modal
        visible={showMyDrawer}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMyDrawer(false)}>
        <MyPanel onClose={() => setShowMyDrawer(false)} />
      </Modal>

      {/* 회원권 등록 모달 (#4a) */}
      <Modal
        visible={showMembershipForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMembershipForm(false)}>
        <ThemedView style={styles.modalRoot}>
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            <MembershipForm
              onClose={() => setShowMembershipForm(false)}
              onSuccess={() => showToast('등록완료')}
            />
          </SafeAreaView>
        </ThemedView>
      </Modal>

      {/* 진입 권한 안내 (#2, 위치 → 알림, 최초 1회) */}
      {user ? <PermissionGate userId={user.id} /> : null}

      {/* 토스트 */}
      {toast ? (
        <View style={styles.toastWrap} pointerEvents="none">
          <View style={styles.toast}>
            <ThemedText type="captionBold" style={{ color: Palette.white }}>{toast}</ThemedText>
          </View>
        </View>
      ) : null}
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
  utilBarWrap: { flex: 1, position: 'relative', justifyContent: 'center' },
  stageMarker: { position: 'absolute', top: 1, bottom: 1, width: 1, backgroundColor: 'rgba(0,0,0,0.18)' },
  alarmDot: { position: 'absolute', top: -1, right: -1, width: 7, height: 7, borderRadius: 4, backgroundColor: Palette.warning },
  alarmHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: ScreenPadding, paddingVertical: Spacing.md },
  alarmBody: { paddingHorizontal: ScreenPadding, paddingBottom: Spacing.xl, gap: Spacing.sm },
  alarmItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },

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
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  settingLabel: { flex: 1 },
  withdrawBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: Spacing.md },
  toastWrap: { position: 'absolute', left: 0, right: 0, bottom: BottomTabInset + Spacing.xl, alignItems: 'center' },
  toast: {
    backgroundColor: Palette.gray900,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    ...Elevation.level2,
  },
});
