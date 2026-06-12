import { Flame } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Icon } from '@/components/ui';
import { Palette, Spacing } from '@/constants/theme';
import { useHomeActivity, type ActivityDay } from '@/features/home/useHomeActivity';

// 3종 구분: 색 + 위치(점)로 (접근성: 색 단독 의존 금지 — 범례 텍스트 병행).
const CAT = [
  { key: 'visited' as const, label: '방문', color: Palette.primary },
  { key: 'workout' as const, label: '운동', color: Palette.profit },
  { key: 'diet' as const, label: '식단', color: Palette.warning },
];
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function DayCell({ d }: { d: ActivityDay | null }) {
  if (!d) return <View style={styles.cell} />;
  return (
    <View style={styles.cell}>
      <ThemedText type="label" themeColor="textSecondary" style={styles.dayNum}>
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

/** 블록④ 누적 기록 — 방문·운동·식단 월간 히트맵 + 범례 + 스트릭. */
export function ActivityCalendar() {
  const { data, isLoading } = useHomeActivity();

  return (
    <Card>
      <View style={styles.head}>
        <ThemedText type="captionBold">방문 · 운동 · 식단 기록</ThemedText>
        <ThemedText type="label" themeColor="textSecondary">
          {data ? `${data.year}.${String(data.month).padStart(2, '0')}` : ''}
        </ThemedText>
      </View>

      {isLoading || !data ? (
        <ThemedText type="caption" themeColor="textSecondary">
          기록을 불러오는 중…
        </ThemedText>
      ) : data.days.every((d) => !d.visited && !d.workout && !d.diet) ? (
        <ThemedText type="caption" themeColor="textSecondary">
          아직 기록이 없어요. 첫 방문을 기록해보세요.
        </ThemedText>
      ) : (
        <>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((w) => (
              <ThemedText key={w} type="label" themeColor="textSecondary" style={styles.weekLabel}>
                {w}
              </ThemedText>
            ))}
          </View>
          <View style={styles.grid}>
            {/* 1일 앞 빈칸(요일 정렬) */}
            {Array.from({ length: new Date(data.year, data.month - 1, 1).getDay() }).map((_, i) => (
              <DayCell key={`pad-${i}`} d={null} />
            ))}
            {data.days.map((d) => (
              <DayCell key={d.date} d={d} />
            ))}
          </View>

          <View style={styles.legend}>
            {CAT.map((c) => (
              <View key={c.key} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: c.color }]} />
                <ThemedText type="label" themeColor="textSecondary">
                  {c.label}
                </ThemedText>
              </View>
            ))}
            {data.streakWeeks > 0 ? (
              <View style={styles.streak}>
                <Icon icon={Flame} size={14} color={Palette.warning} />
                <ThemedText type="label" style={{ color: Palette.warning }}>
                  연속 {data.streakWeeks}주
                </ThemedText>
              </View>
            ) : null}
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  weekRow: { flexDirection: 'row' },
  weekLabel: { flex: 1, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  dayNum: { fontSize: 10 },
  dots: { flexDirection: 'row', gap: 2, height: 6, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
});
