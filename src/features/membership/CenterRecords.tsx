/**
 * 홈트 상세 "센터" 탭 — '센터 가기 > 오늘 운동 루틴 만들기'(workout_sessions)로 한 운동 기록을 보여준다.
 * - CenterWeekStatusCard: 이번 주 센터 운동 완료 현황(WeekStatusView 재사용).
 * - CenterDayCard: 선택일의 센터 운동 목록(부위·유형·시간·운동 수).
 * 수동 출석(visits)은 일정 캘린더 전용이라 여기엔 포함하지 않는다.
 */

import { Dumbbell } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Elevation, Palette, Radius, Spacing } from '@/constants/theme';
import { useDayCenterWorkouts, useThisWeekCenterWorkouts } from '@/features/workout/useCenterWorkouts';
import { WeekStatusView } from '@/features/workout/WeekStatusCard';

export function CenterWeekStatusCard({ selectedDate }: { selectedDate?: string }) {
  const { data, isLoading } = useThisWeekCenterWorkouts(selectedDate);
  return <WeekStatusView title="이번 주 센터 운동" days={data} isLoading={isLoading} />;
}

function formatDateKo(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${m}월 ${d}일`;
}

export function CenterDayCard({ date }: { date: string }) {
  const { data: workouts, isLoading } = useDayCenterWorkouts(date);

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, { borderColor: Palette.lineDefault }, Elevation.level1]}>
      <ThemedText type="smallBold">{formatDateKo(date)} 센터에서 운동했어요!</ThemedText>

      {isLoading && (
        <View style={styles.center}>
          <ActivityIndicator color={Palette.primary} />
        </View>
      )}

      {!isLoading && (!workouts || workouts.length === 0) && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          센터 운동 기록이 없어요
        </ThemedText>
      )}

      {!isLoading &&
        workouts &&
        workouts.map((w, idx) => (
          <View
            key={w.id}
            style={[
              styles.row,
              idx !== 0 && {
                borderTopColor: Palette.lineDefault,
                borderTopWidth: StyleSheet.hairlineWidth,
              },
            ]}>
            <View style={[styles.iconBox, { backgroundColor: Palette.primaryLight }]}>
              <Dumbbell color={Palette.primary} size={20} />
            </View>
            <View style={styles.rowText}>
              <ThemedText type="small" themeColor="textSecondary">
                {w.durationMin}분 · 운동 {w.itemCount}개 ({w.time})
              </ThemedText>
              <ThemedText type="subtitle" style={{ fontSize: 18, lineHeight: 23 }}>
                {w.bodyPart} {w.exerciseType}
              </ThemedText>
            </View>
          </View>
        ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  center: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: Spacing.xs,
  },
});
