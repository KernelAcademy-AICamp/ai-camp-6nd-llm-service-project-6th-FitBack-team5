import { router } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  MapPin,
  Target,
  Utensils,
  X,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Icon } from '@/components/ui';
import { Palette, Radius, ScreenPadding, Spacing } from '@/constants/theme';
import { useCalendarMonth } from '@/features/home/useCalendarMonth';
import { useDayRecords } from '@/features/home/useDayRecords';
import {
  RECOMMEND_PACE_TEXT,
  RECOMMENDED_WEEKLY_VISITS,
  useHomeActivity,
  type ActivityDay,
} from '@/features/home/useHomeActivity';

const CAT = [
  { key: 'visited', label: '방문', color: Palette.primary },
  { key: 'workout', label: '운동', color: Palette.profit },
  { key: 'diet', label: '식단', color: Palette.warning },
] as const;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dayHeader(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]}) 기록`;
}

function DayCell({
  d,
  selected,
  onPress,
}: {
  d: ActivityDay | null;
  selected: boolean;
  onPress: (date: string) => void;
}) {
  if (!d) return <View style={styles.cell} />;
  const active = d.visited || d.workout || d.diet;
  return (
    <Pressable
      onPress={() => onPress(d.date)}
      style={[styles.cell, active && styles.cellActive, selected && styles.cellSelected]}
      accessibilityRole="button">
      <ThemedText type="label" themeColor="textSecondary" style={styles.dayNum}>
        {d.day}
      </ThemedText>
      <View style={styles.dots}>
        {d.visited ? <View style={[styles.dot, { backgroundColor: Palette.primary }]} /> : null}
        {d.workout ? <View style={[styles.dot, { backgroundColor: Palette.profit }]} /> : null}
        {d.diet ? <View style={[styles.dot, { backgroundColor: Palette.warning }]} /> : null}
      </View>
    </Pressable>
  );
}

/** 선택 날짜 기록 리스트. 방문·운동=인라인, 식단=식단 탭(해당 날짜) 딥링크. */
function DayRecordList({ date, onNavigate }: { date: string; onNavigate: () => void }) {
  const { data, isLoading } = useDayRecords(date);
  const empty = data && !data.visits.length && !data.workouts.length && !data.meals.length;

  function openDiet() {
    onNavigate();
    router.navigate({ pathname: '/diet', params: { date } });
  }

  return (
    <Card>
      <ThemedText type="captionBold" style={styles.recHead}>
        {dayHeader(date)}
      </ThemedText>
      {isLoading || !data ? (
        <ThemedText type="label" themeColor="textSecondary">
          불러오는 중…
        </ThemedText>
      ) : empty ? (
        <ThemedText type="label" themeColor="textSecondary">
          이 날은 기록이 없어요.
        </ThemedText>
      ) : (
        <View style={styles.recList}>
          {data.visits.map((v) => (
            <View key={v.id} style={styles.recRow}>
              <Icon icon={MapPin} size={15} color={Palette.primary} />
              <ThemedText type="caption" style={styles.recText}>
                방문 · {v.centerName ?? '센터'} {v.time}
              </ThemedText>
            </View>
          ))}
          {data.workouts.map((w) => (
            <View key={w.id} style={styles.recRow}>
              <Icon icon={Dumbbell} size={15} color={Palette.profit} />
              <ThemedText type="caption" style={styles.recText}>
                운동 · {w.label}
                {w.durationMin != null ? ` ${w.durationMin}분` : ''}
              </ThemedText>
            </View>
          ))}
          {data.meals.map((m) => (
            <Pressable
              key={m.id}
              onPress={openDiet}
              style={({ pressed }) => [styles.recRow, pressed && styles.pressed]}
              accessibilityRole="button">
              <Icon icon={Utensils} size={15} color={Palette.warning} />
              <ThemedText type="caption" style={styles.recText}>
                식단 · {m.mealType} · 단백질 {m.protein}g
              </ThemedText>
              <Icon icon={ChevronRight} size={16} color={Palette.gray300} />
            </Pressable>
          ))}
          {data.meals.length > 0 ? (
            <ThemedText type="label" themeColor="textSecondary" style={styles.recHint}>
              식단 항목을 누르면 해당 날짜 기록으로 이동해요.
            </ThemedText>
          ) : null}
        </View>
      )}
    </Card>
  );
}

/** 화면 B — 월 캘린더 상세(모달). 월 이동 + 그리드 + 요약 + 권장 페이스. */
export function MonthCalendar({ onClose }: { onClose: () => void }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1~12
  // 현재 달이면 오늘을 기본 선택, 아니면 미선택
  const [selectedDate, setSelectedDate] = useState<string | null>(ymdLocal(now));
  const { data, isLoading } = useCalendarMonth(year, month);
  const { data: home } = useHomeActivity();

  function shift(delta: number) {
    const m0 = month - 1 + delta;
    setYear((y) => y + Math.floor(m0 / 12));
    setMonth(((m0 % 12) + 12) % 12 + 1);
    setSelectedDate(null); // 월 이동 시 선택 해제(다른 달 날짜 혼동 방지)
  }

  const leadPad = new Date(year, month - 1, 1).getDay(); // 0=일
  const streak = home?.streakWeeks ?? 0;
  const weekVisits = home?.weekVisits ?? 0;

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <ThemedText type="h2">기록 캘린더</ThemedText>
        <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="닫기">
          <Icon icon={X} size={22} color={Palette.gray500} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* 월 네비게이션 */}
        <View style={styles.monthNav}>
          <Pressable onPress={() => shift(-1)} hitSlop={8} accessibilityRole="button" accessibilityLabel="이전 달">
            <Icon icon={ChevronLeft} size={22} color={Palette.gray500} />
          </Pressable>
          <ThemedText type="captionBold">
            {year}년 {month}월
          </ThemedText>
          <Pressable onPress={() => shift(1)} hitSlop={8} accessibilityRole="button" accessibilityLabel="다음 달">
            <Icon icon={ChevronRight} size={22} color={Palette.gray500} />
          </Pressable>
        </View>

        <Card>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((w) => (
              <ThemedText key={w} type="label" themeColor="textSecondary" style={styles.weekLabel}>
                {w}
              </ThemedText>
            ))}
          </View>
          {isLoading || !data ? (
            <ThemedText type="caption" themeColor="textSecondary" style={styles.loading}>
              기록을 불러오는 중…
            </ThemedText>
          ) : (
            <View style={styles.grid}>
              {Array.from({ length: leadPad }).map((_, i) => (
                <View key={`pad-${i}`} style={styles.cell} />
              ))}
              {data.days.map((d) => (
                <DayCell
                  key={d.date}
                  d={d}
                  selected={selectedDate === d.date}
                  onPress={setSelectedDate}
                />
              ))}
            </View>
          )}

          <View style={styles.legend}>
            {CAT.map((c) => (
              <View key={c.key} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: c.color }]} />
                <ThemedText type="label" themeColor="textSecondary">
                  {c.label}
                </ThemedText>
              </View>
            ))}
          </View>
        </Card>

        {/* 선택 날짜 기록 리스트 (방문·운동 인라인 / 식단 딥링크) */}
        {selectedDate ? <DayRecordList date={selectedDate} onNavigate={onClose} /> : null}

        {/* 요약 카드 2종 */}
        <View style={styles.statRow}>
          <Card style={styles.statCard}>
            <ThemedText type="label" themeColor="textSecondary">
              이번 달 방문
            </ThemedText>
            <ThemedText type="h2">{data?.visitCount ?? 0}회</ThemedText>
          </Card>
          <Card style={styles.statCard}>
            <View style={styles.statLabelRow}>
              <Icon icon={Flame} size={13} color={Palette.warning} />
              <ThemedText type="label" themeColor="textSecondary">
                연속
              </ThemedText>
            </View>
            <ThemedText type="h2">{streak}주</ThemedText>
          </Card>
        </View>

        {/* 권장 페이스 */}
        <Card accentColor={Palette.primary}>
          <View style={styles.paceRow}>
            <Icon icon={Target} size={20} color={Palette.primary} />
            <View style={styles.paceText}>
              <ThemedText type="captionBold" style={{ color: Palette.primary }}>
                권장 페이스
              </ThemedText>
              <ThemedText type="label" themeColor="textSecondary">
                {RECOMMEND_PACE_TEXT}
              </ThemedText>
            </View>
            <View style={styles.paceRight}>
              <ThemedText type="label" themeColor="textSecondary">
                이번 주 권장
              </ThemedText>
              <ThemedText type="captionBold">
                <ThemedText type="captionBold" style={{ color: Palette.primary }}>
                  {weekVisits}
                </ThemedText>{' '}
                / {RECOMMENDED_WEEKLY_VISITS}회
              </ThemedText>
            </View>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ScreenPadding,
    paddingVertical: Spacing.md,
  },
  body: { paddingHorizontal: ScreenPadding, paddingBottom: Spacing.xl, gap: Spacing.md },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekLabel: { flex: 1, textAlign: 'center' },
  loading: { paddingVertical: Spacing.xl, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: Radius.small,
  },
  cellActive: { backgroundColor: Palette.primaryLight },
  cellSelected: { borderWidth: 1.5, borderColor: Palette.primary },
  dayNum: { fontSize: 11 },
  dots: { flexDirection: 'row', gap: 2, height: 6, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statRow: { flexDirection: 'row', gap: Spacing.md },
  statCard: { flex: 1, gap: 4 },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  paceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  paceText: { flex: 1, gap: 2 },
  paceRight: { alignItems: 'flex-end', gap: 2 },
  recHead: { marginBottom: Spacing.sm },
  recList: { gap: Spacing.sm },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  recText: { flex: 1 },
  pressed: { opacity: 0.6 },
  recHint: { marginTop: 2 },
});
