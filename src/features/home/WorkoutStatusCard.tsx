import { ChevronRight, Flame, Sparkles } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Icon, ProgressBar } from '@/components/ui';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { RECOMMENDED_WEEKLY_VISITS, useHomeActivity } from '@/features/home/useHomeActivity';
import { useMemberships } from '@/features/membership/useMemberships';

const WD = ['월', '화', '수', '목', '금', '토', '일'];

type CoachLike = { isLoading: boolean; data?: { headline: string } | null };

/** 내 운동 상태 — 주간 그래프 + 목표 게이지 + 스트릭 + 코치 한마디(통합). */
export function WorkoutStatusCard({
  coach,
  name,
  onOpenCoach,
}: {
  coach: CoachLike;
  name: string;
  onOpenCoach: () => void;
}) {
  const { data: home } = useHomeActivity();
  const { data: memberships } = useMemberships();

  const weekDays = home?.weekDays ?? [];
  const weekVisits = home?.weekVisits ?? 0;
  const streak = home?.streakWeeks ?? 0;

  // 이번 주 목표(개인화): 활성 기간권 주당 목표 최댓값, 없으면 기본값
  const goal = (memberships ?? [])
    .filter((m) => m.type === 'period' && m.status !== 'expired' && m.weeklyGoal)
    .reduce((mx, m) => Math.max(mx, m.weeklyGoal ?? 0), 0);
  const target = goal > 0 ? goal : RECOMMENDED_WEEKLY_VISITS;
  const ratio = target > 0 ? Math.min(1, weekVisits / target) : 0;

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <ThemedText type="captionBold">내 운동 상태</ThemedText>
        <View style={styles.streak}>
          <Icon icon={Flame} size={14} color={streak > 0 ? Palette.warning : Palette.gray300} />
          <ThemedText type="captionBold" style={{ color: streak > 0 ? Palette.warning : Palette.gray500 }}>
            {streak}주 연속
          </ThemedText>
        </View>
      </View>

      {/* 주간 7일 그래프 */}
      <View style={styles.week}>
        {(weekDays.length === 7
          ? weekDays
          : WD.map((_, i) => ({ date: `p${i}`, weekday: i, visited: false, workout: false, isToday: false }))
        ).map((d, i) => {
          const active = d.visited || d.workout;
          return (
            <View key={d.date} style={styles.dayCol}>
              <View style={[styles.bar, active && styles.barActive, d.isToday && styles.barToday]} />
              <ThemedText type="label" themeColor={d.isToday ? 'text' : 'textSecondary'}>
                {WD[d.weekday] ?? WD[i]}
              </ThemedText>
            </View>
          );
        })}
      </View>

      {/* 이번 주 목표 게이지 */}
      <View style={styles.goalRow}>
        <View style={styles.goalBar}>
          <ProgressBar ratio={ratio} color={Palette.primary} height={8} label={`이번 주 ${weekVisits} / ${target}회`} />
        </View>
        <ThemedText type="captionBold">
          <ThemedText type="captionBold" style={{ color: Palette.primary }}>
            {weekVisits}
          </ThemedText>{' '}
          / {target}회
        </ThemedText>
      </View>

      {/* 코치 한마디 (말풍선 통합 — 분석 해설) */}
      <Pressable
        onPress={onOpenCoach}
        style={({ pressed }) => [styles.coach, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="코치에게 물어보기">
        <Icon icon={Sparkles} size={14} color={Palette.primary} />
        {coach.isLoading ? (
          <View style={styles.coachLoading}>
            <ActivityIndicator size="small" color={Palette.primary} />
            <ThemedText type="label" themeColor="textSecondary">
              코치가 분석 중…
            </ThemedText>
          </View>
        ) : (
          <ThemedText type="caption" style={styles.coachText} numberOfLines={2}>
            {coach.data?.headline ?? `${name}님, 오늘도 파이팅!`}
          </ThemedText>
        )}
        <Icon icon={ChevronRight} size={16} color={Palette.gray300} />
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { flex: 1, alignItems: 'center', gap: 6 },
  bar: { width: 12, height: 32, borderRadius: Radius.small, backgroundColor: Palette.gray100 },
  barActive: { backgroundColor: Palette.primary },
  barToday: { borderWidth: 1.5, borderColor: Palette.primary },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  goalBar: { flex: 1 },
  coach: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: Palette.lineDefault,
  },
  coachLoading: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  coachText: { flex: 1 },
  pressed: { opacity: 0.6 },
});
