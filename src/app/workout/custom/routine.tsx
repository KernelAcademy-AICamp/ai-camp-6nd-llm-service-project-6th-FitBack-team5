/**
 * 2/4 루틴 생성 — 선택 운동 60분 균등 배분 + "루틴 시작".
 *
 * 처음 진입 시 draft.items 가 비어 있으면 카탈로그 기반으로 buildItems 실행.
 * "루틴 시작" → workout_sessions INSERT → /workout/custom/record
 */

import { useRouter } from 'expo-router';
import { ChevronLeft, Lightbulb, Clock } from 'lucide-react-native';
import { useEffect } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Icon } from '@/components/ui';
import {
  BottomTabInset,
  MaxContentWidth,
  Palette,
  Radius,
  ScreenPadding,
  Spacing,
} from '@/constants/theme';
import { ExerciseThumb } from '@/features/workout-custom/ExerciseThumb';
import { useStartSession } from '@/features/workout-custom/useSession';
import { useCustomWorkoutDraft } from '@/stores/workout-custom';

const TOTAL_MIN = 60;

export default function RoutineScreen() {
  const router = useRouter();
  const selected = useCustomWorkoutDraft((s) => s.selected);
  const items = useCustomWorkoutDraft((s) => s.items);
  const buildItems = useCustomWorkoutDraft((s) => s.buildItems);
  const setSessionId = useCustomWorkoutDraft((s) => s.setSessionId);

  const startMut = useStartSession();

  // 선택 정보가 없으면 select 화면으로 되돌림.
  useEffect(() => {
    if (selected.length === 0) router.replace('/workout/custom/select');
  }, [selected.length, router]);

  // 진입 시 items 1회 생성(누적 선택 기반 60분 균등 배분).
  useEffect(() => {
    if (!items && selected.length > 0) {
      buildItems(TOTAL_MIN);
    }
  }, [items, selected.length, buildItems]);

  const perMin = items && items.length > 0 ? items[0].duration_min : 0;

  async function handleStart() {
    if (!items || items.length === 0) return;
    // 세션 레벨 body_part/exercise_type 은 요약 라벨 — 첫 종목 기준(혼합 시에도 check 통과).
    const summaryBody = items[0].body_part;
    const summaryType = items[0].exercise_type;
    try {
      const session = await startMut.mutateAsync({
        body_part: summaryBody,
        exercise_type: summaryType,
        total_duration_min: TOTAL_MIN,
        items,
      });
      setSessionId(session.id);
      router.replace('/workout/custom/record');
    } catch (e) {
      Alert.alert('루틴 시작 실패', e instanceof Error ? e.message : '잠시 후 다시 시도해주세요.');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}>
            <Icon icon={ChevronLeft} size={24} color={Palette.gray900} />
          </Pressable>
          <ThemedText type="subtitle">루틴 생성</ThemedText>
          <ThemedText type="captionBold" style={{ color: Palette.gray500 }}>
            2 / 4
          </ThemedText>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* 총 운동 시간 카드 */}
          <View style={styles.summaryCard}>
            <View style={{ flex: 1 }}>
              <ThemedText type="caption" themeColor="textSecondary">
                총 운동 시간
              </ThemedText>
              <ThemedText type="display" style={{ marginTop: Spacing.xs }}>
                {TOTAL_MIN}분
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={{ marginTop: Spacing.sm }}>
                선택한 {selected.length}개 운동을 동일한 시간으로 구성했어요.
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                ({TOTAL_MIN}분 ÷ {selected.length}개 운동 = 각 {perMin}분씩)
              </ThemedText>
            </View>
            <View style={styles.summaryIcon}>
              <Icon icon={Clock} size={28} color={Palette.primary} />
            </View>
          </View>

          <ThemedText type="subtitle" style={{ marginTop: Spacing.lg }}>
            나의 커스텀 루틴
          </ThemedText>

          <View style={{ marginTop: Spacing.sm, gap: Spacing.sm }}>
            {(items ?? []).map((it, idx) => (
              <View key={it.catalog_id} style={styles.row}>
                <ExerciseThumb imagePath={it.image_path} size={48} />
                <View style={{ flex: 1 }}>
                  <ThemedText type="captionBold">
                    {idx + 1}  {it.name}
                  </ThemedText>
                  <ThemedText type="label" themeColor="textSecondary" style={{ marginTop: 2 }}>
                    {it.exercise_type} · {it.body_part}
                  </ThemedText>
                </View>
                <View style={styles.minBadge}>
                  <ThemedText type="captionBold" style={{ color: Palette.primary }}>
                    {it.duration_min}분
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>

          {/* TIP 박스 */}
          <View style={styles.tipBox}>
            <Icon icon={Lightbulb} size={18} color={Palette.primary} />
            <ThemedText type="small" style={{ color: Palette.gray700, flex: 1 }}>
              TIP{'\n'}
              <ThemedText type="small" themeColor="textSecondary">
                다른 종목을 원하면 뒤로 돌아가 다시 선택할 수 있어요.
              </ThemedText>
            </ThemedText>
          </View>

          {/* CTA — 콘텐츠 끝에 인라인으로 배치 (스크롤 끝에서 노출) */}
          <View style={styles.ctaWrap}>
            <Button
              label="루틴 시작"
              loading={startMut.isPending}
              disabled={!items || items.length === 0}
              onPress={handleStart}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.bgBase },
  safe: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ScreenPadding,
    height: 52,
  },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: ScreenPadding,
    // 하단 fixed 탭 바에 가려지지 않도록 BottomTabInset 보정.
    paddingBottom: Spacing.xxl + BottomTabInset,
  },

  summaryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.card,
    padding: Spacing.md,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Palette.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Palette.bgSurface,
    borderRadius: Radius.card,
    borderWidth: 0.5,
    borderColor: Palette.lineDefault,
    padding: Spacing.md,
  },
  rowThumb: {
    width: 48,
    height: 48,
    borderRadius: Radius.button,
    backgroundColor: Palette.bgMuted,
  },
  minBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Palette.primaryLight,
  },

  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Palette.bgSurface,
    borderRadius: Radius.card,
    borderWidth: 0.5,
    borderColor: Palette.lineDefault,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },

  ctaWrap: {
    marginTop: Spacing.lg,
  },
});
