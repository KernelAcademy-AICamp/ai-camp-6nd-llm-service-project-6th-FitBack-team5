import { router } from 'expo-router';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Icon } from '@/components/ui';
import { Palette, Radius, ScreenPadding, Spacing } from '@/constants/theme';
import { useCalendarMonth } from '@/features/home/useCalendarMonth';
import { useDayRecords } from '@/features/home/useDayRecords';
import { RECOMMENDED_WEEKLY_VISITS, useHomeActivity } from '@/features/home/useHomeActivity';
import { useMemberships } from '@/features/membership/useMemberships';
import {
  useAddSchedule,
  useDeleteSchedule,
  useSchedules,
  useUpdateSchedule,
  type Schedule,
  type ScheduleType,
} from '@/features/home/useSchedules';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 타입 메타 — 기록·일정 공통(동일 색/순서). ScheduleType과 키 동일.
// 색은 디자인 토큰. 목업의 방문 파랑(#4B8DF8)은 토큰 부재로 success(초록)로 대체.
type FilterKey = ScheduleType; // 'workout' | 'diet' | 'visit' | 'custom'
const TYPE_META: { key: FilterKey; label: string; color: string }[] = [
  { key: 'workout', label: '운동', color: Palette.primary },
  { key: 'diet', label: '식단', color: Palette.warning },
  { key: 'visit', label: '방문', color: Palette.success },
  { key: 'custom', label: '기타', color: Palette.gray400 },
];
const typeColor = (k: FilterKey) => TYPE_META.find((t) => t.key === k)?.color ?? Palette.gray400;
const typeLabel = (k: FilterKey) => TYPE_META.find((t) => t.key === k)?.label ?? '기타';

/** 타입 태그 칩 (기록·일정 항목 앞에 부착). */
function TagChip({ k }: { k: FilterKey }) {
  const color = typeColor(k);
  return (
    <View style={[styles.tagChip, { backgroundColor: `${color}1A` }]}>
      <ThemedText type="label" style={{ color }}>
        {typeLabel(k)}
      </ThemedText>
    </View>
  );
}

function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dayTitle(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

function DayCell({
  day,
  date,
  dots,
  selected,
  onPress,
}: {
  day: number;
  date: string;
  dots: string[];
  selected: boolean;
  onPress: (date: string) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(date)}
      style={[styles.cell, dots.length > 0 && styles.cellActive, selected && styles.cellSelected]}
      accessibilityRole="button">
      <ThemedText type="label" themeColor="textSecondary" style={styles.dayNum}>
        {day}
      </ThemedText>
      <View style={styles.dots}>
        {dots.map((c, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: c }]} />
        ))}
      </View>
    </Pressable>
  );
}

/** 선택 날짜 기록 리스트(과거 기록). 방문·운동=인라인, 식단=식단 탭 딥링크. */
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
        {dayTitle(date)} 기록
      </ThemedText>
      {isLoading || !data ? (
        <ThemedText type="label" themeColor="textSecondary">
          불러오는 중…
        </ThemedText>
      ) : empty ? (
        <ThemedText type="label" themeColor="textSecondary">
          이 날은 기록이 없어요 · 방문하면 자동으로 채워져요
        </ThemedText>
      ) : (
        <View style={styles.recList}>
          {data.visits.map((v) => (
            <View key={v.id} style={styles.recRow}>
              <TagChip k="visit" />
              <ThemedText type="caption" style={styles.recText} numberOfLines={1}>
                {v.centerName ?? '센터'}
              </ThemedText>
              {v.verifyStatus === 'verified' ? (
                <View style={styles.verifyTag}>
                  <Icon icon={ShieldCheck} size={12} color={Palette.success} />
                  <ThemedText type="label" style={{ color: Palette.success }}>
                    검증
                  </ThemedText>
                </View>
              ) : v.verifyStatus === 'unverified' ? (
                <ThemedText type="label" themeColor="textSecondary">
                  수동 출석
                </ThemedText>
              ) : null}
              <ThemedText type="label" themeColor="textSecondary">
                {v.time}
              </ThemedText>
            </View>
          ))}
          {data.workouts.map((w) => (
            <View key={w.id} style={styles.recRow}>
              <TagChip k="workout" />
              <ThemedText type="caption" style={styles.recText} numberOfLines={1}>
                {w.label}
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
              <TagChip k="diet" />
              <ThemedText type="caption" style={styles.recText} numberOfLines={1}>
                {m.mealType} · 단백질 {m.protein}g
              </ThemedText>
              <Icon icon={ChevronRight} size={16} color={Palette.gray300} />
            </Pressable>
          ))}
        </View>
      )}
    </Card>
  );
}

/** 선택 날짜 일정(예정) — 추가/완료 토글/삭제. */
function ScheduleSection({ date, items }: { date: string; items: Schedule[] }) {
  const add = useAddSchedule();
  const update = useUpdateSchedule();
  const del = useDeleteSchedule();
  const [type, setType] = useState<ScheduleType>('workout');
  const [title, setTitle] = useState('');

  function submit() {
    const t = title.trim();
    if (!t || add.isPending) return;
    add.mutate({ date, type, title: t, source: 'manual' }, { onSuccess: () => setTitle('') });
  }

  return (
    <Card>
      <ThemedText type="captionBold" style={styles.recHead}>
        {dayTitle(date)} 일정
      </ThemedText>

      {items.length === 0 ? (
        <ThemedText type="label" themeColor="textSecondary">
          예정된 일정이 없어요. 아래에서 추가해보세요.
        </ThemedText>
      ) : (
        <View style={styles.recList}>
          {items.map((s) => {
            const done = s.status === 'done';
            return (
              <View key={s.id} style={styles.planRow}>
                <Pressable
                  onPress={() => update.mutate({ id: s.id, status: done ? 'planned' : 'done' })}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={done ? '완료 해제' : '완료'}
                  style={[styles.checkBox, done && { backgroundColor: typeColor(s.type), borderColor: typeColor(s.type) }]}>
                  {done ? <Icon icon={Check} size={12} color={Palette.white} /> : null}
                </Pressable>
                <TagChip k={s.type} />
                <ThemedText
                  type="caption"
                  style={[styles.recText, done && styles.planDone]}
                  numberOfLines={1}>
                  {s.title}
                  {s.source === 'ai' ? ' · AI' : ''}
                </ThemedText>
                <Pressable onPress={() => del.mutate(s.id)} hitSlop={6} accessibilityRole="button" accessibilityLabel="삭제">
                  <Icon icon={Trash2} size={15} color={Palette.gray300} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {/* 추가 폼 */}
      <View style={styles.addType}>
        {TYPE_META.map((p) => {
          const on = type === p.key;
          return (
            <Pressable
              key={p.key}
              onPress={() => setType(p.key)}
              style={[styles.typeChip, on && { backgroundColor: `${p.color}1A`, borderColor: p.color }]}>
              <ThemedText type="label" style={{ color: on ? p.color : Palette.gray500 }}>
                {p.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.addRow}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="일정 내용 (예: 하체 루틴 20분)"
          placeholderTextColor={Palette.gray300}
          style={styles.addInput}
          onSubmitEditing={submit}
          returnKeyType="done"
        />
        <Pressable
          onPress={submit}
          disabled={!title.trim() || add.isPending}
          style={({ pressed }) => [styles.addBtn, (!title.trim() || add.isPending) && styles.addBtnOff, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="일정 추가">
          <Icon icon={Plus} size={18} color={Palette.white} />
        </Pressable>
      </View>
    </Card>
  );
}

/** 일정 캘린더(모달). 기록 ↔ 일정 보기 전환 + 월 그리드 + 편집. */
export function MonthCalendar({ onClose }: { onClose: () => void }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1~12
  const [selectedDate, setSelectedDate] = useState<string | null>(ymdLocal(now));
  const [view, setView] = useState<'records' | 'plans'>('records');
  const [filters, setFilters] = useState<Set<FilterKey>>(new Set(['workout', 'diet', 'visit', 'custom']));

  // 탭 전환 시 선택 일자를 오늘로 리셋(명세 §6)
  function switchView(v: 'records' | 'plans') {
    setView(v);
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth() + 1);
    setSelectedDate(ymdLocal(t));
  }
  function toggleFilter(k: FilterKey) {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  const { data, isLoading } = useCalendarMonth(year, month);
  const { data: home } = useHomeActivity();
  const { data: schedules } = useSchedules(year, month);
  const { data: memberships } = useMemberships();
  const autoComplete = useUpdateSchedule();

  // 자동 완료: 같은 날짜에 해당 타입 실제 기록이 있으면 예정→완료.
  // 오매칭 방지 — 타입이 명확히 매핑되는 visit/workout/diet만, custom 제외.
  useEffect(() => {
    if (!data?.days || !schedules) return;
    const present: Record<string, { visit: boolean; workout: boolean; diet: boolean }> = {};
    for (const d of data.days) present[d.date] = { visit: d.visited, workout: d.workout, diet: d.diet };
    for (const s of schedules) {
      if (s.status !== 'planned' || s.type === 'custom') continue;
      const p = present[s.date];
      if (p && p[s.type]) autoComplete.mutate({ id: s.id, status: 'done' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, schedules]);

  // 권장 페이스 개인화: 활성 기간권의 주당 목표 중 최댓값, 없으면 기본값
  const goalFromMembership = (memberships ?? [])
    .filter((m) => m.type === 'period' && m.status !== 'expired' && m.weeklyGoal)
    .reduce((mx, m) => Math.max(mx, m.weeklyGoal ?? 0), 0);
  const recommendedWeekly = goalFromMembership > 0 ? goalFromMembership : RECOMMENDED_WEEKLY_VISITS;

  function shift(delta: number) {
    const m0 = month - 1 + delta;
    setYear((y) => y + Math.floor(m0 / 12));
    setMonth(((m0 % 12) + 12) % 12 + 1);
    setSelectedDate(null);
  }

  const leadPad = new Date(year, month - 1, 1).getDay();
  const streak = home?.streakWeeks ?? 0;
  const maxStreak = home?.maxStreakWeeks ?? 0;
  const freezeLeft = home?.streakFreezeAvailable ?? true;
  const planList = schedules ?? [];

  // 날짜별 일정 타입 집합
  const planTypesByDate: Record<string, Set<FilterKey>> = {};
  for (const s of planList) {
    (planTypesByDate[s.date] ??= new Set()).add(s.type);
  }
  const daySchedules = selectedDate ? planList.filter((s) => s.date === selectedDate) : [];

  // 캘린더 점 — 필터 적용(꺼진 타입은 숨김)
  function dotsFor(d: { date: string; visited: boolean; workout: boolean; diet: boolean }): string[] {
    let keys: FilterKey[];
    if (view === 'plans') {
      keys = [...(planTypesByDate[d.date] ?? new Set<FilterKey>())];
    } else {
      keys = [];
      if (d.visited) keys.push('visit');
      if (d.workout) keys.push('workout');
      if (d.diet) keys.push('diet');
    }
    return TYPE_META.filter((t) => keys.includes(t.key) && filters.has(t.key))
      .map((t) => t.color)
      .slice(0, 4);
  }

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <ThemedText type="h2">일정 캘린더</ThemedText>
        <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="닫기">
          <Icon icon={X} size={22} color={Palette.gray500} />
        </Pressable>
      </View>

      {/* 기록 ↔ 일정 전환 */}
      <View style={styles.segment}>
        {(['records', 'plans'] as const).map((v) => {
          const on = view === v;
          return (
            <Pressable key={v} onPress={() => switchView(v)} style={[styles.segBtn, on && styles.segBtnOn]} accessibilityRole="button">
              <ThemedText type={on ? 'captionBold' : 'caption'} style={on ? { color: Palette.primary } : undefined}>
                {v === 'records' ? '기록' : '일정'}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
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
              불러오는 중…
            </ThemedText>
          ) : (
            <View style={styles.grid}>
              {Array.from({ length: leadPad }).map((_, i) => (
                <View key={`pad-${i}`} style={styles.cell} />
              ))}
              {data.days.map((d) => (
                <DayCell
                  key={d.date}
                  day={d.day}
                  date={d.date}
                  dots={dotsFor(d)}
                  selected={selectedDate === d.date}
                  onPress={setSelectedDate}
                />
              ))}
            </View>
          )}

          {/* 태그 필터 칩 (끄면 해당 타입 점 숨김) */}
          <View style={styles.legend}>
            {TYPE_META.map((c) => {
              const on = filters.has(c.key);
              return (
                <Pressable
                  key={c.key}
                  onPress={() => toggleFilter(c.key)}
                  style={[styles.filterChip, on ? { borderColor: c.color } : styles.filterChipOff]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}>
                  <View style={[styles.dot, { backgroundColor: c.color }]} />
                  <ThemedText type="label" style={{ color: on ? c.color : Palette.gray400 }}>
                    {c.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* 선택 날짜 — 보기에 따라 기록/일정 */}
        {selectedDate
          ? view === 'records'
            ? <DayRecordList date={selectedDate} onNavigate={onClose} />
            : <ScheduleSection date={selectedDate} items={daySchedules} />
          : null}

        {/* 요약 + 권장 페이스 (기록 보기에서만) */}
        {view === 'records' ? (
          <>
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
                    연속 (주)
                  </ThemedText>
                </View>
                <ThemedText type="h2">{streak}주</ThemedText>
                <ThemedText type="label" themeColor="textSecondary">
                  최고 {maxStreak}주{freezeLeft ? ' · 프리즈 1회 남음' : ' · 프리즈 사용함'}
                </ThemedText>
              </Card>
            </View>

            {/* 회복 동선 — 스트릭이 끊겼지만 기록이 있을 때 부드러운 재시작. (권장 페이스는 활용도 카드로 이동) */}
            {streak === 0 && maxStreak > 0 ? (
              <Card accentColor={Palette.primary}>
                <ThemedText type="label" themeColor="textSecondary">
                  최고 {maxStreak}주 기록이 있어요 · 이번 주 {recommendedWeekly}회로 다시 이어가볼까요?
                </ThemedText>
              </Card>
            ) : null}
          </>
        ) : null}
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
  segment: {
    flexDirection: 'row',
    marginHorizontal: ScreenPadding,
    marginBottom: Spacing.sm,
    backgroundColor: Palette.gray100,
    borderRadius: Radius.small,
    padding: 3,
  },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.small - 1 },
  segBtnOn: { backgroundColor: Palette.bgSurface },
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
  legend: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.md, flexWrap: 'wrap' },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Palette.lineDefault,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  filterChipOff: { opacity: 0.4 },
  tagChip: { borderRadius: Radius.small, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  statRow: { flexDirection: 'row', gap: Spacing.md },
  statCard: { flex: 1, gap: 4 },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recHead: { marginBottom: Spacing.sm },
  recList: { gap: Spacing.sm },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  recText: { flex: 1 },
  verifyTag: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  pressed: { opacity: 0.6 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  planDone: { textDecorationLine: 'line-through', opacity: 0.5 },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Palette.gray300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addType: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.md },
  typeChip: { borderWidth: 0.5, borderColor: Palette.lineStrong, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 4 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  addInput: {
    flex: 1,
    backgroundColor: Palette.gray100,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    color: Palette.gray900,
  },
  addBtn: { width: 38, height: 38, borderRadius: Radius.small, backgroundColor: Palette.primary, alignItems: 'center', justifyContent: 'center' },
  addBtnOff: { backgroundColor: Palette.gray300 },
});
