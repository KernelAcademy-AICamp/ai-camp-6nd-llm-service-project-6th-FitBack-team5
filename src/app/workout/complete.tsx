import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useWorkoutSession } from '@/stores/workout-session';

type Difficulty = 'easy' | 'good' | 'hard';
type CompletionStatus = 'completed' | 'partial' | 'missed';

interface AiFeedback {
  summary: string;
  nextAdjustment: string;
  encouragement: string;
}

type WorkoutBodyPart = 'lower' | 'upper' | 'full' | 'cardio';

function parseBodyPart(title: string): WorkoutBodyPart | null {
  if (title.includes('하체')) return 'lower';
  if (title.includes('상체')) return 'upper';
  if (title.includes('전신')) return 'full';
  if (title.includes('유산소') || title.includes('cardio')) return 'cardio';
  return null;
}

type WorkoutLogInsert = {
  user_id: string;
  routine_title: string;
  routine_meta: string;
  duration_min: number;
  exercise_count: number;
  difficulty: Difficulty;
  pain_areas: string[];
  completion_status: CompletionStatus;
  memo: string | null;
  body_part?: WorkoutBodyPart | null;
  ai_feedback?: object | null;
};

// 프롬프트·schema 는 모두 Edge Function (supabase/functions/workout-feedback) 에 있음.
// 키는 서버 secret(ANTHROPIC_API_KEY) 으로만 존재. 클라이언트는 입력만 넘기고 결과를 받는다.
async function fetchAiFeedback(input: {
  difficulty: Difficulty;
  painAreas: string[];
  completionStatus: CompletionStatus;
  memo: string;
}): Promise<AiFeedback> {
  const { data, error } = await supabase.functions.invoke<
    AiFeedback & { error?: string }
  >('workout-ai', { body: { action: 'workout-feedback', ...input } });

  if (error || !data) {
    throw new Error(
      data?.error ?? error?.message ?? 'AI 피드백 생성에 실패했어요.',
    );
  }
  if (data.error) {
    throw new Error(data.error);
  }
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

const COMPLETION_OPTIONS = [
  { value: 'completed', label: '전부 완료' },
  { value: 'partial', label: '일부만 완료' },
  { value: 'missed', label: '못 했어요' },
] as const satisfies readonly { value: CompletionStatus; label: string }[];

function parseDurationMin(meta: string): number {
  const m = meta.match(/(\d+)\s*분/);
  return m ? parseInt(m[1], 10) : 0;
}

export default function CompleteScreen() {
  const theme = useTheme();
  const router = useRouter();
  const routine = useWorkoutSession((s) => s.routine);
  const completedCount = useWorkoutSession((s) => s.completedCount);
  const clearRoutine = useWorkoutSession((s) => s.clear);

  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [painAreas, setPainAreas] = useState<string[]>([]);
  const [completionStatus, setCompletionStatus] =
    useState<CompletionStatus | null>('completed');
  const [memo, setMemo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
  const [feedback, setFeedback] = useState<AiFeedback | null>(null);
  const [feedbackError, setFeedbackError] = useState(false);

  useEffect(() => {
    if (!routine) router.replace('/workout');
  }, [routine, router]);

  if (!routine) {
    return <ThemedView style={styles.container} />;
  }

  const durationMin = parseDurationMin(routine.meta);
  const canSave = difficulty !== null && completionStatus !== null;

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

  async function handleSave() {
    if (!canSave || !routine) return;
    setIsSaving(true);

    const userResp = await supabase.auth.getUser();
    const userId = userResp.data.user?.id;
    if (!userId) {
      Alert.alert('저장 실패', '로그인이 필요합니다.');
      setIsSaving(false);
      return;
    }

    const payload = {
      user_id: userId,
      routine_title: routine.title,
      routine_meta: routine.meta,
      duration_min: durationMin,
      exercise_count: completedCount,
      difficulty: difficulty!,
      pain_areas: painAreas,
      completion_status: completionStatus!,
      memo: memo.trim() || null,
      body_part: parseBodyPart(routine.title),
    } satisfies WorkoutLogInsert;

    const { data: log, error } = await supabase
      .from('workout_logs')
      .insert(payload)
      .select('id')
      .single();

    if (error || !log) {
      Alert.alert('저장 실패', '다시 시도해주세요.');
      setIsSaving(false);
      return;
    }

    setIsSaved(true);
    setIsSaving(false);

    setIsFeedbackLoading(true);
    try {
      const result = await fetchAiFeedback({
        difficulty: difficulty!,
        painAreas,
        completionStatus: completionStatus!,
        memo,
      });

      await supabase
        .from('workout_logs')
        .update({ ai_feedback: result })
        .eq('id', log.id);

      setFeedback(result);
    } catch {
      setFeedbackError(true);
    } finally {
      setIsFeedbackLoading(false);
    }
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
            <View style={styles.header}>
              <ThemedText type="title">오늘도 해냈어요!</ThemedText>
              <ThemedText type="subtitle">
                {routine.title}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {durationMin}분 완료 · {completedCount}개 운동 진행
              </ThemedText>
            </View>

            <View style={styles.section}>
              <ThemedText type="smallBold">
                운동 난이도
              </ThemedText>
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
                          backgroundColor: active
                            ? Palette.primary
                            : Palette.bgMuted,
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
              <ThemedText type="smallBold">
                통증/불편 부위
              </ThemedText>
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
                          backgroundColor: active
                            ? Palette.primary
                            : Palette.bgMuted,
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
              <ThemedText type="smallBold">
                완료 여부
              </ThemedText>
              <View style={styles.chipRow}>
                {COMPLETION_OPTIONS.map((opt) => {
                  const active = opt.value === completionStatus;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setCompletionStatus(opt.value)}
                      style={({ pressed }) => [
                        styles.chip,
                        {
                          backgroundColor: active
                            ? Palette.primary
                            : Palette.bgMuted,
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
              <ThemedText type="smallBold">
                메모 (선택)
              </ThemedText>
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

            {!isSaved && (
              <Pressable
                onPress={handleSave}
                disabled={!canSave || isSaving}
                style={({ pressed }) => [
                  styles.primaryCta,
                  {
                    backgroundColor: !canSave
                      ? Palette.bgMuted
                      : pressed
                        ? Palette.primaryPressed
                        : Palette.primary,
                    opacity: isSaving ? 0.7 : 1,
                  },
                ]}>
                {isSaving ? (
                  <ActivityIndicator color={canSave ? Palette.white : theme.text} />
                ) : (
                  <ThemedText
                    type="subtitle"
                    style={{
                      color: canSave ? Palette.white : theme.textSecondary,
                    }}>
                    기록 저장하기
                  </ThemedText>
                )}
              </Pressable>
            )}

            {isSaved && (
              <ThemedView
                type="backgroundElement"
                style={[
                  styles.feedbackCard,
                  { borderColor: Palette.lineDefault },
                  Elevation.level1,
                ]}>
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
                    <ThemedText type="default">
                      {feedback.summary}
                    </ThemedText>
                    <ThemedText type="default">
                      {feedback.nextAdjustment}
                    </ThemedText>
                    <ThemedText type="default">
                      {feedback.encouragement}
                    </ThemedText>
                  </View>
                )}
                {feedbackError && (
                  <ThemedText type="small" themeColor="textSecondary">
                    피드백을 불러오지 못했어요. 다음에 다시 확인해주세요.
                  </ThemedText>
                )}
              </ThemedView>
            )}

            {isSaved && (
              <Pressable
                onPress={() => {
                  clearRoutine();
                  router.replace('/workout');
                }}
                style={({ pressed }) => [
                  styles.primaryCta,
                  {
                    backgroundColor: pressed
                      ? Palette.primaryPressed
                      : Palette.primary,
                  },
                ]}>
                <ThemedText type="subtitle" style={{ color: Palette.white }}>
                  내일 운동 만들기
                </ThemedText>
              </Pressable>
            )}
          </ScrollView>
        </SafeAreaView>
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
    gap: Spacing.lg,
  },
  header: { gap: Spacing.xs },
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
  feedbackCard: {
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
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
});
