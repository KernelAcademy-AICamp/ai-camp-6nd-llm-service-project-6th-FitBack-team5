import { Lock, Target, TrendingUp, Wallet } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Icon, ProgressBar } from '@/components/ui';
import { Palette, Spacing } from '@/constants/theme';
import {
  formatNumber,
  RISK_COLORS,
  RISK_META,
  won,
  type RiskInfo,
  type RiskLevel,
  type RiskSummary,
} from '@/features/membership/dashboard';
import type { Membership } from '@/features/membership/useMemberships';

// 진행바 라벨 한 줄 (바 + 우측 라벨).
function LabeledBar({
  ratio,
  color,
  label,
  trackColor,
}: {
  ratio: number;
  color: string;
  label: string;
  trackColor?: string;
}) {
  return (
    <View style={styles.barRow}>
      <View style={styles.barFlex}>
        <ProgressBar ratio={ratio} color={color} trackColor={trackColor} label={label} />
      </View>
      <ThemedText type="label" themeColor="textSecondary" style={styles.barLabel}>
        {label}
      </ThemedText>
    </View>
  );
}

/** §4 회원권 1개 위험 카드 (헤더+위험칩 / 진행바 / 손실·긍정·행동 푸터). */
export function MembershipStatsCard({
  m,
  risk,
  monthlyVisits,
  onPress,
}: {
  m: Membership;
  risk: RiskInfo;
  monthlyVisits: number;
  onPress?: () => void;
}) {
  const color = RISK_COLORS[risk.level];
  const meta = RISK_META[risk.level];
  const expired = risk.remainingDays <= 0;
  const showAction = !expired && (risk.level === 'danger' || risk.level === 'warning');

  return (
    <Card onPress={onPress} accentColor={color}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <ThemedText type="h2">{m.name}</ThemedText>
          {risk.hasSessions ? (
            <ThemedText type="captionBold" themeColor="textSecondary">
              회당 {won(risk.costPerSession)}
            </ThemedText>
          ) : (
            <ThemedText type="caption" themeColor="textSecondary">
              자유이용권
            </ThemedText>
          )}
        </View>
        <Chip
          label={expired ? '만료' : meta.label}
          color={color}
          bg={`${color}1A`}
          icon={meta.icon}
        />
      </View>

      <View style={styles.bars}>
        {risk.hasSessions ? (
          <LabeledBar
            ratio={risk.sessionFilledRatio}
            color={color}
            label={`횟수 ${formatNumber(risk.remainingSessions ?? 0)}/${formatNumber(risk.totalSessions ?? 0)} 남음`}
          />
        ) : null}
        <LabeledBar
          ratio={risk.periodFilledRatio}
          color={color}
          trackColor={Palette.gray50}
          label={expired ? '기간 만료됨' : `기간 ${formatNumber(risk.remainingDays)}일 남음`}
        />
      </View>

      <View style={styles.footer}>
        {risk.hasSessions && risk.valueAtRisk > 0 ? (
          <View style={styles.footRow}>
            <Icon icon={Wallet} size={16} color={expired ? Palette.gray300 : Palette.loss} />
            <ThemedText type="caption" themeColor={expired ? 'textSecondary' : 'text'}>
              못 쓰면 {won(risk.valueAtRisk)} 손실
            </ThemedText>
          </View>
        ) : null}
        <View style={styles.footRow}>
          <Icon icon={TrendingUp} size={16} color={Palette.profit} />
          <ThemedText type="caption">
            이번 달 {formatNumber(monthlyVisits)}회
            {risk.valueUsed > 0 ? ` · 사용가치 ${won(risk.valueUsed)}` : ''}
          </ThemedText>
        </View>
        {showAction && risk.requiredWeeklyPace && risk.requiredWeeklyPace > 0 ? (
          <View style={styles.footRow}>
            <Icon icon={Target} size={16} color={color} />
            <ThemedText type="caption" style={{ color }}>
              주 {formatNumber(risk.requiredWeeklyPace)}회 가면 만료 전 다 쓸 수 있어요
            </ThemedText>
          </View>
        ) : null}
        {!expired && risk.level === 'safe' ? (
          <View style={styles.footRow}>
            <Icon icon={TrendingUp} size={16} color={color} />
            <ThemedText type="caption" style={{ color }}>
              페이스 좋아요, 이대로면 충분해요
            </ThemedText>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function RatioBarStack({ summary }: { summary: RiskSummary }) {
  const seg = (n: number, level: RiskLevel) =>
    n > 0 ? <View key={level} style={{ flex: n, backgroundColor: RISK_COLORS[level] }} /> : null;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`위험 ${summary.danger}개, 주의 ${summary.warning}개, 일반 ${
        summary.neutral + summary.safe
      }개`}
      style={styles.ratioBar}>
      {seg(summary.danger, 'danger')}
      {seg(summary.warning, 'warning')}
      {seg(summary.safe, 'safe')}
      {seg(summary.neutral, 'neutral')}
    </View>
  );
}

function SummaryChip({ level, n }: { level: RiskLevel; n: number }) {
  const meta = RISK_META[level];
  const color = RISK_COLORS[level];
  return <Chip label={`${meta.label} ${formatNumber(n)}`} color={color} bg={`${color}1A`} icon={meta.icon} />;
}

/**
 * §4-A 요약 헤더. 살릴 수 있는 금액(히어로) / 이미 잃은 금액(회색) / 사용가치(긍정) 분리 + 1순위 CTA.
 */
export function SummaryHeader({
  summary,
  count,
  onGoCenter,
}: {
  summary: RiskSummary;
  count: number;
  onGoCenter?: () => void;
}) {
  const allSafe = summary.danger === 0 && summary.warning === 0;
  return (
    <Card elevated>
      <View style={styles.sumHead}>
        <ThemedText type="h2">내 회원권 {formatNumber(count)}개</ThemedText>
        <View style={styles.sumChips}>
          {summary.danger > 0 ? <SummaryChip level="danger" n={summary.danger} /> : null}
          {summary.warning > 0 ? <SummaryChip level="warning" n={summary.warning} /> : null}
          {summary.safe > 0 ? <SummaryChip level="safe" n={summary.safe} /> : null}
          {summary.neutral > 0 ? <SummaryChip level="neutral" n={summary.neutral} /> : null}
        </View>
      </View>

      {count > 1 ? <RatioBarStack summary={summary} /> : null}

      {allSafe ? (
        <View style={styles.heroBlock}>
          <View style={styles.footRow}>
            <Icon icon={TrendingUp} size={20} color={Palette.profit} />
            <ThemedText type="h2" style={{ color: Palette.profit }}>
              모든 회원권 페이스 양호
            </ThemedText>
          </View>
        </View>
      ) : (
        <View style={styles.heroBlock}>
          <ThemedText type="caption" themeColor="textSecondary">
            지금 가면 살릴 수 있는 금액
          </ThemedText>
          <ThemedText type="display" style={{ color: Palette.loss }}>
            {won(summary.recoverable)}
          </ThemedText>
        </View>
      )}

      {summary.lost > 0 ? (
        <View style={styles.footRow}>
          <Icon icon={Lock} size={16} color={Palette.gray500} />
          <ThemedText type="caption" themeColor="textSecondary">
            이미 만료 · {won(summary.lost)} (복구 불가)
          </ThemedText>
        </View>
      ) : null}
      {summary.valueUsedThisMonth > 0 ? (
        <View style={styles.footRow}>
          <Icon icon={TrendingUp} size={16} color={Palette.profit} />
          <ThemedText type="caption" style={{ color: Palette.profit }}>
            이번 달 사용가치 {won(summary.valueUsedThisMonth)}
          </ThemedText>
        </View>
      ) : null}

      {onGoCenter ? (
        <Button
          label={
            summary.topPriorityName
              ? `센터 가기 · ${summary.topPriorityName}부터 주 ${formatNumber(summary.topPriorityPace ?? 0)}회`
              : '센터 가기'
          }
          onPress={onGoCenter}
          style={styles.cta}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  headerLeft: { flex: 1, gap: 2 },
  bars: { gap: Spacing.sm, marginTop: Spacing.sm },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  barFlex: { flex: 1 },
  barLabel: { minWidth: 96, textAlign: 'right' },
  footer: { gap: Spacing.xs, marginTop: Spacing.md },
  footRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },

  sumHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  sumChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  ratioBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: Palette.gray100,
    marginTop: Spacing.md,
  },
  heroBlock: { marginTop: Spacing.md, gap: 2 },
  cta: { marginTop: Spacing.md },
});
