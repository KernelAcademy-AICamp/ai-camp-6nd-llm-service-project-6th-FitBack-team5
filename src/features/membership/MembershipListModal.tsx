import { Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { sheetPresentation } from '@/components/modal-presentation';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, Icon } from '@/components/ui';
import { Palette, Radius, ScreenPadding, Spacing } from '@/constants/theme';
import { CheckInFlow } from '@/features/membership/CheckInFlow';
import { computeRisk, ddayBadge, won, type RiskInfo } from '@/features/membership/dashboard';
import { MembershipDetail } from '@/features/membership/MembershipDetail';
import { MembershipForm } from '@/features/membership/MembershipForm';
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
  const [showForm, setShowForm] = useState(false);
  const [checkInId, setCheckInId] = useState<string | null>(null); // 지금 출석하기 대상 회원권

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
              <View style={styles.headerRight}>
                <Pressable
                  onPress={() => setShowForm(true)}
                  style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="회원권 추가">
                  <Icon icon={Plus} size={16} color={Palette.white} />
                  <ThemedText type="captionBold" style={styles.addButtonLabel}>
                    회원권 추가
                  </ThemedText>
                </Pressable>
                <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="닫기">
                  <Icon icon={X} size={24} color={Palette.gray500} />
                </Pressable>
              </View>
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
                    {!expired ? (
                      <Button
                        label="지금 출석하기"
                        variant="secondary"
                        onPress={() => setCheckInId(m.id)}
                        style={styles.checkInBtn}
                      />
                    ) : null}
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

      {/* 회원권 등록 모달 (기존 폼 구조·UI 그대로) */}
      <Modal
        visible={showForm}
        animationType="slide"
        presentationStyle={sheetPresentation}
        onRequestClose={() => setShowForm(false)}>
        <ThemedView style={styles.root}>
          <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <MembershipForm onClose={() => setShowForm(false)} />
          </SafeAreaView>
        </ThemedView>
      </Modal>

      {/* 지금 출석하기 — 선택 회원권으로 센터가기 건너뛰고 준비물부터 */}
      <Modal
        visible={!!checkInId}
        animationType="slide"
        presentationStyle={sheetPresentation}
        onRequestClose={() => setCheckInId(null)}>
        <ThemedView style={styles.root}>
          <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            {checkInId ? (
              <CheckInFlow
                memberships={list}
                initialMembershipId={checkInId}
                onClose={() => {
                  setCheckInId(null);
                  onClose(); // 출석 완료(홈으로) → 목록 모달도 닫아 홈으로 복귀
                }}
              />
            ) : null}
          </SafeAreaView>
        </ThemedView>
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
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
  itemHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  itemName: { flex: 1 },
  checkInBtn: { marginTop: Spacing.sm },
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
