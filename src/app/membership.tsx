import { LogOut, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { sheetPresentation } from '@/components/modal-presentation';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, Icon } from '@/components/ui';
import { BottomTabInset, MaxContentWidth, Palette, Radius, ScreenPadding, Spacing } from '@/constants/theme';
import { computeRisk, type RiskInfo } from '@/features/membership/dashboard';
import { MembershipCard } from '@/features/membership/MembershipCard';
import { MembershipDetail } from '@/features/membership/MembershipDetail';
import { MembershipForm } from '@/features/membership/MembershipForm';
import type { PortfolioValue } from '@/features/membership/portfolio';
import { buildPortfolioItems } from '@/features/membership/PortfolioView';
import { useMemberships, type Membership } from '@/features/membership/useMemberships';
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
  const [detail, setDetail] = useState<{
    m: Membership;
    risk: RiskInfo;
    monthlyVisits: number;
    value: PortfolioValue;
  } | null>(null);

  const list = memberships ?? [];
  const visitsOf = (id: string) => stats?.byMembership[id] ?? 0;
  // 활용도 값(목표 75% 회수) — 회원권별로 매핑.
  const valueById = new Map(buildPortfolioItems(list).map((it) => [it.m.id, it.value]));
  // 최신 등록순 정렬 (필터·만료 우선 배치는 개선 항목).
  const sorted = [...list]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    .map((m) => ({ m, risk: computeRisk(m, visitsOf(m.id)), value: valueById.get(m.id)! }));
  const isEmpty = !isLoading && !isError && list.length === 0;

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

          {/* 최신 등록순 활용도 카드 */}
          {sorted.map((x) => (
            <MembershipCard
              key={x.m.id}
              m={x.m}
              risk={x.risk}
              value={x.value}
              onPress={() => setDetail({ m: x.m, risk: x.risk, monthlyVisits: visitsOf(x.m.id), value: x.value })}
            />
          ))}
        </ScrollView>

        <AuthFooter />
      </SafeAreaView>

      <Modal
        visible={showForm}
        animationType="slide"
        presentationStyle={sheetPresentation}
        onRequestClose={() => setShowForm(false)}>
        <ThemedView style={styles.modalRoot}>
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            <MembershipForm onClose={() => setShowForm(false)} />
          </SafeAreaView>
        </ThemedView>
      </Modal>

      <Modal
        visible={!!detail}
        animationType="slide"
        presentationStyle={sheetPresentation}
        onRequestClose={() => setDetail(null)}>
        <ThemedView style={styles.modalRoot}>
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            {detail ? (
              <MembershipDetail
                m={detail.m}
                risk={detail.risk}
                monthlyVisits={detail.monthlyVisits}
                value={detail.value}
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