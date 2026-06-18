import { Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, Icon } from '@/components/ui';
import { Palette, Radius, ScreenPadding, Spacing } from '@/constants/theme';
import { computeRisk, sortByRisk, type RiskInfo } from '@/features/membership/dashboard';
import { MembershipDetail } from '@/features/membership/MembershipDetail';
import { MembershipForm } from '@/features/membership/MembershipForm';
import { MembershipStatsCard } from '@/features/membership/MembershipStatsCard';
import { useMemberships, type Membership } from '@/features/membership/useMemberships';
import { useMonthlyStats } from '@/features/membership/useMonthlyStats';

/** 등록 회원권 전체보기 / 관리 (홈 '전체보기' 모달). 명세 §7. 만료 임박순. */
export function MembershipManage({ onClose, startAdd = false }: { onClose: () => void; startAdd?: boolean }) {
  const { data: memberships, isLoading, isError, error } = useMemberships();
  const { data: stats } = useMonthlyStats();
  const [showForm, setShowForm] = useState(startAdd);
  const [detail, setDetail] = useState<{ m: Membership; risk: RiskInfo; monthlyVisits: number } | null>(null);

  const list = memberships ?? [];
  const visitsOf = (id: string) => stats?.byMembership[id] ?? 0;
  const withRisk = list.map((m) => ({ m, risk: computeRisk(m, visitsOf(m.id)), visits: visitsOf(m.id) }));
  const sorted = sortByRisk(withRisk, (x) => x.risk); // 만료 임박/위험순
  const isEmpty = !isLoading && !isError && list.length === 0;

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <ThemedText type="h2">내 회원권</ThemedText>
        <View style={styles.topRight}>
          <Pressable
            onPress={() => setShowForm(true)}
            style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
            accessibilityRole="button">
            <Icon icon={Plus} size={16} color={Palette.white} />
            <ThemedText type="label" style={styles.addButtonLabel}>
              추가
            </ThemedText>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="닫기">
            <Icon icon={X} size={22} color={Palette.gray500} />
          </Pressable>
        </View>
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
              오른쪽 위 “추가”로 첫 회원권을 등록해 보세요.
            </ThemedText>
          </Card>
        )}

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

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <ThemedView style={styles.modalRoot}>
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            <MembershipForm onClose={() => setShowForm(false)} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ScreenPadding,
    paddingVertical: Spacing.md,
  },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
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
  list: { paddingHorizontal: ScreenPadding, paddingBottom: Spacing.xl, gap: Spacing.md },
  stateBox: { paddingVertical: Spacing.xl, alignItems: 'center' },
  stateCard: { gap: Spacing.xs },
  modalRoot: { flex: 1, backgroundColor: Palette.bgBase },
  modalSafe: { flex: 1 },
});
