import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { sheetPresentation } from '@/components/modal-presentation';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, Icon } from '@/components/ui';
import { Palette, Radius, ScreenPadding, Spacing } from '@/constants/theme';
import { computeRisk, ddayBadge, won, type RiskInfo } from '@/features/membership/dashboard';
import { MembershipDetail } from '@/features/membership/MembershipDetail';
import type { PortfolioValue } from '@/features/membership/portfolio';
import { buildPortfolioItems } from '@/features/membership/PortfolioView';
import { useMemberships, type Membership } from '@/features/membership/useMemberships';
import { useMonthlyStats } from '@/features/membership/useMonthlyStats';

type DetailState = {
  m: Membership;
  risk: RiskInfo;
  monthlyVisits: number;
  value: PortfolioValue;
} | null;

/** 전체 회원권 목록(간략) 모달 → 항목 선택 시 세부 정보(MembershipDetail) 모달. */
export function MembershipListModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { data: memberships } = useMemberships();
  const { data: stats } = useMonthlyStats();
  const [detail, setDetail] = useState<DetailState>(null);

  const list = memberships ?? [];
  const visitsOf = (id: string) => stats?.byMembership[id] ?? 0;
  const valueById = new Map(buildPortfolioItems(list).map((it) => [it.m.id, it.value]));
  // 최신 등록순
  const sorted = [...list].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
  );

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle={sheetPresentation}
        onRequestClose={onClose}>
        <ThemedView style={styles.root}>
          <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <View style={styles.header}>
              <ThemedText type="h2">전체 회원권</ThemedText>
              <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="닫기">
                <Icon icon={X} size={24} color={Palette.gray500} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
              {sorted.length === 0 ? (
                <Card>
                  <ThemedText type="caption" themeColor="textSecondary">
                    아직 등록된 회원권이 없어요.
                  </ThemedText>
                </Card>
              ) : null}

              {/* 간략 정보: 이름 · D-day · 회당/활용도 */}
              {sorted.map((m) => {
                const risk = computeRisk(m, visitsOf(m.id));
                const value = valueById.get(m.id)!;
                const { label, color } = ddayBadge(risk);
                const pct = Math.min(100, Math.round(value.progressPct));
                const expired = risk.remainingDays <= 0;
                return (
                  <Card
                    key={m.id}
                    style={expired ? styles.expiredCard : undefined}
                    onPress={() => setDetail({ m, risk, monthlyVisits: visitsOf(m.id), value })}>
                    <View style={styles.itemHead}>
                      <ThemedText type="captionBold" numberOfLines={1} style={styles.itemName}>
                        {m.name}
                      </ThemedText>
                      <View style={[styles.dday, { backgroundColor: `${color}1A` }]}>
                        <ThemedText type="label" style={{ color }}>
                          {label}
                        </ThemedText>
                      </View>
                    </View>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {value.perVisitValue > 0 ? `회당 ${won(value.perVisitValue)} · ` : ''}활용도 {pct}%
                    </ThemedText>
                  </Card>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </ThemedView>
      </Modal>

      {/* 세부 정보 — 화면 정중앙 팝업 */}
      <Modal
        visible={!!detail}
        transparent
        animationType="fade"
        onRequestClose={() => setDetail(null)}>
        <View style={styles.popupBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDetail(null)} />
          <View style={styles.popupCard}>
            {detail ? (
              <MembershipDetail
                m={detail.m}
                risk={detail.risk}
                monthlyVisits={detail.monthlyVisits}
                value={detail.value}
                onClose={() => setDetail(null)}
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.bgBase },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: ScreenPadding,
    paddingVertical: Spacing.md,
  },
  list: { paddingHorizontal: ScreenPadding, paddingBottom: Spacing.xl, gap: Spacing.md },
  itemHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  itemName: { flex: 1 },
  expiredCard: { opacity: 0.5 },
  dday: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  // 세부 정보 — 화면 정중앙 팝업
  popupBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  popupCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    backgroundColor: Palette.bgBase,
    borderRadius: Radius.modal,
    overflow: 'hidden',
  },
});
