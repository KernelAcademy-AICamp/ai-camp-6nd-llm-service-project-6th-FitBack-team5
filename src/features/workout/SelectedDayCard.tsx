/**
 * 운동 홈에서 선택한 일자의 운동 데이터 카드.
 * 운동시간(MM:SS) / 칼로리(kcal) / 완료여부 / AI 피드백 — 운동 완료 페이지와 동일한 시각 패턴.
 * 기록이 없으면 빈 상태 메시지.
 */

import { Clock, Flame } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Elevation, Palette, Radius, Spacing } from '@/constants/theme';

import { useDayWorkoutLogs } from './useDayWorkoutLog';

function formatDateKo(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${m}월 ${d}일`;
}

/** ISO timestamptz → "H시 MM분" (Asia/Seoul). 사용자 로컬 TZ 무관하게 KST 로 환산. */
function formatKstTime(iso: string): string {
  const utcMs = new Date(iso).getTime();
  const kst = new Date(utcMs + 9 * 60 * 60 * 1000);
  const h = kst.getUTCHours();
  const m = kst.getUTCMinutes().toString().padStart(2, '0');
  return `${h}시 ${m}분`;
}

export function SelectedDayCard({ date }: { date: string }) {
  const { data: logs, isLoading } = useDayWorkoutLogs(date);
  // AI 피드백은 가장 최근 1건 기준. 시간/칼로리 합계는 모든 로그에서 산출.
  const latest = logs?.[0] ?? null;

  if (isLoading) {
    return (
      <ThemedView
        type="backgroundElement"
        style={[styles.card, { borderColor: Palette.lineDefault }, Elevation.level1]}>
        <View style={styles.center}>
          <ActivityIndicator color={Palette.primary} />
        </View>
      </ThemedView>
    );
  }

  if (!logs || logs.length === 0 || !latest) {
    return (
      <ThemedView
        type="backgroundElement"
        style={[styles.card, { borderColor: Palette.lineDefault }, Elevation.level1]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          이 날짜에는 운동 기록이 없어요.
        </ThemedText>
      </ThemedView>
    );
  }

  // 시간 순(오래된 → 최신)으로 정렬 — DB 쿼리는 DESC 라 표시 시 reverse.
  const feedbackEntries = logs.slice().reverse().map((l) => ({
    id: l.id,
    time: formatKstTime(l.createdAt),
    summary: l.aiFeedback?.summary?.trim() ?? '',
  }));
  // 선택일 모든 운동의 합 — actualDurationSec 가 null 인 구 기록은 durationMin*60 으로 보정.
  const totalPlannedMin = logs.reduce((a, l) => a + l.durationMin, 0);
  const totalActualMin = logs.reduce(
    (a, l) =>
      a +
      (l.actualDurationSec !== null
        ? Math.max(0, Math.round(l.actualDurationSec / 60))
        : l.durationMin),
    0,
  );
  const totalCalories = logs.reduce((a, l) => a + l.calories, 0);

  return (
    <View style={styles.wrapper}>
      <View style={styles.statsRow}>
        <ThemedView
          type="backgroundElement"
          style={[styles.statCard, { borderColor: Palette.lineDefault }, Elevation.level1]}>
          <Clock color={Palette.primary} size={20} />
          <ThemedText type="small" themeColor="textSecondary">
            총 운동 시간
          </ThemedText>
          <View style={styles.timeRow}>
            <ThemedText type="title" style={{ color: Palette.primary }}>
              {totalActualMin}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              / {totalPlannedMin}분
            </ThemedText>
          </View>
        </ThemedView>
        <ThemedView
          type="backgroundElement"
          style={[styles.statCard, { borderColor: Palette.lineDefault }, Elevation.level1]}>
          <Flame color={Palette.warning} size={20} />
          <ThemedText type="small" themeColor="textSecondary">
            총 칼로리
          </ThemedText>
          <ThemedText type="subtitle">{totalCalories} kcal</ThemedText>
        </ThemedView>
      </View>

      <ThemedView
        type="backgroundElement"
        style={[styles.feedbackCard, { borderColor: Palette.lineDefault }, Elevation.level1]}>
        <View style={[styles.feedbackBadge, { backgroundColor: Palette.primaryLight }]}>
          <ThemedText type="smallBold" style={{ color: Palette.primary }}>
            💬 AI 피드백 ({formatDateKo(date)})
          </ThemedText>
        </View>
        {/* <ThemedText type="subtitle">{data.routineTitle}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {data.routineMeta}
        </ThemedText> */}
        {feedbackEntries.map((e) => (
          <ThemedText
            key={e.id}
            type="default"
            themeColor={e.summary ? 'text' : 'textSecondary'}>
            <ThemedText type="default" style={{ color: Palette.primary }}>
              {e.time}
            </ThemedText>
            {' : '}
            {e.summary || '피드백 없음'}
          </ThemedText>
        ))}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.sm,
  },
  card: {
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  center: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.xs,
    alignItems: 'center',
  },
  // 실제분(큰 보라) + "/ 계획분" (작은 회색) 베이스라인 정렬.
  timeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  feedbackCard: {
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  feedbackBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.small,
  },
});
