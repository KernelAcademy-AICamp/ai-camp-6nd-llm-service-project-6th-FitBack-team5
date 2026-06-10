import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  breakEvenColor,
  breakEvenRemaining,
  daysLeft,
  partLabel,
  perVisitCost,
} from '@/features/membership/dashboard';
import type {
  Membership,
  MembershipStatus,
  MembershipType,
} from '@/features/membership/useMemberships';
import { useMonthlyStats, type MonthlyStats } from '@/features/membership/useMonthlyStats';

const TYPE_LABELS: Record<MembershipType, string> = {
  free: '자유이용권',
  session: '세션권',
  class: '예약권',
};

const STATUS_LABELS: Record<MembershipStatus, string> = {
  active: '사용중',
  expired: '만료',
};

function statusBadgeColor(status: MembershipStatus) {
  return status === 'active' ? '#22c55e' : '#9ca3af';
}

function won(n: number): string {
  return `₩${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function motivation(stats?: MonthlyStats): string {
  if (!stats || stats.visitCount === 0) return '이번 달 첫 방문을 시작해 보세요! 💪';
  if (stats.byPart.length >= 2) {
    const top = stats.byPart[0];
    const bottom = stats.byPart[stats.byPart.length - 1];
    if (top.count - bottom.count >= 3) {
      return `${partLabel(bottom.part)} 운동이 부족해요. 다음엔 ${partLabel(bottom.part)} 어때요?`;
    }
  }
  return `이번 달 ${stats.visitCount}회 방문 중! 잘하고 있어요 👍`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="small" style={styles.statLabel}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

/** 회원권 1개의 현황 카드 (주식 종목별 현황처럼 카드마다 독립 통계). */
export function SummaryCard({ m }: { m: Membership }) {
  const remaining = breakEvenRemaining(m);
  const per = perVisitCost(m);
  const left = daysLeft(m.endDate);
  const color = breakEvenColor(remaining);
  const showVisits = m.type !== 'free';
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.rowBetween}>
        <ThemedText type="subtitle">{m.name}</ThemedText>
        <View style={[styles.badge, { backgroundColor: statusBadgeColor(m.status) }]}>
          <ThemedText type="smallBold" style={styles.badgeText}>
            {STATUS_LABELS[m.status]}
          </ThemedText>
        </View>
      </View>

      <View style={styles.metaRow}>
        <ThemedText type="small" style={styles.meta}>
          {TYPE_LABELS[m.type]}
        </ThemedText>
        {showVisits ? (
          <ThemedText type="small" style={styles.meta}>
            {m.maxVisits != null ? `남은 ${m.remainingVisits}/${m.maxVisits}회` : '무제한'}
          </ThemedText>
        ) : null}
        <ThemedText type="small" style={styles.meta}>
          만료 {m.endDate}
        </ThemedText>
      </View>

      <View style={styles.statRow}>
        <Stat label="정비용" value={won(m.cost)} />
        <Stat label="남은 기간" value={left >= 0 ? `${left}일` : '만료'} />
        <Stat label="회당 비용" value={per != null ? won(per) : '—'} />
      </View>

      <View style={[styles.breakEven, { backgroundColor: `${color}22` }]}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <ThemedText type="smallBold">
          {remaining <= 0 ? '회원권 활용 달성! 🎉' : `회원권 활용까지 ${remaining}회`}
        </ThemedText>
      </View>
    </ThemedView>
  );
}

function StatsCard({ stats }: { stats?: MonthlyStats }) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">이번 달 통계</ThemedText>
      <ThemedText type="default">방문 {stats?.visitCount ?? 0}회</ThemedText>
      {stats && stats.byPart.length > 0 ? (
        <View style={styles.partRow}>
          {stats.byPart.map((p) => (
            <View key={p.part} style={styles.partChip}>
              <ThemedText type="small">
                {partLabel(p.part)} {p.count}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}
      <ThemedText type="small" style={styles.motivation}>
        {motivation(stats)}
      </ThemedText>
    </ThemedView>
  );
}

/** 대시보드 상단: 이번달 통계(전체) + 센터 가기. 회원권별 현황은 SummaryCard로 목록에 표시. */
export function HomeDashboard({ onGoCenter }: { onGoCenter: () => void }) {
  const { data: stats } = useMonthlyStats();
  return (
    <View style={styles.wrap}>
      <StatsCard stats={stats} />
      <Pressable
        onPress={onGoCenter}
        style={({ pressed }) => [styles.centerBtn, pressed && styles.centerBtnPressed]}>
        <ThemedText type="subtitle" style={styles.centerBtnLabel}>
          🏃 센터 가기
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  card: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.two },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: Spacing.two },
  badgeText: { color: '#fff' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  meta: { opacity: 0.7 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.one },
  stat: { gap: 2 },
  statLabel: { opacity: 0.6 },
  breakEven: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    marginTop: Spacing.one,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  partRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
  partChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.35)',
  },
  motivation: { opacity: 0.8, marginTop: Spacing.one },
  centerBtn: {
    backgroundColor: '#22c55e',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.four,
    alignItems: 'center',
  },
  centerBtnPressed: { opacity: 0.85 },
  centerBtnLabel: { color: '#fff' },
});
