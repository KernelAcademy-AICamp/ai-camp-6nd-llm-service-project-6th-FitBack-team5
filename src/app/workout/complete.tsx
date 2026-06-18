import { useRouter } from 'expo-router';
import { CheckCircle2, Clock, Flame, PartyPopper } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  BottomTabInset,
  Elevation,
  MaxContentWidth,
  Palette,
  Radius,
  ScreenPadding,
  Spacing,
} from '@/constants/theme';
import type { Routine } from '@/features/workout/useGenerateRoutine';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useWorkoutSession } from '@/stores/workout-session';

type Difficulty = 'easy' | 'good' | 'hard';
type CompletionStatus = 'completed' | 'partial' | 'missed';
type WorkoutBodyPart = 'lower' | 'upper' | 'full' | 'cardio';

interface AiFeedback {
  summary: string;
  nextAdjustment: string;
  encouragement: string;
}

function parseBodyPart(title: string): WorkoutBodyPart | null {
  if (title.includes('하체')) return 'lower';
  if (title.includes('상체')) return 'upper';
  if (title.includes('전신')) return 'full';
  if (title.includes('유산소') || title.includes('cardio')) return 'cardio';
  return null;
}

function parseDurationMin(meta: string): number {
  const m = meta.match(/(\d+)\s*분/);
  return m ? parseInt(m[1], 10) : 0;
}

function formatElapsed(sec: number): string {
  const mm = Math.floor(sec / 60).toString().padStart(2, '0');
  const ss = (sec % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

// 칼로리 = MET × 체중(kg) × 시간(h). 스트레칭은 2.5, 메인 운동은 6 MET 로 추정.
// 운동별 정확한 시간은 모르므로 루틴 총 시간을 운동 개수로 균등 분배.
const STRETCH_MET = 2.5;
const MAIN_MET = 6;
const DEFAULT_WEIGHT_KG = 60;

function calculateCalories(routine: Routine, weight: number): number {
  const totalMin = parseDurationMin(routine.meta);
  const n = routine.exercises.length;
  if (totalMin <= 0 || n === 0 || weight <= 0) return 0;
  const perExerciseHour = totalMin / n / 60;
  const sum = routine.exercises.reduce((acc, ex) => {
    const met = ex.isStretch ? STRETCH_MET : MAIN_MET;
    return acc + met * weight * perExerciseHour;
  }, 0);
  return Math.round(sum);
}

async function fetchUserWeight(userId: string): Promise<number> {
  const { data } = await supabase
    .from('profiles')
    .select('weight')
    .eq('id', userId)
    .maybeSingle();
  const w = data?.weight;
  return typeof w === 'number' && w > 0 ? w : DEFAULT_WEIGHT_KG;
}

interface FeedbackContext {
  routineTitle: string;
  exerciseCount: number;
  completionStatus: CompletionStatus;
  calories: number;
}

async function fetchAiFeedback(ctx: FeedbackContext): Promise<AiFeedback> {
  const { data, error } = await supabase.functions.invoke<
    AiFeedback & { error?: string }
  >('workout-ai', { body: { action: 'workout-feedback', ...ctx } });

  if (error || !data) {
    throw new Error(
      data?.error ?? error?.message ?? 'AI 피드백 생성에 실패했어요.',
    );
  }
  if (data.error) throw new Error(data.error);
  if (
    typeof data.summary !== 'string' ||
    typeof data.nextAdjustment !== 'string' ||
    typeof data.encouragement !== 'string'
  ) {
    throw new Error('AI 응답 형식이 올바르지 않습니다.');
  }
  return {
    summary: data.summary,
    nextAdjustment: data.nextAdjustment,
    encouragement: data.encouragement,
  };
}

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: '쉬웠어요' },
  { value: 'good', label: '적당했어요' },
  { value: 'hard', label: '힘들었어요' },
] as const satisfies readonly { value: Difficulty; label: string }[];

const PAIN_OPTIONS = ['없어요', '무릎', '허리', '어깨'] as const;
const PAIN_NONE = PAIN_OPTIONS[0];

export default function CompleteScreen() {
  const theme = useTheme();
  const router = useRouter();
  const routine = useWorkoutSession((s) => s.routine);
  const completedCount = useWorkoutSession((s) => s.completedCount);
  const sessionStartedAt = useWorkoutSession((s) => s.sessionStartedAt);
  const clearRoutine = useWorkoutSession((s) => s.clear);

  // 진입 시 1회 캡처 — 이후 리렌더에 영향받지 않게 routine 키로만 갱신.
  const elapsedSec = useMemo(() => {
    if (!sessionStartedAt) return 0;
    return Math.max(0, Math.round((Date.now() - sessionStartedAt) / 1000));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routine]);

  const total = routine?.exercises.length ?? 0;
  const completed = Math.min(completedCount, total);
  const missed = Math.max(0, total - completed);
  const completionStatus: CompletionStatus =
    total > 0 && completed >= total ? 'completed' : 'partial';

  // 운동 기록 row id — 초기 INSERT 후 보관, 이후 UPDATE 에 사용.
  const [logId, setLogId] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [calories, setCalories] = useState(0);
  const [feedback, setFeedback] = useState<AiFeedback | null>(null);
  const [feedbackError, setFeedbackError] = useState(false);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(true);

  // 리뷰 폼
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [painAreas, setPainAreas] = useState<string[]>([]);
  const [memo, setMemo] = useState('');
  const [isReviewSaving, setIsReviewSaving] = useState(false);
  // 토스트 — kind: 성공('success') 시 자동 네비게이트, 실패('error') 시 현재 페이지 유지.
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  // routine 없으면 workout 으로 (새로고침 등)
  useEffect(() => {
    if (!routine) router.replace('/workout');
  }, [routine, router]);

  // 마운트 시 1회 — 초기 INSERT + AI 피드백 fetch. ref 로 strict-mode 더블 호출 방지.
  const initOnceRef = useRef(false);
  useEffect(() => {
    if (initOnceRef.current) return;
    if (!routine) return;
    initOnceRef.current = true;

    (async () => {
      const userResp = await supabase.auth.getUser();
      const userId = userResp.data.user?.id;
      if (!userId) {
        setInitError('로그인이 필요합니다.');
        setIsFeedbackLoading(false);
        return;
      }
      const weight = await fetchUserWeight(userId);
      const cal = calculateCalories(routine, weight);
      setCalories(cal);

      const { data: log, error: insertErr } = await supabase
        .from('workout_logs')
        .insert({
          user_id: userId,
          routine_title: routine.title,
          routine_meta: routine.meta,
          duration_min: parseDurationMin(routine.meta),
          // 실제 경과 초 — 일부완료 시 "{실제}/{계획}분" 비율 표시에 사용.
          actual_duration_sec: elapsedSec,
          exercise_count: total,
          pain_areas: [],
          completion_status: completionStatus,
          body_part: parseBodyPart(routine.title),
          calories: cal,
        })
        .select('id')
        .single();

      if (insertErr || !log) {
        setInitError('기록 저장에 실패했어요.');
        setIsFeedbackLoading(false);
        return;
      }
      setLogId(log.id);

      try {
        const fb = await fetchAiFeedback({
          routineTitle: routine.title,
          exerciseCount: total,
          completionStatus,
          calories: cal,
        });
        setFeedback(fb);
        // ai_feedback 백필 — 실패해도 화면에는 이미 표시됐으니 조용히 무시.
        await supabase
          .from('workout_logs')
          .update({ ai_feedback: fb })
          .eq('id', log.id);
      } catch {
        setFeedbackError(true);
      } finally {
        setIsFeedbackLoading(false);
      }
    })();
    // 마운트 1회 가드는 ref 로 처리. routine 변경은 사실상 발생하지 않음.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routine]);

  if (!routine) {
    return <ThemedView style={styles.container} />;
  }

  const hasAnyReview =
    difficulty !== null || painAreas.length > 0 || memo.trim().length > 0;
  const canSubmitReview =
    hasAnyReview && logId !== null && !isReviewSaving && toast?.kind !== 'success';

  function togglePainArea(opt: string) {
    setPainAreas((prev) => {
      const isActive = prev.includes(opt);
      if (opt === PAIN_NONE) {
        return isActive ? [] : [PAIN_NONE];
      }
      const withoutNone = prev.filter((v) => v !== PAIN_NONE);
      if (isActive) return withoutNone.filter((v) => v !== opt);
      return [...withoutNone, opt];
    });
  }

  async function handleSaveReview() {
    if (!logId || !canSubmitReview) return;
    setIsReviewSaving(true);

    // 채워진 필드만 UPDATE — 빈 칸은 NULL/기본값 유지.
    const updates: Record<string, unknown> = {};
    if (difficulty !== null) updates.difficulty = difficulty;
    if (painAreas.length > 0) updates.pain_areas = painAreas;
    if (memo.trim()) updates.memo = memo.trim();

    const { error } = await supabase
      .from('workout_logs')
      .update(updates)
      .eq('id', logId);

    setIsReviewSaving(false);
    if (error) {
      setToast({ kind: 'error', text: '리뷰 남기기에 실패하였습니다.' });
      setTimeout(() => setToast(null), 2500);
      return;
    }
    setToast({ kind: 'success', text: '리뷰가 저장되었습니다' });
    // 짧은 노출 후 '내일 운동 만들기' 와 동일 동작: store 정리 + 운동 홈으로 replace.
    setTimeout(() => {
      clearRoutine();
      router.replace('/workout');
    }, 1200);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            <View style={styles.headerCelebrate}>
              <ThemedText type="title" style={styles.titleCenter}>
                운동 완료!
              </ThemedText>
              <PartyPopper color={Palette.primary} size={56} />
            </View>

            <View style={styles.statsRow}>
              <ThemedView
                type="backgroundElement"
                style={[styles.statCard, { borderColor: Palette.lineDefault }, Elevation.level1]}>
                <Clock color={Palette.primary} size={20} />
                <ThemedText type="small" themeColor="textSecondary">
                  운동 시간
                </ThemedText>
                <ThemedText type="subtitle">{formatElapsed(elapsedSec)}</ThemedText>
              </ThemedView>
              <ThemedView
                type="backgroundElement"
                style={[styles.statCard, { borderColor: Palette.lineDefault }, Elevation.level1]}>
                <Flame color={Palette.warning} size={20} />
                <ThemedText type="small" themeColor="textSecondary">
                  칼로리
                </ThemedText>
                <ThemedText type="subtitle">{calories} kcal</ThemedText>
              </ThemedView>
              <ThemedView
                type="backgroundElement"
                style={[styles.statCard, { borderColor: Palette.lineDefault }, Elevation.level1]}>
                <CheckCircle2 color={Palette.profit} size={20} />
                <ThemedText type="small" themeColor="textSecondary">
                  완료여부
                </ThemedText>
                <ThemedText type="smallBold">
                  완료 {completed} / 미완료 {missed}
                </ThemedText>
              </ThemedView>
            </View>

            <ThemedView
              type="backgroundElement"
              style={[styles.feedbackCard, { borderColor: Palette.lineDefault }, Elevation.level1]}>
              <View style={[styles.feedbackBadge, { backgroundColor: Palette.primaryLight }]}>
                <ThemedText type="smallBold" style={{ color: Palette.primary }}>
                  💬 AI 피드백
                </ThemedText>
              </View>
              {isFeedbackLoading && (
                <View style={styles.feedbackLoading}>
                  <ActivityIndicator color={Palette.primary} />
                  <ThemedText
                    type="small"
                    themeColor="textSecondary"
                    style={styles.feedbackLoadingText}>
                    AI가 오늘 기록을 분석하고 있어요...
                  </ThemedText>
                </View>
              )}
              {feedback && (
                <View style={styles.feedbackContent}>
                  <ThemedText type="default">{feedback.summary}</ThemedText>
                  <ThemedText type="default">{feedback.nextAdjustment}</ThemedText>
                  <ThemedText type="default">{feedback.encouragement}</ThemedText>
                </View>
              )}
              {feedbackError && (
                <ThemedText type="small" themeColor="textSecondary">
                  피드백을 불러오지 못했어요. 다음에 다시 확인해주세요.
                </ThemedText>
              )}
            </ThemedView>

            {initError && (
              <View
                style={[
                  styles.errorCard,
                  { backgroundColor: theme.backgroundElement, borderColor: Palette.error },
                ]}>
                <ThemedText type="smallBold" style={{ color: Palette.error }}>
                  {initError}
                </ThemedText>
              </View>
            )}

            <View style={styles.reviewHeader}>
              <ThemedText type="subtitle">운동 리뷰를 남기세요</ThemedText>
            </View>

            <View style={styles.section}>
              <ThemedText type="smallBold">운동 난이도</ThemedText>
              <View style={styles.chipRow}>
                {DIFFICULTY_OPTIONS.map((opt) => {
                  const active = opt.value === difficulty;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setDifficulty(opt.value)}
                      style={({ pressed }) => [
                        styles.chip,
                        {
                          backgroundColor: active ? Palette.primary : Palette.bgMuted,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}>
                      <ThemedText
                        type="smallBold"
                        style={{ color: active ? Palette.white : Palette.gray700 }}>
                        {opt.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <ThemedText type="smallBold">통증/불편 부위</ThemedText>
              <View style={styles.chipRow}>
                {PAIN_OPTIONS.map((opt) => {
                  const active = painAreas.includes(opt);
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => togglePainArea(opt)}
                      style={({ pressed }) => [
                        styles.chip,
                        {
                          backgroundColor: active ? Palette.primary : Palette.bgMuted,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}>
                      <ThemedText
                        type="smallBold"
                        style={{ color: active ? Palette.white : Palette.gray700 }}>
                        {opt}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <ThemedText type="smallBold">메모 (선택)</ThemedText>
              <TextInput
                value={memo}
                onChangeText={setMemo}
                placeholder="예: 브릿지는 괜찮았는데 푸쉬업은 힘들었어요."
                placeholderTextColor={theme.textSecondary}
                maxLength={200}
                multiline
                style={[
                  styles.memoInput,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: Palette.lineDefault,
                    color: theme.text,
                  },
                ]}
              />
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={styles.memoCounter}>
                {memo.length}/200
              </ThemedText>
            </View>

            <View style={styles.ctaRow}>
              <Pressable
                onPress={handleSaveReview}
                disabled={!canSubmitReview}
                style={({ pressed }) => [
                  styles.primaryCta,
                  styles.flex1,
                  {
                    backgroundColor: !canSubmitReview
                      ? Palette.bgMuted
                      : pressed
                        ? Palette.primaryPressed
                        : Palette.primary,
                    opacity: isReviewSaving ? 0.7 : 1,
                  },
                ]}>
                {isReviewSaving ? (
                  <ActivityIndicator color={Palette.white} />
                ) : (
                  <ThemedText
                    type="subtitle"
                    style={{ color: canSubmitReview ? Palette.white : theme.textSecondary }}>
                    운동 리뷰 남기기
                  </ThemedText>
                )}
              </Pressable>

              {/* 리뷰 남기지 않고 운동 홈으로 — clearRoutine + replace 로 뒤로가기 X */}
              <Pressable
                onPress={() => {
                  clearRoutine();
                  router.replace('/workout');
                }}
                style={({ pressed }) => [
                  styles.primaryCta,
                  styles.flex1,
                  {
                    backgroundColor: pressed ? Palette.gray100 : Palette.bgMuted,
                    borderColor: Palette.lineDefault,
                    borderWidth: StyleSheet.hairlineWidth,
                  },
                ]}>
                <ThemedText type="subtitle" themeColor="text">
                  운동 홈 가기
                </ThemedText>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
        {toast && (
          <View
            pointerEvents="none"
            style={[
              styles.toastContainer,
              {
                // 8자리 hex 의 끝 E6 = 약 90% alpha — 살짝 비치는 느낌.
                backgroundColor:
                  toast.kind === 'error' ? `${Palette.error}E6` : `${Palette.gray900}E6`,
              },
            ]}>
            <ThemedText type="smallBold" style={{ color: Palette.white }}>
              {toast.text}
            </ThemedText>
          </View>
        )}
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  scrollContent: {
    paddingHorizontal: ScreenPadding,
    paddingTop: Spacing.lg,
    paddingBottom: BottomTabInset + Spacing.lg,
    gap: Spacing.md,
  },
  headerCelebrate: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  titleCenter: { textAlign: 'center' },
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
  feedbackLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  feedbackLoadingText: {
    flex: 1,
  },
  feedbackContent: {
    gap: Spacing.xs,
  },
  errorCard: {
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.xs,
  },
  reviewHeader: {
    paddingTop: Spacing.md,
  },
  section: { gap: Spacing.sm },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  chip: {
    flex: 1,
    minHeight: 36,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoInput: {
    minHeight: 88,
    borderRadius: Radius.button,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  memoCounter: {
    textAlign: 'right',
  },
  primaryCta: {
    height: 52,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  flex1: { flex: 1 },
  toastContainer: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: BottomTabInset + Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.button,
    alignItems: 'center',
  },
});
