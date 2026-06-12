import { router } from 'expo-router';
import { MapPin, TrendingDown, TrendingUp } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, Icon } from '@/components/ui';
import { BottomTabInset, MaxContentWidth, Palette, ScreenPadding, Spacing } from '@/constants/theme';
import { useProfile } from '@/features/auth/useProfile';
import { ActivityCalendar } from '@/features/home/ActivityCalendar';
import { HomeStrip } from '@/features/home/HomeStrip';
import { CheckInFlow } from '@/features/membership/CheckInFlow';
import { CoachCard } from '@/features/membership/CoachCard';
import { computeRisk, formatNumber, summarize, won } from '@/features/membership/dashboard';
import { HelpButton } from '@/features/membership/HelpButton';
import { useMemberships } from '@/features/membership/useMemberships';
import { useMonthCompare } from '@/features/membership/useMonthCompare';
import { useMonthlyStats } from '@/features/membership/useMonthlyStats';
import { useVisitPattern } from '@/features/membership/useVisitPattern';

const UTIL_HELP = [
  '활용도 = 사용한 횟수 ÷ 전체 횟수예요. (횟수제 회원권 합산)',
  '가치 회수 = 지금까지 다닌 만큼 되찾은 회원권 가치(사용 횟수 × 회당 비용)예요.',
  '많이 갈수록 활용도와 회수 가치가 올라가요.',
];

/** 활용도 도넛 링 (흰색, Primary 배경 위). 중앙엔 회수 가치 금액. */
function UtilRing({ pct, centerValue }: { pct: number | null; centerValue: string }) {
  const size = 96;
  const r = 40;
  const sw = 9;
  const c = 2 * Math.PI * r;
  const ratio = pct != null ? Math.min(1, Math.max(0, pct / 100)) : 0;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.25)" strokeWidth={sw} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={Palette.white}
          strokeWidth={sw}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * ratio} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <ThemedText type="captionBold" style={styles.ringValue}>
          {centerValue}
        </ThemedText>
        <ThemedText type="label" style={styles.dimWhite}>
          가치 회수
        </ThemedText>
      </View>
    </View>
  );
}

function HeroStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.heroStat}>
      <ThemedText type="label" style={styles.dimWhite}>
        {label}
      </ThemedText>
      <ThemedText type="captionBold" style={styles.white}>
        {value}
      </ThemedText>
      {sub ? (
        <ThemedText type="label" style={styles.dimWhite}>
          {sub}
        </ThemedText>
      ) : null}
    </View>
  );
}

/**
 * 홈 대시보드 (앱 디폴트). P0: 블록① 히어로(회원권 활용도) + 블록② AI 코치.
 */
export default function HomeScreen() {
  const { data: profile } = useProfile();
  const { data: memberships, isLoading } = useMemberships();
  const { data: stats } = useMonthlyStats();
  const { data: visitPattern } = useVisitPattern();
  const { data: monthCompare } = useMonthCompare();
  const [showCheckIn, setShowCheckIn] = useState(false);

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

  const recovered = withRisk.reduce((s, x) => s + x.risk.valueUsed, 0); // 가치 회수(누적)
  const totalPaid = list.reduce((s, x) => s + x.cost, 0); // 총 결제 금액
  const remainingValue = withRisk.reduce((s, x) => s + x.risk.valueAtRisk, 0); // 남은 가치
  const listPrice = totalTotal > 0 ? Math.round(sessionedCost / totalTotal) : null; // 정가 회당
  const effPrice = totalUsed > 0 ? Math.round(sessionedCost / totalUsed) : listPrice; // 실제 회당

  const name = profile?.display_name || '회원';
  const mom = monthCompare?.changePct ?? null;

  function handleCheckIn() {
    if (list.length === 0) {
      const msg = '먼저 회원권을 등록해 주세요.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('오늘 체크인', msg);
      return;
    }
    setShowCheckIn(true);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View>
            <ThemedText type="h1">FitBack</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {name}님, 오늘도 파이팅
            </ThemedText>
          </View>

          {/* 블록 ① 히어로 — 회원권 활용도 (솔리드 Primary) */}
          {list.length > 0 ? (
            <Pressable onPress={() => router.navigate('/membership')}>
              <View style={styles.hero}>
                <View style={styles.heroTop}>
                  <View style={styles.heroLeft}>
                    <View style={styles.labelRow}>
                      <ThemedText type="caption" style={styles.dimWhite}>
                        이번 달 회원권 활용도
                      </ThemedText>
                      <HelpButton title="활용도가 뭔가요?" paragraphs={UTIL_HELP} color="rgba(255,255,255,0.7)" />
                    </View>
                    <ThemedText type="display" style={styles.white}>
                      {utilization != null ? `${utilization}%` : '기간제'}
                    </ThemedText>
                    {mom != null ? (
                      <View style={styles.momChip}>
                        <Icon icon={mom >= 0 ? TrendingUp : TrendingDown} size={12} color={Palette.white} />
                        <ThemedText type="label" style={styles.white}>
                          지난 달보다 {mom >= 0 ? '+' : ''}
                          {mom}%
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                  <UtilRing pct={utilization} centerValue={won(recovered)} />
                </View>

                <View style={styles.heroDivider} />

                <View style={styles.heroStats}>
                  <HeroStat label="총 결제 금액" value={won(totalPaid)} />
                  <HeroStat label="남은 가치" value={won(remainingValue)} />
                  <HeroStat
                    label="1회당 비용"
                    value={effPrice != null ? `${formatNumber(effPrice)}원` : '-'}
                    sub={listPrice != null && effPrice !== listPrice ? `정가 ${formatNumber(listPrice)}원` : undefined}
                  />
                </View>
              </View>
            </Pressable>
          ) : !isLoading ? (
            <Card>
              <ThemedText type="body">회원권을 등록하면 활용도를 분석해드려요.</ThemedText>
              <Button
                label="회원권 등록하러 가기"
                onPress={() => router.navigate('/membership')}
                style={styles.emptyBtn}
              />
            </Card>
          ) : null}

          {/* 오늘 체크인 — 센터 가기 플로우 진입 (디폴트 페이지 핵심 액션) */}
          {list.length > 0 ? (
            <Button label="오늘 체크인" icon={MapPin} onPress={handleCheckIn} />
          ) : null}

          {/* 블록 ② AI 코치 — 오늘의 액션 */}
          <CoachCard withRisk={withRisk} summary={summary} monthly={stats} pattern={visitPattern} />

          {/* 블록 ③ 3대 기능 스트립 */}
          <HomeStrip withRisk={withRisk} />

          {/* 블록 ④ 누적 기록 캘린더 */}
          <ActivityCalendar />
        </ScrollView>
      </SafeAreaView>

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
  body: { gap: Spacing.lg, paddingBottom: Spacing.lg },

  hero: {
    backgroundColor: Palette.primary,
    borderRadius: 20,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  heroLeft: { flex: 1, gap: Spacing.xs },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  white: { color: Palette.white },
  dimWhite: { color: 'rgba(255,255,255,0.7)' },
  momChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
  },
  ringCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  ringValue: { color: Palette.white },
  heroDivider: { height: 0.5, backgroundColor: 'rgba(255,255,255,0.25)' },
  heroStats: { flexDirection: 'row', justifyContent: 'space-between' },
  heroStat: { gap: 2, flex: 1 },

  emptyBtn: { marginTop: Spacing.sm },

  modalRoot: { flex: 1, backgroundColor: Palette.bgBase },
  modalSafe: { flex: 1 },
});
