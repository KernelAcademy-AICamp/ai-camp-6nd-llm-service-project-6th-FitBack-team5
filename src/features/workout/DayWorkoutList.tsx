/**
 * 선택일의 모든 workout_logs 를 컴팩트 목록으로 노출.
 * 각 행: 아이콘 박스(body_part 별 분기) + (routineMeta · 완료여부) + routineTitle.
 * 클릭/드릴다운 없음. 정보 표시만.
 */

import { Activity, Dumbbell, type LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Elevation, Palette, Radius, Spacing } from '@/constants/theme';

import {
  type CompletionStatus,
  type WorkoutBodyPart,
  useDayWorkoutLogs,
} from './useDayWorkoutLog';

// 'missed' 는 useDayWorkoutLogs 에서 이미 제외되므로 목록 렌더에서는 사실상 마주칠 일이 없다.
const COMPLETION_LABEL: Record<CompletionStatus, string> = {
  completed: '전부 완료',
  partial: '일부 완료',
  missed: '모두 건너뜀',
};

// 이번 주 홈트 현황 카드의 셀 색상과 1:1 매칭 (completed=primary, partial=warning).
const COMPLETION_COLOR: Record<CompletionStatus, string> = {
  completed: Palette.primary,
  partial: Palette.warning,
  missed: Palette.gray500,
};

function iconFor(bodyPart: WorkoutBodyPart | null): LucideIcon {
  return bodyPart === 'cardio' ? Activity : Dumbbell;
}

function formatDateKo(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${m}월 ${d}일`;
}

/** ISO timestamptz → "H:MM" (Asia/Seoul). 사용자 로컬 TZ 무관. */
function formatKstHM(iso: string): string {
  const utcMs = new Date(iso).getTime();
  const kst = new Date(utcMs + 9 * 60 * 60 * 1000);
  const h = kst.getUTCHours();
  const m = kst.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** routineTitle 안의 이모지/특수문자 제거 — Edge Function 의 LLM 이 가끔 끼워 넣는 것을 표시 단계에서 차단. */
function stripEmoji(text: string): string {
  return text
    .replace(/[\p{Extended_Pictographic}‍️]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function DayWorkoutList({ date }: { date: string }) {
  const { data: logs, isLoading } = useDayWorkoutLogs(date);

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, { borderColor: Palette.lineDefault }, Elevation.level1]}>
      <ThemedText type="smallBold">{formatDateKo(date)} 홈트했어요!</ThemedText>

      {isLoading && (
        <View style={styles.center}>
          <ActivityIndicator color={Palette.primary} />
        </View>
      )}

      {!isLoading && (!logs || logs.length === 0) && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          운동 기록이 없어요
        </ThemedText>
      )}

      {!isLoading &&
        logs &&
        // DB 는 created_at DESC 반환 → 시간순 오름차순 표시를 위해 reverse.
        logs.slice().reverse().map((log, idx) => {
          const Icon = iconFor(log.bodyPart);
          return (
            <View
              key={log.id}
              style={[
                styles.row,
                idx !== 0 && {
                  borderTopColor: Palette.lineDefault,
                  borderTopWidth: StyleSheet.hairlineWidth,
                },
              ]}>
              <View style={[styles.iconBox, { backgroundColor: Palette.primaryLight }]}>
                <Icon color={Palette.primary} size={20} />
              </View>
              <View style={styles.rowText}>
                <ThemedText type="small" themeColor="textSecondary">
                  {log.routineMeta} /{' '}
                  <ThemedText
                    type="small"
                    style={{ color: COMPLETION_COLOR[log.completionStatus] }}>
                    {COMPLETION_LABEL[log.completionStatus]}
                  </ThemedText>
                  {' ('}{formatKstHM(log.createdAt)}{')'}
                </ThemedText>
                {/* subtitle(20px) 기준에서 2px 축소. semibold 가중치 유지. */}
                <ThemedText type="subtitle" style={{ fontSize: 18, lineHeight: 23 }}>
                  {stripEmoji(log.routineTitle)}
                </ThemedText>
              </View>
            </View>
          );
        })}
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
