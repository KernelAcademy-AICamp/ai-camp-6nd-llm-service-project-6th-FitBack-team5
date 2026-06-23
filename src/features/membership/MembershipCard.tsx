import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { ddayBadge, formatNumber, won, type RiskInfo } from '@/features/membership/dashboard';
import { HelpButton } from '@/features/membership/HelpButton';
import type { PortfolioValue } from '@/features/membership/portfolio';
import type { Membership } from '@/features/membership/useMemberships';

// 인포(ⓘ) 도움말 — 회원권 타입 + 지표 읽는 법 간략 설명.
const TYPE_HELP = [
  '인세권: 정해진 횟수를 쓰는 회원권이에요. 회당 비용 = 결제금액 ÷ 전체 횟수.',
  '기간권: 기간 안에 무제한으로 다니는 회원권이에요. 회당 비용 = 결제금액 ÷ (주 목표 × 주 수).',
  '활용도 = 결제금액의 75%(목표)를 기준으로 지금까지 얼마나 되찾았는지예요.',
  'D-23 은 만료까지 남은 일수예요. 색이 빨갈수록 지금 페이스로는 빠듯하다는 뜻이에요.',
];

/** 회원권 1개 활용도 카드 — 결제금액 회수(목표 75%) 중심. D-day 배지가 색으로 긴장감 표시. */
export function MembershipCard({
  m,
  risk,
  value,
  onPress,
}: {
  m: Membership;
  risk: RiskInfo;
  value: PortfolioValue;
  onPress?: () => void;
}) {
  const expired = risk.remainingDays <= 0;
  const { label: ddayLabel, color: ddayColor } = ddayBadge(risk);

  const pct = Math.min(100, Math.round(value.progressPct));
  const remainingVisits = Math.max(0, value.goalVisits - m.usedVisits);

  return (
    <Card onPress={onPress}>
      {/* 헤더: 이름 + D-day 배지(우상단) */}
      <View style={styles.header}>
        <ThemedText type="h2" style={styles.name} numberOfLines={1}>
          {m.name}
        </ThemedText>
        <View style={[styles.dday, { backgroundColor: `${ddayColor}1A` }]}>
          <ThemedText type="captionBold" style={{ color: ddayColor }}>
            {ddayLabel}
          </ThemedText>
        </View>
      </View>

      {/* 회당 비용 · 결제금액 + 인포(금액 글자 근처) */}
      <View style={styles.metaRow}>
        <ThemedText type="caption" themeColor="textSecondary">
          {value.perVisitValue > 0 ? `회당 ${won(value.perVisitValue)} · ` : ''}결제금액 {won(m.cost)}
        </ThemedText>
        <HelpButton title="회원권 어떻게 보나요?" paragraphs={TYPE_HELP} />
      </View>

      {/* 활용도 진행바 + 목표 75% 마커 */}
      <View style={styles.barRow}>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${pct}%`, backgroundColor: expired ? Palette.gray300 : Palette.primary },
            ]}
          />
          <View style={[styles.marker, { left: '75%' }]} />
        </View>
        <ThemedText type="captionBold" style={styles.pct}>
          {pct}%
        </ThemedText>
      </View>
      <ThemedText type="label" themeColor="textSecondary">
        활용도 · 목표 75%
      </ThemedText>

      {/* 목표까지 + 남은 필요 횟수 */}
      <ThemedText type="caption">
        {value.isComplete
          ? '목표 달성! 이제부터는 보너스예요'
          : `목표까지 ${won(value.remaining)}${
              remainingVisits > 0 ? ` · ${formatNumber(remainingVisits)}회 더` : ''
            }`}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  name: { flex: 1 },
  dday: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 2 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md },
  barTrack: {
    flex: 1,
    height: 24,
    borderRadius: Radius.small,
    backgroundColor: Palette.gray100,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: Radius.small },
  marker: { position: 'absolute', top: 4, bottom: 4, width: 1, backgroundColor: 'rgba(0,0,0,0.18)' },
  pct: { minWidth: 44, textAlign: 'right' },
});
