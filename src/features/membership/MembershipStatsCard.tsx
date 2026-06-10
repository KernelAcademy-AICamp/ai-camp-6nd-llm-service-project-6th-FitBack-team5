import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
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

// spec 보강2: 사용분이 채워지고(fill, 회색), 빈 공간 = 아직 안 쓴 양 = 낭비 위험(트랙=위험색).
function ProgressBar({
  filledRatio,
  label,
  color,
  dim,
}: {
  filledRatio: number;
  label: string;
  color: string;
  dim?: boolean;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, filledRatio)) * 100);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      accessibilityLabel={label}
      style={styles.barBlock}>
      <View style={[styles.track, { backgroundColor: dim ? `${color}1a` : `${color}33` }]}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <ThemedText type="small" style={styles.barLabel}>
        {label}
      </ThemedText>
    </View>
  );
}

/** spec 4장: 회원권 1개 위험 카드 (헤더+위험칩 / 진행바 / 손실·긍정·행동 푸터). */
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

  const card = (
    <ThemedView type="backgroundElement" style={[styles.card, { borderLeftColor: color }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <ThemedText type="subtitle">{m.name}</ThemedText>
          {risk.hasSessions ? (
            <ThemedText type="smallBold" style={styles.perCost}>
              회당 {won(risk.costPerSession)}
            </ThemedText>
          ) : (
            <ThemedText type="small" style={styles.dimText}>
              자유이용권
            </ThemedText>
          )}
        </View>
        <View style={[styles.chip, { backgroundColor: `${color}22` }]}>
          <ThemedText type="smallBold" style={{ color }}>
            {meta.icon} {expired ? '만료' : meta.label}
          </ThemedText>
        </View>
      </View>

      {risk.hasSessions ? (
        <ProgressBar
          filledRatio={risk.sessionFilledRatio}
          color={color}
          label={`횟수 ${formatNumber(risk.remainingSessions ?? 0)}/${formatNumber(risk.totalSessions ?? 0)} 남음`}
        />
      ) : null}
      <ProgressBar
        filledRatio={risk.periodFilledRatio}
        color={color}
        dim
        label={expired ? '기간 만료됨' : `기간 ${formatNumber(risk.remainingDays)}일 남음`}
      />

      <View style={styles.footer}>
        {risk.hasSessions && risk.valueAtRisk > 0 ? (
          <ThemedText type="small" style={expired ? styles.dimText : undefined}>
            💰 못 쓰면 {won(risk.valueAtRisk)} 손실
          </ThemedText>
        ) : null}
        <ThemedText type="small">
          ✅ 이번 달 {formatNumber(monthlyVisits)}회
          {risk.valueUsed > 0 ? ` · 사용가치 ${won(risk.valueUsed)}` : ''}
        </ThemedText>
        {showAction && risk.requiredWeeklyPace && risk.requiredWeeklyPace > 0 ? (
          <ThemedText type="small" style={{ color }}>
            🎯 주 {formatNumber(risk.requiredWeeklyPace)}회 가면 만료 전 다 쓸 수 있어요
          </ThemedText>
        ) : null}
        {!expired && risk.level === 'safe' ? (
          <ThemedText type="small" style={{ color }}>
            👍 페이스 좋아요, 이대로면 충분해요
          </ThemedText>
        ) : null}
      </View>
    </ThemedView>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => (pressed ? styles.cardPressed : undefined)}>
        {card}
      </Pressable>
    );
  }
  return card;
}

function SummaryChip({ level, n }: { level: RiskLevel; n: number }) {
  const meta = RISK_META[level];
  return (
    <View style={[styles.sumChip, { backgroundColor: `${RISK_COLORS[level]}22` }]}>
      <ThemedText type="smallBold" style={{ color: RISK_COLORS[level] }}>
        {meta.icon} {meta.label} {formatNumber(n)}
      </ThemedText>
    </View>
  );
}

/** spec 4-A.3: 위험·주의·일반 비율을 한 줄 가로 스택으로. 바 자체엔 텍스트 없음(칩으로 제공). */
function RatioBar({ summary }: { summary: RiskSummary }) {
  const seg = (n: number, level: RiskLevel) =>
    n > 0 ? (
      <View key={level} style={{ flex: n, backgroundColor: RISK_COLORS[level] }} />
    ) : null;
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

/**
 * spec 4-A: 요약 헤더. 전체 집계 + 단일 행동 결정.
 * 살릴 수 있는 금액(히어로) / 이미 잃은 금액(회색) / 사용가치(긍정) 분리 + 1순위 CTA.
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
  const allSafe = summary.danger === 0 && summary.warning === 0; // 위험·주의 0건
  return (
    <ThemedView type="backgroundElement" style={styles.summaryCard}>
      <View style={styles.sumHead}>
        <ThemedText type="smallBold">내 회원권 {formatNumber(count)}개</ThemedText>
        <View style={styles.sumChips}>
          {summary.danger > 0 ? <SummaryChip level="danger" n={summary.danger} /> : null}
          {summary.warning > 0 ? <SummaryChip level="warning" n={summary.warning} /> : null}
          {summary.safe > 0 ? <SummaryChip level="safe" n={summary.safe} /> : null}
          {summary.neutral > 0 ? <SummaryChip level="neutral" n={summary.neutral} /> : null}
        </View>
      </View>

      {count > 1 ? <RatioBar summary={summary} /> : null}

      {allSafe ? (
        <ThemedText type="subtitle" style={{ color: RISK_COLORS.safe }}>
          모든 회원권 페이스 양호 ✅
        </ThemedText>
      ) : (
        <View style={styles.heroBlock}>
          <ThemedText type="small" style={styles.dimText}>
            지금 가면 살릴 수 있는 금액
          </ThemedText>
          <ThemedText style={[styles.hero, { color: RISK_COLORS.danger }]}>
            {won(summary.recoverable)}
          </ThemedText>
        </View>
      )}

      {summary.lost > 0 ? (
        <ThemedText type="small" style={styles.dimText}>
          🔒 이미 만료 · {won(summary.lost)} (복구 불가)
        </ThemedText>
      ) : null}
      {summary.valueUsedThisMonth > 0 ? (
        <ThemedText type="small" style={{ color: RISK_COLORS.safe }}>
          ✅ 이번 달 사용가치 {won(summary.valueUsedThisMonth)}
        </ThemedText>
      ) : null}

      {onGoCenter ? (
        <Pressable
          onPress={onGoCenter}
          style={({ pressed }) => [styles.cta, pressed && styles.cardPressed]}>
          <ThemedText type="smallBold" style={{ color: RISK_COLORS.safe }}>
            🏃 센터 가기
          </ThemedText>
          <ThemedText type="small" style={styles.ctaSub}>
            {summary.topPriorityName
              ? `${summary.topPriorityName}부터 · 주 ${formatNumber(summary.topPriorityPace ?? 0)}회 필요`
              : '기록 유지 중'}
          </ThemedText>
        </Pressable>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  cardPressed: { opacity: 0.7 },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.two,
    borderLeftWidth: 4,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerLeft: { flex: 1, gap: 2 },
  perCost: {},
  chip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Spacing.two,
    minHeight: 28,
    justifyContent: 'center',
  },
  barBlock: { gap: 4, marginTop: Spacing.one },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5, backgroundColor: '#9ca3af' },
  barLabel: { opacity: 0.75 },
  footer: { gap: 4, marginTop: Spacing.one },
  dimText: { opacity: 0.5 },
  sumRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
  sumChip: { paddingHorizontal: Spacing.two, paddingVertical: 4, borderRadius: Spacing.two },
  summaryCard: { padding: Spacing.four, borderRadius: Spacing.two, gap: Spacing.two },
  sumHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  sumChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  ratioBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(127,127,127,0.15)',
    marginVertical: Spacing.one,
  },
  heroBlock: { marginTop: Spacing.one, gap: 2 },
  hero: { fontSize: 28, lineHeight: 34, fontWeight: '600' },
  cta: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: `${RISK_COLORS.safe}66`,
    backgroundColor: `${RISK_COLORS.safe}14`,
    alignItems: 'center',
    gap: 2,
  },
  ctaSub: { opacity: 0.7 },
});
