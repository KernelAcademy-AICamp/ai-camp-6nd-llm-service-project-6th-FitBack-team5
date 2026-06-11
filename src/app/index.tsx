import { LogOut, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, Icon } from '@/components/ui';
import { BottomTabInset, MaxContentWidth, Palette, Radius, ScreenPadding, Spacing } from '@/constants/theme';
import { CheckInFlow } from '@/features/membership/CheckInFlow';
import { computeRisk, sortByRisk, summarize, type RiskInfo } from '@/features/membership/dashboard';
import { MembershipDetail } from '@/features/membership/MembershipDetail';
import { MembershipForm } from '@/features/membership/MembershipForm';
import { MembershipStatsCard, SummaryHeader } from '@/features/membership/MembershipStatsCard';
import { type Membership, useMemberships } from '@/features/membership/useMemberships';
import { useMonthlyStats } from '@/features/membership/useMonthlyStats';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';

function AuthFooter() {
  const user = useCurrentUser();
  async function handleSignOut() {
    await supabase.auth.signOut();
  }
  return (
    <View style={styles.authFooter}>
      <ThemedText type="caption" themeColor="textSecondary" style={styles.authEmail}>
        {user?.email ?? '(no session)'}
      </ThemedText>
      <Pressable
        onPress={handleSignOut}
        style={({ pressed }) => [styles.authButton, pressed && styles.authButtonPressed]}
        accessibilityRole="button">
        <Icon icon={LogOut} size={16} color={Palette.gray500} />
        <ThemedText type="caption" themeColor="textSecondary">
          로그아웃
        </ThemedText>
      </Pressable>
    </View>
  );
}

export default function MembershipScreen() {
  const { data: memberships, isLoading, isError, error } = useMemberships();
  const { data: stats } = useMonthlyStats();
  const [showForm, setShowForm] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [detail, setDetail] = useState<{
    m: Membership;
    risk: RiskInfo;
    monthlyVisits: number;
  } | null>(null);

  const list = memberships ?? [];
  const visitsOf = (id: string) => stats?.byMembership[id] ?? 0;
  const withRisk = list.map((m) => ({
    m,
    risk: computeRisk(m, visitsOf(m.id)),
    visits: visitsOf(m.id),
  }));
  const sorted = sortByRisk(withRisk, (x) => x.risk); // spec: 위험순 정렬
  const summary = summarize(
    withRisk.map((x) => ({ risk: x.risk, monthlyVisits: x.visits, name: x.m.name })),
  );
  const isEmpty = !isLoading && !isError && list.length === 0;

  function handleGoCenter() {
    if (list.length === 0) {
      const msg = '먼저 회원권을 등록해 주세요.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('센터 가기', msg);
      return;
    }
    setShowCheckIn(true);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.titleRow}>
          <ThemedText type="h1">내 회원권</ThemedText>
          <Pressable
            onPress={() => setShowForm(true)}
            style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
            accessibilityRole="button">
            <Icon icon={Plus} size={18} color={Palette.white} />
            <ThemedText type="captionBold" style={styles.addButtonLabel}>
              회원권 추가
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {/* spec 4-A 요약 헤더: 집계 + 비율막대 + 히어로 금액 + 보조 줄 + 센터 가기 CTA */}
          {!isLoading && !isError && list.length > 0 ? (
            <SummaryHeader summary={summary} count={list.length} onGoCenter={handleGoCenter} />
          ) : null}

          {isLoading && (
            <View style={styles.stateBox}>
              <ActivityIndicator />
            </View>
          )}
          {isError && (
            <Card style={styles.stateCard}>
              <ThemedText type="body">회원권을 불러오지 못했어요.</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {(error as Error)?.message ?? '알 수 없는 오류'}
              </ThemedText>
            </Card>
          )}
          {isEmpty && (
            <Card style={styles.stateCard}>
              <ThemedText type="body">아직 등록된 회원권이 없어요.</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                오른쪽 위 “회원권 추가”로 첫 회원권을 등록해 보세요.
              </ThemedText>
            </Card>
          )}

          {/* 위험순 회원권 카드 */}
          {sorted.map((x) => (
            <MembershipStatsCard
              key={x.m.id}
              m={x.m}
              risk={x.risk}
              monthlyVisits={x.visits}
              onPress={() => setDetail({ m: x.m, risk: x.risk, monthlyVisits: x.visits })}
            />
          ))}
        </ScrollView>

        <AuthFooter />
      </SafeAreaView>

      <Modal
        visible={showForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowForm(false)}>
        <ThemedView style={styles.modalRoot}>
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            <MembershipForm onClose={() => setShowForm(false)} />
          </SafeAreaView>
        </ThemedView>
      </Modal>

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

      <Modal
        visible={!!detail}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetail(null)}>
        <ThemedView style={styles.modalRoot}>
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            {detail ? (
              <MembershipDetail
                m={detail.m}
                risk={detail.risk}
                monthlyVisits={detail.monthlyVisits}
                onClose={() => setDetail(null)}
              />
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
    gap: Spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Palette.primary,
  },
  addButtonPressed: { backgroundColor: Palette.primaryPressed },
  addButtonLabel: { color: Palette.white },
  list: {
    gap: Spacing.md,
    paddingBottom: Spacing.md,
  },
  stateBox: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  stateCard: { gap: Spacing.xs },
  authFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
  authEmail: { flex: 1 },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Palette.lineStrong,
  },
  authButtonPressed: { opacity: 0.6 },
  modalRoot: { flex: 1, backgroundColor: Palette.bgBase },
  modalSafe: { flex: 1 },
});
