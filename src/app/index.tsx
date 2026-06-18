import { Bell, CalendarDays, Menu, Sparkles, TriangleAlert, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, Icon } from '@/components/ui';
import { BottomTabInset, MaxContentWidth, Palette, Radius, ScreenPadding, Spacing } from '@/constants/theme';
import { MyDrawer } from '@/features/auth/MyDrawer';
import { MonthCalendar } from '@/features/home/MonthCalendar';
import { CheckInFlow } from '@/features/membership/CheckInFlow';
import { computeRisk, summarize, type RiskInfo } from '@/features/membership/dashboard';
import { MembershipDetail } from '@/features/membership/MembershipDetail';
import { MembershipManage } from '@/features/membership/MembershipManage';
import { buildPortfolioItems, MembershipPortfolioCard, PortfolioHero, type PortfolioItem } from '@/features/membership/PortfolioView';
import { useCoach } from '@/features/membership/useCoach';
import { daysUntil, useMemberships, type Membership } from '@/features/membership/useMemberships';
import { useMonthlyStats } from '@/features/membership/useMonthlyStats';
import { useVisitPattern } from '@/features/membership/useVisitPattern';

/** AI 코치 한 줄(말풍선 + 마스코트 자리). 비대화(명세: 말풍선만). */
function CoachBubble({ text }: { text: string }) {
  return (
    <View style={styles.bubbleRow}>
      <View style={styles.bubble}>
        <View style={styles.bubbleHead}>
          <Icon icon={Sparkles} size={13} color={Palette.primary} />
          <ThemedText type="label" style={{ color: Palette.primary }}>
            AI 코치
          </ThemedText>
        </View>
        <ThemedText type="caption">{text}</ThemedText>
      </View>
    </View>
  );
}

/** 알림 모달 — 만료 D-7 회원권 + 예정 일정(현재 없음). 명세 §4. */
function AlarmModal({ expiring, onClose }: { expiring: Membership[]; onClose: () => void }) {
  return (
    <View style={styles.alarmRoot}>
      <View style={styles.topBar}>
        <ThemedText type="h2">알림</ThemedText>
        <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="닫기">
          <Icon icon={X} size={22} color={Palette.gray500} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.alarmBody}>
        {expiring.length === 0 ? (
          <ThemedText type="caption" themeColor="textSecondary">
            새로운 알림이 없어요.
          </ThemedText>
        ) : (
          expiring.map((m) => (
            <Card key={m.id} accentColor={Palette.warning}>
              <View style={styles.alarmItem}>
                <Icon icon={TriangleAlert} size={16} color={Palette.warning} />
                <ThemedText type="caption">
                  {m.name} · 만료 D-{Math.max(0, daysUntil(m.endDate))}
                </ThemedText>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

/** 홈 = 회원권 활용도 통합 대시보드 (명세 v1.0 / UX Flow v2). */
export default function HomeScreen() {
  const { data: memberships, isLoading } = useMemberships();
  const { data: stats } = useMonthlyStats();
  const { data: visitPattern } = useVisitPattern();
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showMy, setShowMy] = useState(false);
  const [showAlarm, setShowAlarm] = useState(false);
  const [showManage, setShowManage] = useState<{ add: boolean } | null>(null);
  const [detail, setDetail] = useState<{ m: Membership; risk: RiskInfo; monthlyVisits: number } | null>(null);

  const list = memberships ?? [];
  const visitsOf = (id: string) => stats?.byMembership[id] ?? 0;
  const withRisk = list.map((m) => ({ m, risk: computeRisk(m, visitsOf(m.id)), visits: visitsOf(m.id) }));
  const summary = summarize(withRisk.map((x) => ({ risk: x.risk, monthlyVisits: x.visits, name: x.m.name })));
  const items = buildPortfolioItems(list);
  const expiring = list.filter((m) => m.status === 'expiring').sort((a, b) => daysUntil(a.endDate) - daysUntil(b.endDate));

  const coach = useCoach({ withRisk, summary, monthly: stats, pattern: visitPattern });

  function handleCheckIn() {
    if (list.length === 0) {
      const msg = '먼저 회원권을 등록해 주세요.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('회원권 출석', msg);
      return;
    }
    setShowCheckIn(true);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* 글로벌 상단바: ☰ 마이 · 제목 · 📅 캘린더 · 🔔 알림 */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Pressable onPress={() => setShowMy(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="마이 메뉴">
                <Icon icon={Menu} size={22} color={Palette.gray900} />
              </Pressable>
              <ThemedText type="h1">회원권 활용도</ThemedText>
            </View>
            <View style={styles.headerIcons}>
              <Pressable onPress={() => setShowCalendar(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="일정 캘린더">
                <Icon icon={CalendarDays} size={22} color={Palette.gray500} />
              </Pressable>
              <Pressable onPress={() => setShowAlarm(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="알림">
                <View>
                  <Icon icon={Bell} size={22} color={expiring.length > 0 ? Palette.gray900 : Palette.gray300} />
                  {expiring.length > 0 ? <View style={styles.dot} /> : null}
                </View>
              </Pressable>
            </View>
          </View>

          {/* 알림 배너 — 만료 D-7 있으면 노출(없으면 비활성) */}
          {expiring.length > 0 ? (
            <Pressable onPress={() => setShowAlarm(true)} style={({ pressed }) => [styles.banner, pressed && styles.pressed]}>
              <Icon icon={TriangleAlert} size={16} color={Palette.white} />
              <ThemedText type="captionBold" style={styles.bannerText}>
                {expiring[0].name} 만료 D-{Math.max(0, daysUntil(expiring[0].endDate))}
              </ThemedText>
            </Pressable>
          ) : null}

          {/* AI 코치 말풍선 */}
          {list.length > 0 && coach.data ? <CoachBubble text={coach.data.action} /> : null}

          {/* 요약 헤더(히어로) */}
          {list.length > 0 ? (
            <PortfolioHero items={items} onCta={handleCheckIn} />
          ) : !isLoading ? (
            <Card>
              <ThemedText type="body">회원권을 등록하면 본전 회수가 시작돼요.</ThemedText>
              <Button label="회원권 등록하기" onPress={() => setShowManage({ add: true })} style={styles.emptyBtn} />
            </Card>
          ) : null}

          {/* 등록된 회원권 */}
          {list.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <ThemedText type="captionBold">등록된 회원권</ThemedText>
                <Pressable onPress={() => setShowManage({ add: false })} hitSlop={8} accessibilityRole="button">
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

      <Modal visible={showMy} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowMy(false)}>
        <ThemedView style={styles.modalRoot}>
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            <MyDrawer onClose={() => setShowMy(false)} />
          </SafeAreaView>
        </ThemedView>
      </Modal>

      <Modal visible={showAlarm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAlarm(false)}>
        <ThemedView style={styles.modalRoot}>
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            <AlarmModal expiring={expiring} onClose={() => setShowAlarm(false)} />
          </SafeAreaView>
        </ThemedView>
      </Modal>

      <Modal visible={!!showManage} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowManage(null)}>
        <ThemedView style={styles.modalRoot}>
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            {showManage ? <MembershipManage startAdd={showManage.add} onClose={() => setShowManage(null)} /> : null}
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  dot: { position: 'absolute', top: -1, right: -1, width: 7, height: 7, borderRadius: 4, backgroundColor: Palette.warning },
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
  pressed: { opacity: 0.8 },
  bubbleRow: { flexDirection: 'row' },
  bubble: { flex: 1, gap: 4, backgroundColor: Palette.primaryLight, borderRadius: Radius.card, padding: Spacing.md },
  bubbleHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  emptyBtn: { marginTop: Spacing.sm },
  section: { gap: Spacing.sm },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alarmRoot: { flex: 1 },
  alarmBody: { paddingHorizontal: ScreenPadding, paddingBottom: Spacing.xl, gap: Spacing.sm },
  alarmItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: ScreenPadding, paddingVertical: Spacing.md },
  modalRoot: { flex: 1, backgroundColor: Palette.bgBase },
  modalSafe: { flex: 1 },
});
