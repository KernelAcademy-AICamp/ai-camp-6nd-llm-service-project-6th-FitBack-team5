import { CalendarClock, Dumbbell, TrendingUp } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Icon } from '@/components/ui';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { formatNumber, won } from '@/features/membership/dashboard';
import {
  computePortfolio,
  STAGE_MARKERS,
  summarizePortfolio,
  weeksBetween,
  type PortfolioValue,
} from '@/features/membership/portfolio';
import { daysUntil, type Membership } from '@/features/membership/useMemberships';

export interface PortfolioItem {
  m: Membership;
  value: PortfolioValue;
  expired: boolean;
}

/** 회원권 목록 → 종류별 목표 회수 지표. */
export function buildPortfolioItems(memberships: Membership[]): PortfolioItem[] {
  return memberships.map((m) => {
    const totalWeeks = weeksBetween(m.startDate, m.endDate);
    const value = computePortfolio({
      type: m.type,
      principal: m.cost,
      visitCount: m.usedVisits,
      totalSessions: m.maxVisits,
      weeklyGoal: m.weeklyGoal,
      totalWeeks,
    });
    return { m, value, expired: m.status === 'expired' };
  });
}

/** "오늘 체크인으로 +N원 UP" — 가장 급한(만료 임박) 활성 회원권의 회당 가치. */
export function todayGain(items: PortfolioItem[]): number {
  const active = items.filter((x) => !x.expired && !x.value.isComplete);
  if (active.length === 0) return 0;
  const top = active.sort((a, b) => daysUntil(a.m.endDate) - daysUntil(b.m.endDate))[0];
  return top.value.perVisitValue;
}

// ── 히어로(요약) ──────────────────────────────────────────
export function PortfolioHero({
  items,
  onCta,
}: {
  items: PortfolioItem[];
  onCta: () => void;
}) {
  const summary = summarizePortfolio(items.map((x) => ({ value: x.value, expired: x.expired })));
  const gain = todayGain(items);
  const principal = items.filter((x) => !x.expired).reduce((s, x) => s + x.m.cost, 0);
  const pct = Math.min(100, Math.round(summary.progressPct));

  return (
    <Card style={styles.hero}>
      <View style={styles.heroTop}>
        <View style={styles.heroLeft}>
          {gain > 0 ? (
            <View style={styles.gainChip}>
              <Icon icon={TrendingUp} size={12} color={Palette.primary} />
              <ThemedText type="label" style={{ color: Palette.primary }}>
                오늘 체크인으로 {won(gain)} UP
              </ThemedText>
            </View>
          ) : null}
          <ThemedText type="display">{won(summary.recovered)}</ThemedText>
        </View>
        {/* 캐릭터 일러스트 자리(구현 불가) → 아이콘 플레이스홀더 */}
        <View style={styles.mascot}>
          <Icon icon={Dumbbell} size={28} color={Palette.primary} />
        </View>
      </View>

      {/* 활용도 진행 바 + 25/50/75 마커 */}
      <View style={styles.barRow}>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${pct}%` }]} />
          {STAGE_MARKERS.slice(0, 3).map((mk) => (
            <View key={mk} style={[styles.marker, { left: `${mk}%` }]} />
          ))}
          <ThemedText type="label" style={styles.barLabel}>
            활용도
          </ThemedText>
        </View>
        <ThemedText type="captionBold" style={styles.pct}>
          {pct}%
        </ThemedText>
      </View>

      {/* 총 회수 / 남은 금액 / 원금 */}
      <View style={styles.stats}>
        <Stat label="총 회수" value={won(summary.recovered)} />
        <Stat label="남은 금액" value={won(summary.remaining)} />
        <Stat label="원금" value={won(principal)} />
      </View>

      <Button label="회원권 출석" variant="secondary" onPress={onCta} style={styles.cta} />
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="label" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="captionBold">{value}</ThemedText>
    </View>
  );
}

// ── 회원권 카드(스택) ─────────────────────────────────────
export function MembershipPortfolioCard({ item, onPress }: { item: PortfolioItem; onPress?: () => void }) {
  const { m, value, expired } = item;
  const d = daysUntil(m.endDate);
  const expiring = !expired && m.status === 'expiring';
  const isSession = m.type === 'session';

  // 한 줄 상태: 인세권=소멸 임박 금액 / 기간권=목표까지 남은(정체) 금액
  const line = expired
    ? '시즌 종료'
    : isSession
      ? `${formatNumber(m.remainingVisits ?? 0)}회 안 쓰면 ${won((m.remainingVisits ?? 0) * value.perVisitValue)} 소멸`
      : `이번 목표까지 ${won(value.remaining)} (정체)`;
  const pct = Math.min(100, Math.round(value.progressPct));

  return (
    <Card onPress={onPress} accentColor={expiring ? Palette.warning : expired ? Palette.gray300 : Palette.primary}>
      <View style={styles.cardHead}>
        <View style={styles.badges}>
          <View style={styles.typeBadge}>
            <ThemedText type="label" style={{ color: Palette.primary }}>
              {isSession ? '인세권' : '기간권'}
            </ThemedText>
          </View>
          {expired ? (
            <View style={[styles.dBadge, { backgroundColor: Palette.gray100 }]}>
              <ThemedText type="label" themeColor="textSecondary">
                만료
              </ThemedText>
            </View>
          ) : (
            <View style={[styles.dBadge, expiring && { backgroundColor: `${Palette.warning}1A` }]}>
              <Icon icon={CalendarClock} size={11} color={expiring ? Palette.warning : Palette.gray500} />
              <ThemedText type="label" style={{ color: expiring ? Palette.warning : Palette.gray500 }}>
                D-{Math.max(0, d)}
              </ThemedText>
            </View>
          )}
        </View>
      </View>
      <ThemedText type="captionBold" numberOfLines={1}>
        {m.name}
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
        {line}
      </ThemedText>
      <View style={styles.miniTrack}>
        <View style={[styles.miniFill, { width: `${pct}%`, backgroundColor: expired ? Palette.gray300 : Palette.primary }]} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: { gap: Spacing.md },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroLeft: { flex: 1, gap: Spacing.xs },
  gainChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: Palette.primaryLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  mascot: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  barTrack: {
    flex: 1,
    height: 28,
    borderRadius: Radius.small,
    backgroundColor: Palette.gray100,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: Palette.primary, borderRadius: Radius.small },
  marker: { position: 'absolute', top: 4, bottom: 4, width: 1, backgroundColor: 'rgba(0,0,0,0.18)' },
  barLabel: { color: Palette.white, marginLeft: Spacing.sm },
  pct: { minWidth: 44, textAlign: 'right' },
  stats: { flexDirection: 'row', gap: Spacing.sm },
  stat: {
    flex: 1,
    gap: 2,
    padding: Spacing.sm,
    borderRadius: Radius.small,
    backgroundColor: Palette.gray100,
  },
  cta: { marginTop: 2 },

  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  badges: { flexDirection: 'row', gap: Spacing.xs },
  typeBadge: { backgroundColor: Palette.primaryLight, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.small },
  dBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Palette.gray100,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.small,
  },
  miniTrack: { height: 6, borderRadius: 3, backgroundColor: Palette.gray100, overflow: 'hidden', marginTop: Spacing.sm },
  miniFill: { height: '100%', borderRadius: 3 },
});
