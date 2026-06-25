import { router } from 'expo-router';
import {
  AlarmClock, Bell, Calendar, ChevronRight,
  Menu, MoreHorizontal, TrendingUp, X,
} from 'lucide-react-native';
import { useState } from 'react';
import { Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CountUp } from '@/components/count-up';
import { sheetPresentation } from '@/components/modal-presentation';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, Icon } from '@/components/ui';
import {
  BottomTabInset,
  Elevation,
  FontFamily,
  MaxContentWidth,
  Palette,
  Radius,
  ScreenPadding,
  Spacing,
} from '@/constants/theme';
import { useProfile } from '@/features/auth/useProfile';
import { MyPanel } from '@/features/auth/MyPanel';
import { CoachChat } from '@/features/coach/CoachChat';
import { useDietSummary } from '@/features/coach/useDietSummary';
import { MonthCalendar } from '@/features/home/MonthCalendar';
import { PermissionGate } from '@/features/home/PermissionGate';
import { RECOMMENDED_WEEKLY_VISITS, useHomeActivity } from '@/features/home/useHomeActivity';
import { useSchedules } from '@/features/home/useSchedules';
import { CheckInFlow } from '@/features/membership/CheckInFlow';
import { MembershipForm } from '@/features/membership/MembershipForm';
import { MembershipListModal } from '@/features/membership/MembershipListModal';
import { useCurrentUser } from '@/stores/auth';
import {
  computeRisk,
  formatNumber,
  summarize,
} from '@/features/membership/dashboard';
import { useCoach } from '@/features/membership/useCoach';
import { daysUntil, useMemberships } from '@/features/membership/useMemberships';
import { buildPortfolioItems } from '@/features/membership/PortfolioView';
import { useMonthlyStats } from '@/features/membership/useMonthlyStats';
import { useVisitPattern } from '@/features/membership/useVisitPattern';
import { useTodayWorkoutLog } from '@/features/workout/useTodayWorkoutLog';

/** 만원 단위 축약: 230000 → "23만원", 4500 → "4,500원" */
function wonShort(n: number): string {
  if (n >= 10000) return `${Math.round(n / 10000)}만원`;
  return `${formatNumber(n)}원`;
}

/** 이번주 방문 횟수 → 상태 레이블 */
function getWeekBadge(visits: number): string | null {
  if (visits >= 3) return '훌륭해요!';
  if (visits >= 2) return '잘하고 있어요!';
  if (visits >= 1) return '시작했어요!';
  return null;
}

function CharacterImage() {
  return (
    <Image
      source={require('../../assets/images/Chat.png')}
      style={styles.characterImage}
      resizeMode="contain"
    />
  );
}

function SparkLine({ days }: { days: { visited: boolean; workout: boolean; isToday: boolean }[] }) {
  const data = days.length === 7 ? days : Array(7).fill({ visited: false, workout: false, isToday: false });
  const yHigh = 6, yLow = 26;
  const points = data.map((d, i) => `${(i / 6) * 100},${(d.visited || d.workout) ? yHigh : yLow}`).join(' ');
  const todayIdx = data.findLastIndex((d) => d.isToday);
  const todayX = todayIdx >= 0 ? (todayIdx / 6) * 100 : null;
  const todayY = todayIdx >= 0 ? ((data[todayIdx].visited || data[todayIdx].workout) ? yHigh : yLow) : null;
  return (
    <Svg width="100%" height={32} viewBox="0 0 100 32" preserveAspectRatio="none">
      <Polyline points={points} fill="none" stroke={Palette.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {todayX != null && todayY != null && (
        <Circle cx={todayX} cy={todayY} r="3" fill={Palette.primary} />
      )}
    </Svg>
  );
}

export default function HomeScreen() {
  const { data: profile } = useProfile();
  const { data: memberships, isLoading } = useMemberships();
  const { data: stats } = useMonthlyStats();
  const { data: visitPattern } = useVisitPattern();
  const { data: home } = useHomeActivity();
  const { data: todayWorkout } = useTodayWorkoutLog();
  const { summary: dietSummary } = useDietSummary();
  const user = useCurrentUser();
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showCoach, setShowCoach] = useState(false);
  const [showMyDrawer, setShowMyDrawer] = useState(false);
  const [showAlarm, setShowAlarm] = useState(false);
  const [showMembershipForm, setShowMembershipForm] = useState(false);
  const [showMembershipList, setShowMembershipList] = useState(false);
  const [checkInId, setCheckInId] = useState<string | null>(null); // 출석 대상 회원권
  const [roiIdx, setRoiIdx] = useState(0); // ROI 캐러셀 현재 인덱스
  const [roiCardW, setRoiCardW] = useState(Dimensions.get('window').width - ScreenPadding * 2);
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

  const items = buildPortfolioItems(list);
  // 홈 ROI 카드 — 회원권별 캐러셀 데이터(포트폴리오 값 + 위험/만료). list와 동일 순서.
  const roiCards = list.map((m, i) => ({ m, risk: withRisk[i].risk, value: items[i].value }));

  const name = profile?.display_name || '회원';

  const expiring = list
    .filter((m) => m.status === 'expiring')
    .sort((a, b) => daysUntil(a.endDate) - daysUntil(b.endDate));
  const bannerItem = expiring[0] ? withRisk.find((x) => x.m.id === expiring[0].id) ?? null : null;

  const today = new Date();
  const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const { data: monthSchedules } = useSchedules(today.getFullYear(), today.getMonth() + 1);
  const todayPlans = (monthSchedules ?? []).filter((s) => s.date === todayYmd && s.status === 'planned');
  const hasAlarm = expiring.length > 0 || todayPlans.length > 0;

  const coach = useCoach({ withRisk, summary, monthly: stats, pattern: visitPattern });

  const weekDays = home?.weekDays ?? [];
  const weekVisits = home?.weekVisits ?? 0;
  const weekWorkouts = home?.weekWorkouts ?? 0;
  // 권장 페이스(P1-1) — 활성 기간권 주당 목표 최댓값, 없으면 기본값.
  const goalFromMembership = list
    .filter((m) => m.type === 'period' && m.status !== 'expired' && m.weeklyGoal)
    .reduce((mx, m) => Math.max(mx, m.weeklyGoal ?? 0), 0);
  const recommendedWeekly = goalFromMembership > 0 ? goalFromMembership : RECOMMENDED_WEEKLY_VISITS;
  const weekBadge = getWeekBadge(weekVisits);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

          {/* ── 헤더 ── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Pressable
                onPress={() => setShowMyDrawer(true)}
                style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="메뉴 열기">
                <Icon icon={Menu} size={22} color={Palette.gray900} />
              </Pressable>
              {/* FitBack 로고 */}
              <Image
                source={require('../../assets/images/Logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <View style={styles.headerActions}>
              <Pressable
                onPress={() => setShowCalendar(true)}
                style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="달력 보기">
                <Icon icon={Calendar} size={22} color={Palette.gray900} />
              </Pressable>
              <Pressable
                onPress={() => setShowAlarm(true)}
                style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="알림">
                <View>
                  <Icon icon={Bell} size={22} color={hasAlarm ? Palette.gray900 : Palette.gray300} />
                  {hasAlarm ? <View style={styles.alarmDot} /> : null}
                </View>
              </Pressable>
            </View>
          </View>

          {/* ── 만료 임박 알림 배너 ── */}
          {bannerItem ? (
            <Pressable
              onPress={() => router.navigate('/membership')}
              style={({ pressed }) => [styles.expiryBanner, pressed && styles.pressed]}>
              <Icon icon={AlarmClock} size={16} color={Palette.white} />
              <ThemedText type="captionBold" style={styles.expiryBannerText} numberOfLines={1}>
                {bannerItem.risk.hasSessions && (bannerItem.risk.remainingSessions ?? 99) <= 5
                  ? `${bannerItem.m.name} · ${formatNumber(bannerItem.risk.remainingSessions ?? 0)}회 남음`
                  : `D-${bannerItem.risk.remainingDays} ${bannerItem.m.name} 만료`}
              </ThemedText>
              <Icon icon={ChevronRight} size={16} color={Palette.white} />
            </Pressable>
          ) : null}

          {/* ── AI 코치 배너 ── */}
          <Pressable
            onPress={() => setShowCoach(true)}
            style={({ pressed }) => [styles.coachBanner, pressed && { opacity: 0.9 }]}
            accessibilityRole="button"
            accessibilityLabel="AI 코치 열기">
            {/* 캐릭터 아바타 */}
            <View style={styles.coachAvatar}>
              <CharacterImage />
            </View>
            {/* 텍스트 */}
            <View style={styles.coachTextWrap}>
              <ThemedText type="body" style={styles.coachGreeting} numberOfLines={1}>
                {name}님 반가워요!
              </ThemedText>
              <ThemedText type="subtitle" style={styles.coachMsg} numberOfLines={2}>
                {coach.data?.headline ?? '오늘도 함께 운동해요!'}
              </ThemedText>
            </View>
            {/* 화살표 버튼 */}
            <View style={styles.coachArrow}>
              <Icon icon={ChevronRight} size={20} color={Palette.white} />
            </View>
          </Pressable>

          {/* ── 메인 ROI 카드 — 회원권별 캐러셀 ── */}
          {list.length > 0 ? (
            <View onLayout={(e) => setRoiCardW(e.nativeEvent.layout.width)}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  if (roiCardW > 0) setRoiIdx(Math.round(e.nativeEvent.contentOffset.x / roiCardW));
                }}>
                {roiCards.map(({ m, risk, value }) => {
                  const util = Math.min(100, Math.round(value.progressPct));
                  const expired = risk.remainingDays <= 0;
                  return (
                    <View key={m.id} style={[styles.membershipCard, Elevation.level1, { width: roiCardW }]}>
                      {/* 다크 헤더 — D-day + 회원권명 */}
                      <View style={styles.membershipCardHeader}>
                        <View style={styles.roiHeadLeft}>
                          <View style={styles.ddayBadge}>
                            <ThemedText type="label" style={styles.ddayBadgeText}>
                              {expired ? '만료' : `D-${risk.remainingDays}`}
                            </ThemedText>
                          </View>
                          <ThemedText type="caption" style={styles.cardHeaderText} numberOfLines={1}>
                            {m.name}
                          </ThemedText>
                        </View>
                        <Pressable
                          onPress={() => setShowMembershipList(true)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel="전체 회원권 목록">
                          <Icon icon={MoreHorizontal} size={20} color="rgba(255,255,255,0.7)" />
                        </Pressable>
                      </View>
                      {/* 화이트 바디 */}
                      <View style={styles.membershipCardBody}>
                        <View style={styles.cardAmountRow}>
                          <View style={styles.cardAmountLeft}>
                            {value.perVisitValue > 0 ? (
                              <ThemedText type="body" style={styles.checkInText}>
                                오늘 출석으로 {wonShort(value.perVisitValue)}{' '}
                                <ThemedText type="body" style={styles.checkInUp}>UP▲</ThemedText>
                              </ThemedText>
                            ) : null}
                            <CountUp value={value.recovered} format={formatNumber} suffix="원" type="display" style={styles.mainAmount} />
                          </View>
                          <Image source={require('../../assets/images/money-icon.png')} style={styles.moneyIcon} resizeMode="contain" />
                        </View>

                        <View style={styles.roiBarTrack}>
                          {util > 0 ? (
                            <View style={[styles.roiBarFill, { width: `${util}%` as any }]}>
                              <ThemedText type="label" style={styles.roiBarLabel}>{util}%</ThemedText>
                            </View>
                          ) : null}
                          {[25, 50, 75].map((mk) => (
                            <View key={mk} style={[styles.roiBarMarker, { left: `${mk}%` as any }]} />
                          ))}
                        </View>

                        <View style={styles.infoBoxRow}>
                          <View style={styles.infoBox}>
                            <ThemedText type="caption" themeColor="textSecondary">남은 방문</ThemedText>
                            <ThemedText type="body" themeColor="text">
                              {m.maxVisits != null ? `${m.remainingVisits ?? 0}회 / ${m.maxVisits}회` : '무제한'}
                            </ThemedText>
                          </View>
                          <View style={styles.infoBox}>
                            <ThemedText type="caption" themeColor="textSecondary">목표까지</ThemedText>
                            <ThemedText type="body" themeColor="text">{wonShort(value.remaining)}</ThemedText>
                          </View>
                          <View style={styles.infoBox}>
                            <ThemedText type="caption" themeColor="textSecondary">결제금액</ThemedText>
                            <ThemedText type="body" themeColor="text">{wonShort(m.cost)}</ThemedText>
                          </View>
                          <View style={styles.infoBox}>
                            <ThemedText type="caption" themeColor="textSecondary">이번 주 권장</ThemedText>
                            <ThemedText type="body" themeColor="text">
                              {weekVisits}/{recommendedWeekly}회
                            </ThemedText>
                          </View>
                        </View>

                        <Pressable
                          onPress={() => {
                            setCheckInId(m.id);
                            setShowCheckIn(true);
                          }}
                          style={({ pressed }) => [styles.utilBtn, pressed && styles.pressed]}
                          accessibilityRole="button">
                          <ThemedText type="subtitle" style={styles.utilBtnText}>
                            지금 출석하기
                          </ThemedText>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
              {roiCards.length > 1 ? (
                <View style={styles.dotsRow}>
                  {roiCards.map((c, i) => (
                    <View key={c.m.id} style={[styles.dot, i === roiIdx && styles.dotActive]} />
                  ))}
                </View>
              ) : null}
            </View>
          ) : !isLoading ? (
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

          {/* ── 프로모션 배너 (static) ── */}
          <Image
            source={require('../../assets/images/banner.png')}
            style={styles.promoBanner}
            resizeMode="cover"
          />

          {/* ── 내 기록 모아보기 ── */}
          <View style={styles.recordSection}>
            <ThemedText style={styles.sectionTitle}>내 기록 모아보기</ThemedText>
            <View style={styles.recordGrid}>

              {/* 운동 */}
              <Pressable
                onPress={() => router.navigate('/workout')}
                style={({ pressed }) => [styles.recordCard, Elevation.level1, pressed && styles.pressed]}>
                <View style={styles.recordCardHead}>
                  <ThemedText style={styles.recordCardLabel}>운동</ThemedText>
                  <Icon icon={ChevronRight} size={16} color={Palette.gray300} />
                </View>
                <ThemedText style={styles.recordValue}>
                  {todayWorkout?.hasWorkout ? `${todayWorkout.durationMin}분` : '0분'}
                </ThemedText>
                {/* 미니 스파크라인 */}
                <SparkLine days={weekDays} />
                <ThemedText type="label" style={styles.recordSub}>이번주 {weekWorkouts}회</ThemedText>
              </Pressable>

              {/* 식단 */}
              <Pressable
                onPress={() => router.navigate('/diet')}
                style={({ pressed }) => [styles.recordCard, Elevation.level1, pressed && styles.pressed]}>
                <View style={styles.recordCardHead}>
                  <ThemedText style={styles.recordCardLabel}>식단</ThemedText>
                  <Icon icon={ChevronRight} size={16} color={Palette.gray300} />
                </View>
                <ThemedText style={styles.recordValue}>
                  {dietSummary ? `${dietSummary.totalKcal}kcal` : '0kcal'}
                </ThemedText>
                {dietSummary ? (
                  <View style={styles.recordPill}>
                    <ThemedText type="label" themeColor="textSecondary">
                      단백질 · {dietSummary.protein_g}g
                    </ThemedText>
                  </View>
                ) : null}
              </Pressable>

              {/* 이번주 기록 */}
              <Pressable
                onPress={() => router.navigate('/membership')}
                style={({ pressed }) => [styles.recordCard, Elevation.level1, pressed && styles.pressed]}>
                <View style={styles.recordCardHead}>
                  <ThemedText style={styles.recordCardLabel}>이번주 기록</ThemedText>
                  <Icon icon={ChevronRight} size={16} color={Palette.gray300} />
                </View>
                <ThemedText style={styles.recordValue}>
                  {weekVisits}번
                </ThemedText>
                {weekBadge ? (
                  <View style={styles.recordStatusBadge}>
                    <ThemedText style={styles.recordStatusText}>{weekBadge}</ThemedText>
                  </View>
                ) : null}
              </Pressable>

              {/* 회원권 */}
              <Pressable
                onPress={() => router.navigate('/membership')}
                style={({ pressed }) => [styles.recordCard, Elevation.level1, pressed && styles.pressed]}>
                <View style={styles.recordCardHead}>
                  <ThemedText style={styles.recordCardLabel}>회원권</ThemedText>
                  <Icon icon={ChevronRight} size={16} color={Palette.gray300} />
                </View>
                <ThemedText style={styles.recordValue}>
                  {list.length}개
                </ThemedText>
                {expiring[0] ? (
                  <View style={styles.recordPill}>
                    <ThemedText type="label" themeColor="textSecondary">
                      D-{daysUntil(expiring[0].endDate)}
                    </ThemedText>
                  </View>
                ) : null}
              </Pressable>

            </View>
          </View>

        </ScrollView>
      </SafeAreaView>

      {/* 체크인 모달 */}
      <Modal
        visible={showCheckIn}
        animationType="slide"
        presentationStyle={sheetPresentation}
        onRequestClose={() => setShowCheckIn(false)}>
        <ThemedView style={styles.modalRoot}>
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            <CheckInFlow
              memberships={list}
              initialMembershipId={checkInId ?? undefined}
              onClose={() => {
                setShowCheckIn(false);
                setCheckInId(null);
              }}
            />
          </SafeAreaView>
        </ThemedView>
      </Modal>

      {/* 알림 모달 */}
      <Modal
        visible={showAlarm}
        animationType="slide"
        presentationStyle={sheetPresentation}
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
        presentationStyle={sheetPresentation}
        onRequestClose={() => setShowCalendar(false)}>
        <ThemedView style={styles.modalRoot}>
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            <MonthCalendar onClose={() => setShowCalendar(false)} />
          </SafeAreaView>
        </ThemedView>
      </Modal>

      {/* AI 코치 모달 */}
      <Modal
        visible={showCoach}
        animationType="slide"
        presentationStyle={sheetPresentation}
        onRequestClose={() => setShowCoach(false)}>
        <ThemedView style={styles.modalRoot}>
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            <CoachChat onClose={() => setShowCoach(false)} />
          </SafeAreaView>
        </ThemedView>
      </Modal>

      {/* 마이 패널 */}
      <Modal
        visible={showMyDrawer}
        animationType="slide"
        presentationStyle={sheetPresentation}
        onRequestClose={() => setShowMyDrawer(false)}>
        <MyPanel onClose={() => setShowMyDrawer(false)} />
      </Modal>

      {/* 회원권 등록 모달 */}
      <Modal
        visible={showMembershipForm}
        animationType="slide"
        presentationStyle={sheetPresentation}
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

      {/* 전체 회원권 목록 → 항목 선택 시 세부 정보 */}
      <MembershipListModal
        visible={showMembershipList}
        onClose={() => setShowMembershipList(false)}
      />

      {/* 위치·알림 권한 안내 (최초 1회) */}
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

  // ── 헤더 ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 110, height: 19 },
  headerActions: { flexDirection: 'row', gap: Spacing.xs },
  alarmDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Palette.warning,
  },

  // ── 만료 배너 ──
  expiryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.gray900,
    borderRadius: Radius.button,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  expiryBannerText: { flex: 1, color: Palette.white },

  // ── AI 코치 배너 ──
  coachBanner: {
    backgroundColor: Palette.primary,
    borderRadius: Radius.card,
    height: 110,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    overflow: 'hidden',
  },
  coachAvatar: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: Palette.primaryLight,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  characterImage: { width: 52, height: 52 },
  coachTextWrap: { flex: 1, gap: 2 },
  coachGreeting: { color: 'rgba(255,255,255,0.8)' },
  coachMsg: { color: Palette.white },
  coachArrow: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── 메인 ROI 카드 (2층 구조) ──
  membershipCard: {
    borderRadius: Radius.card,
    overflow: 'hidden',
    backgroundColor: Palette.gray900,
  },
  membershipCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  cardHeaderText: { color: 'rgba(255,255,255,0.7)' },
  roiHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  ddayBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  ddayBadgeText: { color: Palette.white, fontWeight: '700' },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: Spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Palette.gray300 },
  dotActive: { width: 18, backgroundColor: Palette.primary },
  membershipCardBody: {
    backgroundColor: Palette.bgSurface,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 0.5,
    borderColor: Palette.lineDefault,
  },
  // emptyCard: 회원권 미등록 시 단일 화이트 카드
  mainCard: {
    backgroundColor: Palette.bgSurface,
    borderRadius: Radius.card,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 0.5,
    borderColor: Palette.lineDefault,
    overflow: 'visible',
  },
  emptyCard: { alignItems: 'center', gap: Spacing.md },
  cardAmountRow: { flexDirection: 'row', alignItems: 'flex-end' },
  cardAmountLeft: { flex: 1, gap: Spacing.xs },
  checkInText: { color: Palette.gray500 },
  checkInUp: { color: Palette.primary, fontFamily: FontFamily.medium, fontWeight: '500' },
  moneyIcon: { width: 79, height: 79, alignSelf: 'center' as const },
  mainAmount: { color: Palette.gray900 },

  // ROI 진행바 (28px, % 텍스트 안에) — Figma: radius 6, bg #F5F5F8
  roiBarTrack: {
    height: 28,
    borderRadius: 6,
    backgroundColor: Palette.gray50,
    overflow: 'hidden',
    position: 'relative',
  },
  roiBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Palette.secondary,
    borderRadius: 6,
    paddingHorizontal: Spacing.sm,
    justifyContent: 'center',
  },
  roiBarLabel: { color: Palette.white, fontWeight: '700' },
  roiBarMarker: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: 1,
    backgroundColor: Palette.lineStrong,
  },

  // 정보 박스 (2×2 래핑)
  infoBoxRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  infoBox: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: Palette.gray50,
    borderRadius: Radius.button,
    padding: Spacing.sm,
    gap: Spacing.xs,
  },

  // 출석 버튼 (아웃라인)
  utilBtn: {
    height: 48,
    borderRadius: Radius.button,
    borderWidth: 1.5,
    borderColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  utilBtnText: {
    color: Palette.primary,
    fontSize: 18,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    letterSpacing: -0.45,
  },

  // ── 프로모션 배너 ──
  promoBanner: {
    width: '100%',
    height: 110,
    borderRadius: Radius.card,
    overflow: 'hidden',
  },

  // ── 내 기록 모아보기 ──
  recordSection: { gap: Spacing.sm },
  sectionTitle: {
    color: Palette.gray900,
    fontSize: 18,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    letterSpacing: -0.54,
  },
  recordGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  recordCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: Palette.bgSurface,
    borderRadius: Radius.card,
    padding: Spacing.md,
    gap: Spacing.xs,
    borderWidth: 0.5,
    borderColor: Palette.lineDefault,
    minHeight: 140,
    overflow: 'hidden',
  },
  recordCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordCardLabel: {
    fontSize: 18,
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    letterSpacing: -0.45,
    color: Palette.gray500,
  },
  recordValue: {
    color: Palette.gray900,
    fontSize: 20,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  recordSub: { color: Palette.gray400, marginTop: 'auto' as any },
  recordPill: {
    alignSelf: 'flex-start',
    backgroundColor: Palette.gray50,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginTop: 'auto' as any,
  },
  recordStatusBadge: {
    backgroundColor: Palette.primaryLight,
    borderRadius: 10,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto' as any,
  },
  recordStatusText: {
    color: Palette.primary,
    fontSize: 16,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    textAlign: 'center',
  },

  // ── 모달 공통 ──
  modalRoot: { flex: 1, backgroundColor: Palette.bgBase },
  modalSafe: { flex: 1 },
  alarmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ScreenPadding,
    paddingVertical: Spacing.md,
  },
  alarmBody: { paddingHorizontal: ScreenPadding, paddingBottom: Spacing.xl, gap: Spacing.sm },
  alarmItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },

  // ── 토스트 ──
  toastWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: BottomTabInset + Spacing.xl,
    alignItems: 'center',
  },
  toast: {
    backgroundColor: Palette.gray900,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    ...Elevation.level2,
  },
});
