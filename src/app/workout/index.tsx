import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
import { Routine, useGenerateRoutine } from '@/features/workout/useGenerateRoutine';
import { useTheme } from '@/hooks/use-theme';
import { getOrCreateAudio, primeTts } from '@/lib/tts';
import { useWorkoutSession } from '@/stores/workout-session';

const goals = ['체력 향상', '체중 감량', '자세 개선'] as const;
const places = ['집', '야외', '헬스장'] as const;
const equipments = ['매트', '없음', '덤벨'] as const;
const conditions = ['좋음', '보통', '피곤해요'] as const;
const bodyParts = ['없음', '무릎', '허리'] as const;
const durations = ['10분', '15분', '20분'] as const;

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.chipGroup}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
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
  );
}

function OptionRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.optionRow}>
      <ThemedText
        type="smallBold"
        style={styles.optionLabel}
        numberOfLines={1}>
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

export default function WorkoutScreen() {
  const theme = useTheme();
  const [goal, setGoal] = useState<(typeof goals)[number]>('체력 향상');
  const [place, setPlace] = useState<(typeof places)[number]>('집');
  const [equipment, setEquipment] = useState<(typeof equipments)[number]>('매트');
  const [condition, setCondition] = useState<(typeof conditions)[number]>('보통');
  const [bodyPart, setBodyPart] = useState<(typeof bodyParts)[number]>('없음');
  const [duration, setDuration] = useState<(typeof durations)[number]>('15분');
  const [recommendation, setRecommendation] = useState<Routine | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const { mutate: generate, isPending, error } = useGenerateRoutine();
  const router = useRouter();
  const setSessionRoutine = useWorkoutSession((s) => s.setRoutine);

  const hasResult = recommendation !== null;

  function handleGenerate() {
    generate(
      { goal, place, equipment, condition, bodyPart, duration },
      { onSuccess: setRecommendation },
    );
  }

  function handleMakeEasier() {
    generate(
      { goal, place, equipment, condition, bodyPart, duration, easier: true },
      { onSuccess: setRecommendation },
    );
  }

  async function handleStartSession() {
    if (!recommendation || isStarting) return;
    setIsStarting(true);
    primeTts();
    setSessionRoutine(recommendation);
    // OpenAI TTS 사전 합성 — 세션 시작 전 모든 코칭 멘트를 백그라운드로 캐싱.
    // 스트레칭 운동은 'stretch' 톤(명상적), 나머지는 'main' 톤(활기찬 코치).
    // 실패해도 expo-speech 로 자동 fallback 되므로 .catch 는 조용히 무시.
    // 아래 상수·문자열은 session.tsx 의 playCue 호출과 1:1 로 일치해야 캐시 HIT.
    // session.tsx 의 REST_SECONDS / SINO_COUNTDOWN_5 / 발화 템플릿이 바뀌면 여기도 같이 갱신.
    const REST_SECONDS = 10;
    const SINO_COUNTDOWN_5 = ['오', '사', '삼', '이', '일'];
    const FINISH_TEXT = '오늘 운동을 모두 마쳤어요. 수고하셨어요.';

    recommendation.exercises.forEach((ex) => {
      const mode = ex.isStretch ? 'stretch' : 'main';

      // intro: "{name}을(를) 시작할게요. {description}" — 결합 문자열로 prime
      getOrCreateAudio(`${ex.name}을(를) 시작할게요. ${ex.description}`.trim(), mode).catch(() => {});

      if (ex.caution) getOrCreateAudio(ex.caution, mode).catch(() => {});
      if (ex.halfwayEncouragement) {
        getOrCreateAudio(ex.halfwayEncouragement, mode).catch(() => {});
      }
      ex.repScripts.forEach((s) => getOrCreateAudio(s, mode).catch(() => {}));
      ex.timeScripts.forEach((s) => getOrCreateAudio(s, mode).catch(() => {}));

      // exercise-finish: "{name}을 모두 완료했어요."
      getOrCreateAudio(`${ex.name}을 모두 완료했어요.`, mode).catch(() => {});

      // detail 파싱 — 세트 기반이면 set-start/rest, 시간 기반이면 5초 카운트.
      const repsMatch = ex.detail.match(/(\d+)\s*회\s*[×x*]\s*(\d+)\s*세트/);
      if (repsMatch) {
        const reps = parseInt(repsMatch[1], 10);
        const sets = parseInt(repsMatch[2], 10);
        for (let s = 1; s <= sets; s++) {
          getOrCreateAudio(
            `${s}세트를 시작합니다. 총 ${reps}회예요. 준비, 시작.`,
            mode,
          ).catch(() => {});
        }
        for (let s = 1; s < sets; s++) {
          getOrCreateAudio(
            `좋아요. ${s}세트 완료했어요. ${REST_SECONDS}초 쉬어갈게요.`,
            mode,
          ).catch(() => {});
        }
      } else {
        SINO_COUNTDOWN_5.forEach((t) => getOrCreateAudio(t, mode).catch(() => {}));
      }
    });

    // finish 멘트는 마지막 운동의 mode 로 재생되므로 그 mode 로 prime.
    const lastEx = recommendation.exercises[recommendation.exercises.length - 1];
    if (lastEx) {
      const lastMode = lastEx.isStretch ? 'stretch' : 'main';
      getOrCreateAudio(FINISH_TEXT, lastMode).catch(() => {});
    }

    // 레이스 방지 — 첫 운동 intro 만 동기 대기. session 진입 즉시 OpenAI TTS 가
    // 메모리 캐시 HIT 되도록 함. 나머지는 백그라운드에서 계속 합성됨.
    const firstEx = recommendation.exercises[0];
    if (firstEx) {
      const firstMode = firstEx.isStretch ? 'stretch' : 'main';
      const firstIntroText = `${firstEx.name}을(를) 시작할게요. ${firstEx.description}`.trim();
      await getOrCreateAudio(firstIntroText, firstMode).catch(() => null);
    }

    router.push('/workout/session');
    setIsStarting(false);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="title">오늘의 운동</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              오늘 컨디션과 시간에 맞춰 10~20분 홈트를 추천해드릴게요
            </ThemedText>
          </View>

          <ThemedView
            type="backgroundElement"
            style={[styles.formCard, { borderColor: Palette.lineDefault }, Elevation.level1]}>
            <OptionRow label="운동 목표">
              <ChipGroup options={goals} value={goal} onChange={setGoal} />
            </OptionRow>
            <OptionRow label="운동 장소">
              <ChipGroup options={places} value={place} onChange={setPlace} />
            </OptionRow>
            <OptionRow label="사용 장비">
              <ChipGroup options={equipments} value={equipment} onChange={setEquipment} />
            </OptionRow>
            <OptionRow label="오늘 컨디션">
              <ChipGroup options={conditions} value={condition} onChange={setCondition} />
            </OptionRow>
            <OptionRow label="불편한 부위">
              <ChipGroup options={bodyParts} value={bodyPart} onChange={setBodyPart} />
            </OptionRow>
            <OptionRow label="가능 시간">
              <ChipGroup options={durations} value={duration} onChange={setDuration} />
            </OptionRow>
          </ThemedView>

          <Pressable
            onPress={handleGenerate}
            disabled={isPending}
            style={({ pressed }) => [
              styles.cta,
              {
                backgroundColor: hasResult
                  ? Palette.bgMuted
                  : pressed
                    ? Palette.primaryPressed
                    : Palette.primary,
                opacity: isPending ? 0.7 : 1,
              },
            ]}>
            {isPending ? (
              <ActivityIndicator color={hasResult ? theme.text : Palette.white} />
            ) : (
              <ThemedText
                type="subtitle"
                style={{ color: hasResult ? theme.text : Palette.white }}>
                {hasResult ? 'AI 루틴 다시 생성하기' : 'AI 루틴 생성하기'}
              </ThemedText>
            )}
          </Pressable>

          {error && (
            <View
              style={[
                styles.errorCard,
                { backgroundColor: theme.backgroundElement, borderColor: Palette.error },
              ]}>
              <ThemedText type="smallBold" style={{ color: Palette.error }}>
                루틴을 만들지 못했어요
              </ThemedText>
              <ThemedText type="small">
                {error instanceof Error
                  ? error.message
                  : '알 수 없는 오류가 발생했어요. 잠시 후 다시 시도해주세요.'}
              </ThemedText>
            </View>
          )}

          {recommendation && (
            <ThemedView
              type="backgroundElement"
              style={[
                styles.resultCard,
                { borderColor: Palette.lineDefault },
                Elevation.level1,
              ]}>
              <View style={[styles.aiBadge, { backgroundColor: Palette.primaryLight }]}>
                <ThemedText type="smallBold" style={{ color: Palette.primary }}>
                  AI 추천
                </ThemedText>
              </View>

              <ThemedText type="subtitle">{recommendation.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {recommendation.meta}
              </ThemedText>
              <ThemedText type="default">
                {recommendation.intro}
              </ThemedText>

              <View style={styles.exerciseList}>
                {recommendation.exercises.map((ex, idx) => (
                  <View
                    key={ex.name}
                    style={[
                      styles.exerciseRow,
                      idx !== 0 && {
                        borderTopColor: Palette.lineDefault,
                        borderTopWidth: StyleSheet.hairlineWidth,
                      },
                    ]}>
                    <View
                      style={[
                        styles.exerciseNum,
                        { backgroundColor: Palette.primaryLight },
                      ]}>
                      <ThemedText type="smallBold" style={{ color: Palette.primary }}>
                        {idx + 1}
                      </ThemedText>
                    </View>
                    <ThemedText
                      type="default"
                      style={styles.exerciseName}>
                      {ex.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {ex.detail}
                    </ThemedText>
                  </View>
                ))}
              </View>

              <Pressable
                onPress={handleStartSession}
                disabled={isStarting}
                style={({ pressed }) => [
                  styles.cta,
                  {
                    backgroundColor: pressed ? Palette.primaryPressed : Palette.primary,
                    opacity: isStarting ? 0.7 : 1,
                  },
                ]}>
                {isStarting ? (
                  <ActivityIndicator color={Palette.white} />
                ) : (
                  <ThemedText type="subtitle" style={{ color: '#FFFFFF' }}>
                    운동 시작하기
                  </ThemedText>
                )}
              </Pressable>

              <Pressable
                onPress={handleMakeEasier}
                disabled={isPending}
                style={({ pressed }) => [
                  styles.ghostButton,
                  { opacity: pressed || isPending ? 0.6 : 1 },
                ]}>
                {isPending ? (
                  <ActivityIndicator size="small" color={theme.textSecondary} />
                ) : (
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    더 쉬운 루틴으로 바꾸기
                  </ThemedText>
                )}
              </Pressable>
            </ThemedView>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
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
  header: { gap: Spacing.xs },
  formCard: {
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  optionLabel: {
    width: 84,
  },
  chipGroup: {
    flex: 1,
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
  cta: {
    height: 52,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultCard: {
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  aiBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.small,
  },
  exerciseList: {
    marginTop: Spacing.xs,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  exerciseNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseName: { flex: 1 },
  ghostButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.xs,
  },
});
