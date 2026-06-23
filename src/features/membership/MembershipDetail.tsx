import { X } from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, Icon } from '@/components/ui';
import { Palette, Radius, ScreenPadding, Spacing } from '@/constants/theme';
import { ddayBadge, formatNumber, won, type RiskInfo } from '@/features/membership/dashboard';
import { HelpButton } from '@/features/membership/HelpButton';
import type { PortfolioValue } from '@/features/membership/portfolio';
import type { Membership, MembershipType } from '@/features/membership/useMemberships';
import { useMembershipVisits } from '@/features/membership/useMembershipVisits';

const TYPE_HELP = [
  '인세권: 정해진 횟수를 쓰는 회원권이에요. 회당 비용 = 결제금액 ÷ 전체 횟수.',
  '기간권: 기간 안에 무제한으로 다니는 회원권이에요. 회당 비용 = 결제금액 ÷ (주 목표 × 주 수).',
  '활용도 = 결제금액의 75%(목표)를 기준으로 지금까지 얼마나 되찾았는지예요.',
  'D-23 은 만료까지 남은 일수예요. 색이 빨갈수록 지금 페이스로는 빠듯하다는 뜻이에요.',
];

const TYPE_LABELS: Record<MembershipType, string> = {
  session: 'PT 세션',
  period: '기간권',
};

const PART_LABEL: Record<string, string> = {
  chest: '가슴',
  back: '등',
  legs: '하체',
  shoulder: '어깨',
  core: '코어',
  arms: '팔',
  cardio: '유산소',
  fullbody: '전신',
};

const INTENSITY_LABEL: Record<string, string> = {
  easy: '쉬움',
  normal: '보통',
  hard: '힘듦',
};

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${date} ${time}`;
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

export function MembershipDetail({
  m,
  risk,
  monthlyVisits,
  value,
  onClose,
}: {
  m: Membership;
  risk: RiskInfo;
  monthlyVisits: number;
  value: PortfolioValue;
  onClose: () => void;
}) {
  const { data: visits, isLoading } = useMembershipVisits(m.id);
  const { label: ddayLabel, color: ddayColor } = ddayBadge(risk);
  const expired = risk.remainingDays <= 0;
  const pct = Math.min(100, Math.round(value.progressPct));
  const remainingVisits = Math.max(0, value.goalVisits - m.usedVisits);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="h2">{m.name}</ThemedText>
        <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="닫기">
          <Icon icon={X} size={24} color={Palette.gray500} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Card>
          <View style={styles.rowBetween}>
            <View style={styles.metaRow}>
              <ThemedText type="caption" themeColor="textSecondary">
                {TYPE_LABELS[m.type]}
              </ThemedText>
              <HelpButton title="회원권 어떻게 보나요?" paragraphs={TYPE_HELP} />
            </View>
            <View style={[styles.dday, { backgroundColor: `${ddayColor}1A` }]}>
              <ThemedText type="captionBold" style={{ color: ddayColor }}>
                {ddayLabel}
              </ThemedText>
            </View>
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
          <ThemedText type="caption">
            {value.isComplete
              ? '목표 달성! 이제부터는 보너스예요'
              : `목표까지 ${won(value.remaining)}${
                  remainingVisits > 0 ? ` · ${formatNumber(remainingVisits)}회 더` : ''
                }`}
          </ThemedText>

          <View style={styles.statRow}>
            <Stat label="결제금액" value={won(m.cost)} />
            {risk.hasSessions ? <Stat label="회당 비용" value={won(risk.costPerSession)} /> : null}
            <Stat label="이번 달 방문" value={`${formatNumber(monthlyVisits)}회`} />
          </View>
          <View style={styles.statRow}>
            {risk.hasSessions ? (
              <Stat
                label="남은 횟수"
                value={`${formatNumber(risk.remainingSessions ?? 0)}/${formatNumber(risk.totalSessions ?? 0)}`}
              />
            ) : null}
            <Stat label="남은 기간" value={expired ? '만료' : `${formatNumber(risk.remainingDays)}일`} />
            <Stat label="시작·종료" value={`${m.startDate} ~ ${m.endDate}`} />
          </View>
        </Card>

        <ThemedText type="captionBold" style={styles.sectionTitle}>
          방문 이력 {visits ? `(${formatNumber(visits.length)}회)` : ''}
        </ThemedText>

        {isLoading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={Palette.primary} />
          </View>
        ) : null}

        {!isLoading && (visits?.length ?? 0) === 0 ? (
          <Card>
            <ThemedText type="caption" themeColor="textSecondary">
              아직 방문 기록이 없어요. “센터 가기”로 체크인해 보세요.
            </ThemedText>
          </Card>
        ) : null}

        {visits?.map((v) => (
          <Card key={v.id} style={styles.visitCard}>
            <View style={styles.rowBetween}>
              <ThemedText type="captionBold">{fmtDateTime(v.check_in_time)}</ThemedText>
              {v.center_name ? (
                <ThemedText type="caption" themeColor="textSecondary">
                  {v.center_name}
                </ThemedText>
              ) : null}
            </View>
            {v.exercise_records.length > 0 ? (
              v.exercise_records.map((e) => {
                // 형태별: PT=트레이너, 클래스=클래스명, 자유이용권=부위.
                const head =
                  e.auto_data?.kind === 'session'
                    ? `PT${e.auto_data.trainer ? ` · ${e.auto_data.trainer}` : ''}`
                    : e.auto_data?.kind === 'class'
                      ? `클래스${e.auto_data.className ? ` · ${e.auto_data.className}` : ''}`
                      : e.exercise_part
                        ? (PART_LABEL[e.exercise_part] ?? e.exercise_part)
                        : (e.auto_data?.status ?? '기록');
                return (
                  <ThemedText key={e.id} type="caption">
                    · {head}
                    {e.intensity ? ` · ${INTENSITY_LABEL[e.intensity] ?? e.intensity}` : ''}
                    {e.duration ? ` · ${formatNumber(e.duration)}분` : ''}
                    {e.notes ? ` · ${e.notes}` : ''}
                  </ThemedText>
                );
              })
            ) : (
              <ThemedText type="caption" themeColor="textSecondary">
                운동 기록 없음
              </ThemedText>
            )}
          </Card>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.bgBase },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: ScreenPadding,
    paddingVertical: Spacing.md,
  },
  body: { paddingHorizontal: ScreenPadding, paddingBottom: Spacing.xl, gap: Spacing.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  dday: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
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
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg, marginTop: Spacing.sm },
  stat: { gap: 2 },
  sectionTitle: { marginTop: Spacing.sm },
  visitCard: { gap: Spacing.sm },
  stateBox: { paddingVertical: Spacing.lg, alignItems: 'center' },
});
