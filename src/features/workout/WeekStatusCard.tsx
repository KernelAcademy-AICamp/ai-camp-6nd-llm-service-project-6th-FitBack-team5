/**
 * 운동 홈 화면 상단 — 이번 주(월~일) 홈트 진행 현황.
 *
 * 일자별 원형 셀: 'completed' = primary(보라), 'partial' = warning(주황), 미운동/미래 = 회색 테두리.
 * 오늘은 굵은 보라 링으로 강조. 색에 의존하지 않도록 아래 범례 태그 노출.
 */

import { Check } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Elevation, Palette, Radius, Spacing } from '@/constants/theme';

import { useThisWeekWorkouts, type WeekDay } from './useThisWeekWorkouts';

function DayCell({ d }: { d: WeekDay }) {
  // 전부/일부 구분 없이 "운동했다"는 사실만 같은 색으로 표시.
  const filled = d.status !== null;
  const bg = filled ? Palette.primary : Palette.bgMuted;
  // 오늘 + 미운동인 경우만 보라 링으로 강조.
  const showTodayRing = d.isToday && !filled;

  return (
    <View style={styles.cell}>
      <View
        style={[
          styles.circle,
          {
            backgroundColor: bg,
            borderColor: showTodayRing ? Palette.primary : 'transparent',
            borderWidth: showTodayRing ? 2 : 0,
          },
        ]}>
        {filled && <Check color={Palette.white} size={16} strokeWidth={3} />}
      </View>
      <ThemedText
        type="label"
        themeColor={d.isToday ? 'text' : 'textSecondary'}>
        {d.weekdayLabel}
      </ThemedText>
    </View>
  );
}

function rangeText(days: { date: string }[]): string {
  if (days.length === 0) return '';
  const fmt = (iso: string) => {
    const [, m, d] = iso.split('-').map(Number);
    return `${m}.${d}`;
  };
  return `(${fmt(days[0].date)} ~ ${fmt(days[days.length - 1].date)})`;
}

export function WeekStatusCard({ selectedDate }: { selectedDate?: string }) {
  const { data, isLoading } = useThisWeekWorkouts(selectedDate);

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, { borderColor: Palette.lineDefault }, Elevation.level1]}>
      <View style={styles.titleRow}>
        <ThemedText type="smallBold">이번 주 홈트 현황</ThemedText>
        {data && (
          <ThemedText type="label" themeColor="textSecondary">
            {rangeText(data)}
          </ThemedText>
        )}
      </View>

      {isLoading || !data ? (
        <ThemedText type="small" themeColor="textSecondary">
          기록을 불러오는 중…
        </ThemedText>
      ) : (
        <View style={styles.row}>
          {data.map((d) => (
            <DayCell key={d.date} d={d} />
          ))}
        </View>
      )}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.xs,
  },
  cell: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingTop: Spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
