import { router } from 'expo-router';
import { Bell, CalendarDays, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, Icon } from '@/components/ui';
import { BottomTabInset, MaxContentWidth, Palette, Radius, ScreenPadding, Spacing } from '@/constants/theme';
import { computeRisk, summarize, type RiskInfo } from '@/features/membership/dashboard';
import { MembershipDetail } from '@/features/membership/MembershipDetail';
import { buildPortfolioItems, MembershipPortfolioCard, PortfolioHero, type PortfolioItem } from '@/features/membership/PortfolioView';
import { CheckInFlow } from '@/features/membership/CheckInFlow';
import { MonthCalendar } from '@/features/home/MonthCalendar';
import { useCoach } from '@/features/membership/useCoach';
import { useMemberships, type Membership } from '@/features/membership/useMemberships';
import { useMonthlyStats } from '@/features/membership/useMonthlyStats';
import { useVisitPattern } from '@/features/membership/useVisitPattern';

/** AI 코치 한 줄(말풍선) — coach Edge Function 결과의 action. */
function CoachBubble({ text }: { text: string }) {
  return (
    <View style={styles.bubble}>
      <View style={styles.bubbleHead}>
        <Icon icon={Sparkles} size={13} color={Palette.primary} />
        <ThemedText type="label" style={{ color: Palette.primary }}>
          AI 코치
        </ThemedText>
      </View>
      <ThemedText type="caption">{text}</ThemedText>
    </View>
  );
}

/** 홈 = 회원권 활용도 통합 화면 (명세 v1.1 / 시안). */
export default function HomeScreen() {
  const { data: memberships, isLoading } = useMemberships();
  const { data: stats } = useMonthlyStats();
  const { data: visitPattern } = useVisitPattern();
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [detail, setDetail] = useState<{ m: Membership; risk: RiskInfo; monthlyVisits: number } | null>(null);

  const list = memberships ?? [];
  const visitsOf = (id: string) => stats?.byMembership[id] ?? 0;
  const withRisk = list.map((m) => ({ m, risk: computeRisk(m, visitsOf(m.id)), visits: visitsOf(m.id) }));
  const summary = summarize(withRisk.map((x) => ({ risk: x.risk, monthlyVisits: x.visits, name: x.m.name })));
  const items = buildPortfolioItems(list);

  const coach = useCoach({ withRisk, summary, monthly: stats, pattern: visitPattern });

  function handleCheckIn() {
    if (list.length === 0) {
      const msg = '먼저 회원권을 등록해 주세요.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('체크인', msg);
      return;
    }
    setShowCheckIn(true);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* 헤더 */}
          <View style={styles.header}>
            <ThemedText type="h1">회원권 활용도</ThemedText>
            <View style={styles.headerIcons}>
              <Pressable onPress={() => setShowCalendar(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="기록 캘린더">
                <Icon icon={CalendarDays} size={22} color={Palette.gray500} />
              </Pressable>
              <Icon icon={Bell} size={22} color={Palette.gray300} />
            </View>
          </View>

          {/* 알림 영역 — 체크인 아님(체크인은 '회원권 활용하기'에서만). */}
          {list.length > 0 ? (
            <View style={styles.banner}>
              <Icon icon={Bell} size={16} color={Palette.white} />
              <ThemedText type="caption" style={styles.bannerText}>
                새로운 알림이 없어요
              </ThemedText>
            </View>
          ) : null}

          {/* AI 코치 한 줄 */}
          {list.length > 0 && coach.data ? <CoachBubble text={coach.data.action} /> : null}

          {/* 히어로(요약) */}
          {list.length > 0 ? (
            <PortfolioHero items={items} onCta={handleCheckIn} />
          ) : !isLoading ? (
            <Card>
              <ThemedText type="body">회원권을 등록하면 본전 회수가 시작돼요.</ThemedText>
              <Button label="회원권 등록하기" onPress={() => router.navigate('/membership')} style={styles.emptyBtn} />
            </Card>
          ) : null}

          {/* 등록된 회원권 */}
          {list.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <ThemedText type="captionBold">등록된 회원권</ThemedText>
                <Pressable onPress={() => router.navigate('/membership')} hitSlop={8} accessibilityRole="button">
                  <ThemedText type="label" themeColor="textSecondary">
                    전체보기
                  </ThemedText>
                </Pressable>
              </View>
              {items.map((it: PortfolioItem) => (
                <MembershipPortfolioCard
                  key={it.m.id}
                  item={it}
                  onPress={() =>
                    setDetail({ m: it.m, risk: computeRisk(it.m, visitsOf(it.m.id)), monthlyVisits: visitsOf(it.m.id) })
                  }
                />
              ))}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      <Modal visible={showCheckIn} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCheckIn(false)}>
        <ThemedView style={styles.modalRoot}>
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            <CheckInFlow memberships={list} onClose={() => setShowCheckIn(false)} />
          </SafeAreaView>
        </ThemedView>
      </Modal>

      <Modal visible={showCalendar} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCalendar(false)}>
        <ThemedView style={styles.modalRoot}>
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            <MonthCalendar onClose={() => setShowCalendar(false)} />
          </SafeAreaView>
        </ThemedView>
      </Modal>

      <Modal visible={!!detail} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetail(null)}>
        <ThemedView style={styles.modalRoot}>
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            {detail ? (
              <MembershipDetail m={detail.m} risk={detail.risk} monthlyVisits={detail.monthlyVisits} onClose={() => setDetail(null)} />
            ) : null}
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
  body: { gap: Spacing.md, paddingBottom: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.gray900,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.card,
  },
  bannerText: { color: Palette.white, flex: 1 },
  bubble: {
    gap: 4,
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.card,
    padding: Spacing.md,
  },
  bubbleHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  emptyBtn: { marginTop: Spacing.sm },
  section: { gap: Spacing.sm },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalRoot: { flex: 1, backgroundColor: Palette.bgBase },
  modalSafe: { flex: 1 },
});
