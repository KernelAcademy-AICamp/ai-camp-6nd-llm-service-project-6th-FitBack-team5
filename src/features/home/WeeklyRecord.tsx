import { CalendarDays } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Icon } from '@/components/ui';
import { Palette, Radius, Spacing } from '@/constants/theme';
import {
  RECOMMENDED_WEEKLY_VISITS,
  useHomeActivity,
  type WeekDay,
} from '@/features/home/useHomeActivity';

// 3종 구분: 색 + 점 + 범례(접근성: 색 단독 의존 금지).
const CAT = [
  { key: 'visited', label: '방문', color: Palette.primary },
  { key: 'workout', label: '운동', color: Palette.profit },
  { key: 'diet', label: '식단', color: Palette.warning },
] as const;
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

function WeekCell({ d }: { d: WeekDay }) {
  return (
    <View style={[styles.cell, d.isToday && styles.cellToday]}>
      <ThemedText type="label" themeColor={d.isToday ? 'text' : 'textSecondary'} style={styles.dayNum}>
        {d.day}
      </ThemedText>
      <View style={styles.dots}>
        {d.visited ? <View style={[styles.dot, { backgroundColor: Palette.primary }]} /> : null}
        {d.workout ? <View style={[styles.dot, { backgroundColor: Palette.profit }]} /> : null}
        {d.diet ? <View style={[styles.dot, { backgroundColor: Palette.warning }]} /> : null}
      </View>
    </View>
  );
}

/** 화면 A — 홈 주간 인라인. 이번 주 월~일 기록 + 달력보기 진입. */
export function WeeklyRecord({ onOpenCalendar }: { onOpenCalendar: () => void }) {
  const { data, isLoading } = useHomeActivity();
  const empty = data && data.weekDays.every((d) => !d.visited && !d.workout && !d.diet);

  return (
    <Card>
      <View style={styles.head}>
        <ThemedText type="captionBold">이번주 기록</ThemedText>
        <Pressable
          onPress={onOpenCalendar}
          style={({ pressed }) => [styles.calBtn, pressed && styles.pressed]}
          accessibilityRole="button">
          <Icon icon={CalendarDays} size={14} color={Palette.gray500} />
          <ThemedText type="label" themeColor="textSecondary">
            달력보기
          </ThemedText>
        </Pressable>
      </View>

      {isLoading || !data ? (
        <ThemedText type="caption" themeColor="textSecondary">
          기록을 불러오는 중…
        </ThemedText>
      ) : (
        <>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, i) => (
              <ThemedText
                key={w}
                type="label"
                themeColor={data.weekDays[i]?.isToday ? 'text' : 'textSecondary'}
                style={styles.weekLabel}>
                {w}
              </ThemedText>
            ))}
          </View>
          <View style={styles.grid}>
            {data.weekDays.map((d) => (
              <WeekCell key={d.date} d={d} />
            ))}
          </View>

          {empty ? (
            <ThemedText type="label" themeColor="textSecondary" style={styles.emptyHint}>
              아직 이번주 기록이 없어요. 첫 방문을 기록해보세요.
            </ThemedText>
          ) : null}

          <View style={styles.legend}>
            {CAT.map((c) => (
              <View key={c.key} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: c.color }]} />
                <ThemedText type="label" themeColor="textSecondary">
                  {c.label}
                </ThemedText>
              </View>
            ))}
            <ThemedText type="label" themeColor="textSecondary" style={styles.summary}>
              {data.weekVisits}/{RECOMMENDED_WEEKLY_VISITS}회
              {data.streakWeeks > 0 ? ` · 연속 ${data.streakWeeks}주` : ''}
            </ThemedText>
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  calBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.small,
    backgroundColor: Palette.gray100,
  },
  pressed: { opacity: 0.6 },
  weekRow: { flexDirection: 'row' },
  weekLabel: { flex: 1, textAlign: 'center' },
  grid: { flexDirection: 'row', marginTop: 4 },
  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: Radius.small,
  },
  cellToday: { borderWidth: 1.5, borderColor: Palette.primary },
  dayNum: { fontSize: 11 },
  dots: { flexDirection: 'row', gap: 2, height: 6, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  emptyHint: { marginTop: Spacing.sm, textAlign: 'center' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summary: { marginLeft: 'auto' },
});
