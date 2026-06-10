import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
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
      <ThemedText type="small" style={styles.dim}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
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
        <ThemedText type="subtitle">{m.name}</ThemedText>
        <Pressable onPress={onClose} hitSlop={8}>
          <ThemedText type="default">닫기</ThemedText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* 요약 */}
        <ThemedView type="backgroundElement" style={[styles.summaryCard, { borderLeftColor: color }]}>
          <View style={styles.rowBetween}>
            <ThemedText type="small" style={styles.dim}>
              {TYPE_LABELS[m.type]}
            </ThemedText>
            <View style={[styles.chip, { backgroundColor: `${color}22` }]}>
              <ThemedText type="smallBold" style={{ color }}>
                {meta.icon} {expired ? '만료' : meta.label}
              </ThemedText>
            </View>
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
            <ThemedText type="small" style={expired ? styles.dim : undefined}>
              💰 못 쓰면 {won(risk.valueAtRisk)} 손실
            </ThemedText>
          ) : null}
        </ThemedView>

        {/* 방문 이력 */}
        <ThemedText type="smallBold" style={styles.sectionTitle}>
          방문 이력 {visits ? `(${formatNumber(visits.length)}회)` : ''}
        </ThemedText>

        {isLoading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator />
          </View>
        ) : null}

        {!isLoading && (visits?.length ?? 0) === 0 ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="small" style={styles.dim}>
              아직 방문 기록이 없어요. “센터 가기”로 체크인해 보세요.
            </ThemedText>
          </ThemedView>
        ) : null}

        {visits?.map((v) => (
          <ThemedView key={v.id} type="backgroundElement" style={styles.card}>
            <View style={styles.rowBetween}>
              <ThemedText type="smallBold">{fmtDateTime(v.check_in_time)}</ThemedText>
              {v.center_name ? (
                <ThemedText type="small" style={styles.dim}>
                  {v.center_name}
                </ThemedText>
              ) : null}
            </View>
            {v.exercise_records.length > 0 ? (
              v.exercise_records.map((e) => (
                <ThemedText key={e.id} type="small">
                  · {PART_LABEL[e.exercise_part] ?? e.exercise_part}
                  {e.intensity ? ` · ${INTENSITY_LABEL[e.intensity] ?? e.intensity}` : ''}
                  {e.duration ? ` · ${formatNumber(e.duration)}분` : ''}
                  {e.notes ? ` · ${e.notes}` : ''}
                </ThemedText>
              ))
            ) : (
              <ThemedText type="small" style={styles.dim}>
                운동 기록 없음
              </ThemedText>
            )}
          </ThemedView>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  body: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.four, gap: Spacing.three },
  card: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.two },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chip: { paddingHorizontal: Spacing.two, paddingVertical: 4, borderRadius: Spacing.two },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.four, marginTop: Spacing.one },
  stat: { gap: 2 },
  dim: { opacity: 0.6 },
  sectionTitle: { marginTop: Spacing.two },
  summaryCard: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.two,
    borderLeftWidth: 4,
  },
  stateBox: { paddingVertical: Spacing.four, alignItems: 'center' },
});
