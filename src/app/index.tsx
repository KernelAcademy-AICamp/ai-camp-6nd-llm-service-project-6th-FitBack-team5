import { router } from 'expo-router';
import {
  AlarmClock, Calendar,
  Info, MoreHorizontal, TrendingUp, X,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoachTipCard } from '@/components/coach-tip-card';
import { CountUp } from '@/components/count-up';
import { GnbBar } from '@/components/gnb-bar';
import { IconArrowChevron, IconArrowCircle } from '@/components/icons';
import { RecordCard } from '@/components/record-card';

const GNB_HEIGHT = 52;
import { sheetPresentation } from '@/components/modal-presentation';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LineBar } from '@/components/line-bar';
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
      source={require('../../assets/images/chat_main.png')}
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
  const [checkInMembershipId, setCheckInMembershipId] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showCoach, setShowCoach] = useState(false);
  const [showMyDrawer, setShowMyDrawer] = useState(false);
  const [showAlarm, setShowAlarm] = useState(false);
  const [showMembershipForm, setShowMembershipForm] = useState(false);
  const [showMembershipList, setShowMembershipList] = useState(false);
  const [showMembershipActions, setShowMembershipActions] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState(0);
  const [dismissedAlarmKey, setDismissedAlarmKey] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('alarm_dismissed_key').then((v) => setDismissedAlarmKey(v));
  }, []);

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
  const portfolioMap = new Map(items.map((x) => [x.m.id, x]));

  const { width: screenW } = useWindowDimensions();
  const carouselWidth = Math.min(screenW, MaxContentWidth) - ScreenPadding * 2;

  const carouselItems = [...withRisk]
    .filter((x) => x.m.status !== 'expired')
    .sort((a, b) => daysUntil(a.m.endDate) - daysUntil(b.m.endDate));

  const name = profile?.display_name || '회원';

  const expiring = list
    .filter((m) => m.status === 'expiring')
    .sort((a, b) => daysUntil(a.endDate) - daysUntil(b.endDate));
  const bannerItemRaw = expiring[0] ? withRisk.find((x) => x.m.id === expiring[0].id) ?? null : null;

  const today = new Date();
  const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const { data: monthSchedules } = useSchedules(today.getFullYear(), today.getMonth() + 1);
  const todayPlans = (monthSchedules ?? []).filter((s) => s.date === todayYmd && s.status === 'planned');

  const alarmKey = bannerItemRaw
    ? `${bannerItemRaw.m.id}-${todayYmd}`
    : todayPlans.length > 0 ? `plans-${todayYmd}` : null;
  const alarmRead = alarmKey !== null && dismissedAlarmKey === alarmKey;
  const hasAlarm = (expiring.length > 0 || todayPlans.length > 0) && !alarmRead;
  const bannerItem = alarmRead ? null : bannerItemRaw;

  function dismissAlarm() {
    if (!alarmKey) return;
    setDismissedAlarmKey(alarmKey);
    void AsyncStorage.setItem('alarm_dismissed_key', alarmKey);
  }

  const coach = useCoach({ withRisk, summary, monthly: stats, pattern: visitPattern });

  const weekDays = home?.weekDays ?? [];
  const weekVisits = home?.weekVisits ?? 0;
  // 권장 페이스 — 활성 기간권 주당 목표 최댓값, 없으면 기본값. (일정 → 활용도 카드로 이동)
  const goalFromMembership = list
    .filter((m) => m.type === 'period' && m.status !== 'expired' && m.weeklyGoal)
    .reduce((mx, m) => Math.max(mx, m.weeklyGoal ?? 0), 0);
  const recommendedWeekly = goalFromMembership > 0 ? goalFromMembership : RECOMMENDED_WEEKLY_VISITS;
  const weekWorkouts = home?.weekWorkouts ?? 0;
  const weekBadge = getWeekBadge(weekVisits);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={Platform.select({ web: ['bottom'] as const, default: undefined })} style={styles.safeArea}>
          {/* ── 헤더 (스크롤 밖 고정) ── */}
          <GnbBar
            onMenu={() => setShowMyDrawer(true)}
            onCalendar={() => setShowCalendar(true)}
            onAlarm={() => { dismissAlarm(); setShowAlarm(true); }}
            hasAlarm={hasAlarm}
          />

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

          {/* ── 만료 임박 알림 배너 ── */}
          {bannerItem ? (
            <Pressable
              onPress={() => { dismissAlarm(); router.navigate('/membership'); }}
              style={({ pressed }) => [styles.expiryBanner, pressed && styles.pressed]}>
              <Icon icon={AlarmClock} size={16} color={Palette.white} />
              <ThemedText type="captionBold" style={styles.expiryBannerText} numberOfLines={1}>
                {bannerItem.risk.hasSessions && (bannerItem.risk.remainingSessions ?? 99) <= 5
                  ? `${bannerItem.m.name} · ${formatNumber(bannerItem.risk.remainingSessions ?? 0)}회 남음`
                  : `D-${bannerItem.risk.remainingDays} ${bannerItem.m.name} 만료`}
              </ThemedText>
              <IconArrowChevron size={16} color={Palette.white} />
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
              <Text style={styles.coachMsg}>
                {'함께 오늘 '}
                <Text style={styles.coachMsgHighlight}>운동</Text>
                {' 구성해요!'}
              </Text>
            </View>
            <IconArrowCircle />
          </Pressable>

          {/* ── 회원권 캐러셀 ── */}
          {carouselItems.length > 0 ? (
            /* shadow wrapper — overflow:visible 유지로 shadow 클리핑 방지 */
            <View style={[styles.membershipCardShadow, Elevation.level1]}>
              {/* clip wrapper — border-radius + overflow:hidden으로 자식 클리핑 */}
              <View style={styles.membershipCardClip}>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  nestedScrollEnabled
                  onScroll={(e) => {
                    const page = Math.round(e.nativeEvent.contentOffset.x / carouselWidth);
                    setActiveCard(Math.max(0, Math.min(page, carouselItems.length - 1)));
                  }}
                  scrollEventThrottle={16}
                >
                  {carouselItems.map((item) => {
                    const pItem = portfolioMap.get(item.m.id);
                    const cardRecovered = pItem?.value.recovered ?? 0;
                    const cardProgressPct = Math.min(100, Math.round(pItem?.value.progressPct ?? 0));
                    const cardRemaining = pItem?.value.remaining ?? 0;
                    const cardEffPrice =
                      item.m.status !== 'expired' && pItem && !pItem.value.isComplete
                        ? pItem.value.perVisitValue
                        : 0;

                    return (
                      <View key={item.m.id} style={[styles.membershipCardInner, { width: carouselWidth }]}>
                        {/* 다크 헤더 */}
                        <View style={styles.membershipCardHeader}>
                          <View style={styles.cardHeaderLeft}>
                            <View style={styles.cardDaysBadge}>
                              <ThemedText type="captionBold" style={styles.cardDaysText}>
                                {item.m.status === 'expired' ? '만료' : `D-${daysUntil(item.m.endDate)}`}
                              </ThemedText>
                            </View>
                            <ThemedText type="caption" style={styles.cardHeaderText} numberOfLines={1}>
                              {item.m.name}
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
                          <Image
                            source={require('../../assets/images/icon/main_icon.png')}
                            style={styles.moneyIcon}
                            resizeMode="contain"
                          />
                          <View style={styles.cardAmountLeft}>
                            {cardRecovered === 0 ? (
                              <ThemedText type="body" style={styles.checkInText}>
                                센터를 방문해 회원권을 활용하세요
                              </ThemedText>
                            ) : cardEffPrice > 0 ? (
                              <ThemedText type="body" style={styles.checkInText}>
                                오늘 출석으로 {wonShort(cardEffPrice)}{' '}
                                <ThemedText type="body" style={styles.checkInUp}>UP▲</ThemedText>
                              </ThemedText>
                            ) : null}
                            <View style={styles.amountRow}>
                              <CountUp value={cardRecovered} format={formatNumber} suffix="원" type="display" style={styles.mainAmount} />
                              {cardEffPrice > 0 ? (
                                <Icon icon={Info} size={20} color={Palette.gray400} />
                              ) : null}
                            </View>
                          </View>

                          <View style={styles.roiBarTrack}>
                            {cardProgressPct > 0 ? (
                              <View style={[styles.roiBarFill, { width: `${cardProgressPct}%` as any }]}>
                                <ThemedText type="bodySemibold" style={styles.roiBarLabel}>{cardProgressPct}%</ThemedText>
                              </View>
                            ) : null}
                            {[25, 50, 75].map((mk) => (
                              <View key={mk} style={[styles.roiBarMarker, { left: `${mk}%` as any }]} />
                            ))}
                          </View>

                          <View style={styles.infoBoxRow}>
                            <View style={styles.infoBox}>
                              <ThemedText type="caption" themeColor="textSecondary">남은 방문</ThemedText>
                              {item.risk.hasSessions ? (
                                <ThemedText type="bodySemibold" themeColor="text">
                                  {item.risk.remainingSessions ?? 0}회{' '}
                                  <ThemedText type="body" style={styles.infoBoxSub}>
                                    / {item.m.maxVisits}회
                                  </ThemedText>
                                </ThemedText>
                              ) : (
                                <ThemedText type="bodySemibold" themeColor="text">
                                  {weekVisits}/{recommendedWeekly}회
                                </ThemedText>
                              )}
                            </View>
                            <View style={styles.infoBox}>
                              <ThemedText type="caption" themeColor="textSecondary">목표까지</ThemedText>
                              <ThemedText type="bodySemibold" themeColor="text">{wonShort(cardRemaining)}</ThemedText>
                            </View>
                            <View style={styles.infoBox}>
                              <ThemedText type="caption" themeColor="textSecondary">결제금액</ThemedText>
                              <ThemedText type="body" themeColor="text">{wonShort(item.m.cost)}</ThemedText>
                            </View>
                          </View>

                          {carouselItems.length > 1 && (
                            <View style={styles.pageDots}>
                              {carouselItems.map((_, i) => (
                                <View key={i} style={[styles.pageDot, i === activeCard && styles.pageDotActive]} />
                              ))}
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>

                <LineBar style={{ marginVertical: 0 }} />

                {/* 고정 출석 버튼 — 카드 안, 캐러셀 밖 */}
                <View style={styles.membershipCardFooter}>
                  <Pressable
                    onPress={() => {
                      const target = carouselItems[activeCard]?.m.id ?? null;
                      setCheckInMembershipId(target);
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
            </View>
          ) : !isLoading ? (
            <Pressable
              onPress={() => setShowMembershipForm(true)}
              style={[styles.mainCard, Elevation.level1, styles.emptyCard]}>
              <Icon icon={TrendingUp} size={28} color={Palette.primary} />
              <ThemedText type="subtitle" style={{ textAlign: 'center' }}>
                회원권을 등록해 활용도를 챙기세요
              </ThemedText>
              <View style={styles.utilBtn}>
                <ThemedText type="subtitle" style={styles.utilBtnText}>
                  회원권 등록하기
                </ThemedText>
              </View>
            </Pressable>
          ) : null}

          {/* ── AI 코치 팁 카드 ── */}
          {coach.data && (
            <CoachTipCard>
              <ThemedText type="body" style={{ color: Palette.gray700 }}>
                {coach.data.insight || coach.data.action || coach.data.headline}
              </ThemedText>
            </CoachTipCard>
          )}

          {/* ── 내 기록 모아보기 ── */}
          <View style={styles.recordSection}>
            <ThemedText style={styles.sectionTitle}>내 기록 모아보기</ThemedText>
            <View style={styles.recordGrid}>

              <RecordCard
                label="운동"
                value={todayWorkout?.hasWorkout ? `${todayWorkout.durationMin}분` : '0분'}
                onPress={() => router.navigate('/workout')}>
                <SparkLine days={weekDays} />
                <ThemedText type="label" style={styles.recordSub}>이번주 {weekWorkouts}회</ThemedText>
              </RecordCard>

              <RecordCard
                label="식단"
                value={dietSummary ? `${dietSummary.totalKcal}kcal` : '0kcal'}
                onPress={() => router.navigate('/diet')}>
                {dietSummary ? (
                  <RecordCard.Pill text={`단백질 · ${dietSummary.protein_g}g`} />
                ) : null}
              </RecordCard>

              <RecordCard
                label="이번주 기록"
                value={`${weekVisits}번`}
                onPress={() => router.navigate('/membership')}>
                {weekBadge ? <RecordCard.Badge text={weekBadge} /> : null}
              </RecordCard>

              <RecordCard
                label="회원권"
                value={`${list.length}개`}
                onPress={() => setShowMembershipActions(true)}>
                {expiring[0] ? (
                  <RecordCard.Pill text={`D-${daysUntil(expiring[0].endDate)}`} />
                ) : null}
              </RecordCard>

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
              memberships={checkInMembershipId ? list.filter((m) => m.id === checkInMembershipId) : list}
              onClose={() => { setShowCheckIn(false); setCheckInMembershipId(null); }}
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

      {/* 회원권 액션시트 */}
      <Modal
        visible={showMembershipActions}
        animationType="fade"
        transparent
        onRequestClose={() => setShowMembershipActions(false)}>
        <Pressable style={styles.actionSheetOverlay} onPress={() => setShowMembershipActions(false)}>
          <View style={styles.actionSheet}>
            <Pressable
              style={({ pressed }) => [styles.actionSheetBtn, pressed && styles.pressed]}
              onPress={() => { setShowMembershipActions(false); router.navigate('/membership'); }}>
              <ThemedText style={styles.actionSheetBtnText}>회원권 보기</ThemedText>
            </Pressable>
            <View style={styles.actionSheetDivider} />
            <Pressable
              style={({ pressed }) => [styles.actionSheetBtn, pressed && styles.pressed]}
              onPress={() => { setShowMembershipActions(false); setShowMembershipForm(true); }}>
              <ThemedText style={[styles.actionSheetBtnText, { color: Palette.primary }]}>회원권 등록하기</ThemedText>
            </Pressable>
            <View style={styles.actionSheetDivider} />
            <Pressable
              style={({ pressed }) => [styles.actionSheetBtn, pressed && styles.pressed]}
              onPress={() => setShowMembershipActions(false)}>
              <ThemedText style={[styles.actionSheetBtnText, { color: Palette.gray500 }]}>취소</ThemedText>
            </Pressable>
          </View>
        </Pressable>
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
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  scrollView: { flex: 1 },
  body: {
    paddingHorizontal: ScreenPadding,
    paddingTop: GNB_HEIGHT + Spacing.md,
    paddingBottom: BottomTabInset + Spacing.lg,
  },
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
    marginTop: 20,
    backgroundColor: Palette.primary,
    borderRadius: Radius.card,
    height: 110,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 8,
    overflow: 'hidden',
  },
  coachAvatar: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  characterImage: { width: 72, height: 72 },
  coachTextWrap: { flex: 1, gap: 2 },
  coachGreeting: { color: 'rgba(255,255,255,0.8)' },
  coachArrow: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── 메인 ROI 카드 (2층 구조) ──
  // shadow wrapper: overflow visible → shadow 안 잘림
  membershipCardShadow: {
    marginTop: Spacing.md,
    borderRadius: Radius.card,
  },
  // clip wrapper: radius + overflow hidden으로 자식 클리핑
  membershipCardClip: {
    borderRadius: Radius.card,
    overflow: 'hidden',
    backgroundColor: Palette.bgSurface,
  },
  // 캐러셀 아이템: shadow·radius 없음 (부모가 처리)
  membershipCardInner: {
    backgroundColor: Palette.gray800,
  },
  membershipCard: {
    borderRadius: Radius.card,
    overflow: 'hidden',
    backgroundColor: Palette.gray800,
  },
  membershipCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  cardHeaderText: { color: 'rgba(255,255,255,0.7)' },
  membershipCardBody: {
    backgroundColor: Palette.bgSurface,
    padding: Spacing.card,
    gap: Spacing.card,
    borderTopWidth: 0.5,
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderBottomWidth: 0,
    borderColor: Palette.lineDefault,
    position: 'relative',
    overflow: 'hidden',
  },
  membershipCardFooter: {
    backgroundColor: Palette.bgSurface,
    paddingHorizontal: Spacing.card,
    paddingTop: Spacing.card,
    paddingBottom: Spacing.card,
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderTopWidth: 0,
    borderColor: Palette.lineDefault,
  },
  moneyIcon: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 120,
    height: 120,
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
  cardAmountLeft: { gap: Spacing.xs, minHeight: 80 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  checkInText: { color: Palette.gray500 },
  checkInUp: { color: Palette.primary, fontFamily: FontFamily.medium, fontWeight: '500' },
  mainAmount: { color: Palette.gray900 },

  // ROI 진행바 (28px, % 텍스트 안에) — Figma: radius 6, bg #F5F5F8
  roiBarTrack: {
    height: 28,
    borderRadius: 6,
    backgroundColor: Palette.bgMuted,
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

  // 2개 정보 박스
  infoBoxRow: { flexDirection: 'row', gap: Spacing.sm },
  infoBox: {
    flex: 1,
    backgroundColor: Palette.bgMuted,
    borderRadius: Radius.button,
    padding: Spacing.ms,
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

  // ── 코치 배너 메시지 ──
  coachMsg: {
    fontSize: 18,
    fontFamily: FontFamily.bold,
    fontWeight: '700' as const,
    letterSpacing: -0.45,
    color: Palette.white,
    lineHeight: 23,
  },
  coachMsgHighlight: {
    color: Palette.coachAccent,
  },

  // ── 페이지 도트 ──
  pageDots: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: Spacing.xs,
  },
  pageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Palette.gray300,
  },
  pageDotActive: {
    backgroundColor: Palette.primary,
    width: 16,
  },
  cardDotDivider: {
    height: 1,
    backgroundColor: Palette.lineDefault,
    marginHorizontal: -Spacing.md,
  },

  // ── 카드 헤더 (D-days + 이름) ──
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  cardDaysBadge: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  cardDaysText: { color: Palette.white },
  infoBoxSub: {
    color: Palette.gray500,
    fontSize: 14,
    fontFamily: FontFamily.medium,
    fontWeight: '500',
  },

  // ── 내 기록 모아보기 ──
  recordSection: { marginTop: Spacing.lg, gap: Spacing.sm },
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
    gap: Spacing.m,
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
  modalRoot: { flex: 1, backgroundColor: Palette.bgSurface },
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

  // ── 회원권 액션시트 ──
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  actionSheet: {
    backgroundColor: Palette.bgSurface,
    borderRadius: Radius.card,
    overflow: 'hidden',
    ...Elevation.level2,
  },
  actionSheetBtn: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  actionSheetBtnText: {
    fontSize: 16,
    fontFamily: FontFamily.medium,
    color: Palette.gray900,
  },
  actionSheetDivider: {
    height: 1,
    backgroundColor: Palette.lineDefault,
  },

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
