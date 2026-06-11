import { Wallet, X } from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, Chip, Icon } from '@/components/ui';
import { Palette, ScreenPadding, Spacing } from '@/constants/theme';
import { formatNumber, RISK_COLORS, RISK_META, won, type RiskInfo } from '@/features/membership/dashboard';
import type { Membership, MembershipType } from '@/features/membership/useMemberships';
import { useMembershipVisits } from '@/features/membership/useMembershipVisits';

const TYPE_LABELS: Record<MembershipType, string> = {
  free: '자유이용권',
  session: '세션권',
  class: '예약권',
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
  onClose,
}: {
  m: Membership;
  risk: RiskInfo;
  monthlyVisits: number;
  onClose: () => void;
}) {
  const { data: visits, isLoading } = useMembershipVisits(m.id);
  const color = RISK_COLORS[risk.level];
  const meta = RISK_META[risk.level];
  const expired = risk.remainingDays <= 0;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="h2">{m.name}</ThemedText>
        <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="닫기">
          <Icon icon={X} size={24} color={Palette.gray500} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Card accentColor={color}>
          <View style={styles.rowBetween}>
            <ThemedText type="caption" themeColor="textSecondary">
              {TYPE_LABELS[m.type]}
            </ThemedText>
            <Chip
              label={expired ? '만료' : meta.label}
              color={color}
              bg={`${color}1A`}
              icon={meta.icon}
            />
          </View>
          <View style={styles.statRow}>
            <Stat label="정비용" value={won(m.cost)} />
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
          {risk.hasSessions && risk.valueAtRisk > 0 ? (
            <View style={styles.footRow}>
              <Icon icon={Wallet} size={16} color={expired ? Palette.gray300 : Palette.loss} />
              <ThemedText type="caption" themeColor={expired ? 'textSecondary' : 'text'}>
                못 쓰면 {won(risk.valueAtRisk)} 손실
              </ThemedText>
            </View>
          ) : null}
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
              v.exercise_records.map((e) => (
                <ThemedText key={e.id} type="caption">
                  · {PART_LABEL[e.exercise_part] ?? e.exercise_part}
                  {e.intensity ? ` · ${INTENSITY_LABEL[e.intensity] ?? e.intensity}` : ''}
                  {e.duration ? ` · ${formatNumber(e.duration)}분` : ''}
                  {e.notes ? ` · ${e.notes}` : ''}
                </ThemedText>
              ))
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
  footRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg, marginTop: Spacing.sm },
  stat: { gap: 2 },
  sectionTitle: { marginTop: Spacing.sm },
  visitCard: { gap: Spacing.sm },
  stateBox: { paddingVertical: Spacing.lg, alignItems: 'center' },
});
