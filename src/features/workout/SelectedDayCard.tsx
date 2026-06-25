/**
 * 운동 홈에서 선택한 일자의 운동 데이터 카드.
 * 운동시간(MM:SS) / 칼로리(kcal) / 완료여부 / AI 피드백 — 운동 완료 페이지와 동일한 시각 패턴.
 * 기록이 없어도 빈 메시지 대신 0 kcal / 0 분으로 노출.
 */

import { ChevronRight, Clock, Flame } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

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

export function SelectedDayCard({
  date,
  onPressMore,
}: {
  date: string;
  onPressMore?: () => void;
}) {
  const { data: logs, isLoading } = useDayWorkoutLogs(date);

  const header = (
    <View style={styles.summaryHeader}>
      <ThemedText type="subtitle">오늘의 홈트 요약</ThemedText>
      {onPressMore ? (
        <Pressable
          onPress={onPressMore}
          hitSlop={8}
          style={({ pressed }) => [styles.moreBtn, { opacity: pressed ? 0.6 : 1 }]}>
          <ThemedText type="small" themeColor="textSecondary">
            더보기
          </ThemedText>
          <ChevronRight color={Palette.gray500} size={16} />
        </Pressable>
      ) : null}
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.summaryWrap}>
        {header}
        <ThemedView
          type="backgroundElement"
          style={[styles.card, { borderColor: Palette.lineDefault }, Elevation.level1]}>
          <View style={styles.center}>
            <ActivityIndicator color={Palette.primary} />
          </View>
        </ThemedView>
      </View>
    );
  }

  // 선택일 모든 운동의 합 — actualDurationSec 가 null 인 구 기록은 durationMin*60 으로 보정.
  // 기록이 없으면 두 값 모두 0 으로 표시 (빈 메시지 대신).
  // 실제 운동시간은 MM:SS 포맷으로 표시(예: 00:20 / 15분).
  const totalPlannedMin = (logs ?? []).reduce((a, l) => a + l.durationMin, 0);
  const totalActualSec = (logs ?? []).reduce(
    (a, l) => a + (l.actualDurationSec !== null ? Math.max(0, l.actualDurationSec) : l.durationMin * 60),
    0,
  );
  const actualMM = Math.floor(totalActualSec / 60).toString().padStart(2, '0');
  const actualSS = (totalActualSec % 60).toString().padStart(2, '0');
  const totalCalories = (logs ?? []).reduce((a, l) => a + l.calories, 0);

  return (
    <View style={styles.summaryWrap}>
      {header}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: Palette.bgMuted }]}>
          <Clock color={Palette.primary} size={20} />
          <View style={styles.statTexts}>
            <ThemedText type="small" themeColor="textSecondary">
              총 운동시간
            </ThemedText>
            <ThemedText type="title" style={{ color: Palette.primary }}>
              {actualMM}:{actualSS}
              <ThemedText type="small" themeColor="textSecondary">
                {' '}/ {totalPlannedMin}분
              </ThemedText>
            </ThemedText>
          </View>
        </View>
        <View style={[styles.statCard, { backgroundColor: Palette.bgMuted }]}>
          <Flame color={Palette.warning} size={20} />
          <View style={styles.statTexts}>
            <ThemedText type="small" themeColor="textSecondary">
              총 소모 칼로리
            </ThemedText>
            <ThemedText type="subtitle">{totalCalories} kcal</ThemedText>
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * 선택일 AI 피드백 카드 — DayWorkoutList 아래에 단독 배치되도록 분리됨.
 * 같은 useDayWorkoutLogs 훅을 공유하므로 추가 네트워크 비용 없음.
 */
export function SelectedDayFeedback({ date }: { date: string }) {
  const { data: logs, isLoading } = useDayWorkoutLogs(date);
  if (isLoading || !logs || logs.length === 0) return null;

  const feedbackEntries = logs.slice().reverse().map((l) => ({
    id: l.id,
    time: formatKstTime(l.createdAt),
    summary: l.aiFeedback?.summary?.trim() ?? '',
  }));

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.feedbackCard, { borderColor: Palette.lineDefault }, Elevation.level1]}>
      <View style={[styles.feedbackBadge, { backgroundColor: Palette.primaryLight }]}>
        <ThemedText type="smallBold" style={{ color: Palette.primary }}>
          💬 AI 피드백 ({formatDateKo(date)})
        </ThemedText>
      </View>
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
  );
}

const styles = StyleSheet.create({
  summaryWrap: {
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  card: {
    padding: Spacing.card,
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
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: Radius.card,
  },
  statTexts: {
    alignItems: 'center',
    gap: 2,
  },
  feedbackCard: {
    padding: Spacing.card,
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
