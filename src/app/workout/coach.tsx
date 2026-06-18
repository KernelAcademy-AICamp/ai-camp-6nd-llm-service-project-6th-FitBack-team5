/**
 * AI 코치 챗봇 — 사용자의 컨디션·환경을 한 질문씩 받아 루틴을 생성한다.
 *
 * 흐름: 6개 질문(목표/장소/장비/컨디션/불편부위/시간)을 챗 형식으로 받음
 *   → 답변 수집 완료 → useGenerateRoutine 호출 → 결과 카드 표시
 *   → "운동 시작하기" 버튼 → prepareSessionAudio 후 /workout/session 이동.
 *
 * "더 쉬운 루틴으로 바꾸기" 버튼은 결과 카드 아래에 노출되며 같은 답변으로 easier:true 재호출.
 */

import { useRouter } from 'expo-router';
import { ChevronLeft, Sparkles } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
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
import { prepareSessionAudio } from '@/features/workout/start-session';
import {
  type Routine,
  type RoutineInput,
  useGenerateRoutine,
} from '@/features/workout/useGenerateRoutine';
import { useTheme } from '@/hooks/use-theme';
import { useWorkoutSession } from '@/stores/workout-session';

type StepKey = 'goal' | 'equipment' | 'condition' | 'bodyPart' | 'duration';

interface Step {
  key: StepKey;
  question: string;
  options: readonly string[];
}

// 질문 순서·옵션은 기존 workout/index.tsx 의 ChipGroup 과 1:1 매칭.
const STEPS: readonly Step[] = [
  {
    key: 'goal',
    question: '오늘 어떤 목표로 운동하실 거예요?',
    options: ['체력 향상', '체중 감량', '자세 개선'],
  },
  {
    key: 'equipment',
    question: '쓸 수 있는 장비가 있나요?',
    options: ['매트', '없음', '덤벨'],
  },
  {
    key: 'condition',
    question: '오늘 컨디션은 어떠세요?',
    options: ['좋음', '보통', '피곤해요'],
  },
  {
    key: 'bodyPart',
    question: '불편한 부위 있으세요?',
    options: ['없음', '무릎', '허리'],
  },
  {
    key: 'duration',
    question: '얼마나 운동하실 거예요?',
    options: ['10분', '15분', '20분'],
  },
];

type MessageRole = 'bot' | 'user';
interface Message {
  id: string;
  role: MessageRole;
  text: string;
}

function buildInput(answers: Partial<Record<StepKey, string>>, easier: boolean): RoutineInput {
  return {
    goal: answers.goal ?? '체력 향상',
    equipment: answers.equipment ?? '매트',
    condition: answers.condition ?? '보통',
    bodyPart: answers.bodyPart ?? '없음',
    duration: answers.duration ?? '15분',
    easier,
  };
}

export default function CoachScreen() {
  const theme = useTheme();
  const router = useRouter();
  const setSessionRoutine = useWorkoutSession((s) => s.setRoutine);
  const { mutate, isPending, error } = useGenerateRoutine();

  const [messages, setMessages] = useState<Message[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<StepKey, string>>>({});
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  // 초기 인사 + 첫 질문
  useEffect(() => {
    setMessages([
      {
        id: 'bot-greet',
        role: 'bot',
        text: '안녕하세요! 오늘 운동을 함께 만들어볼게요. 몇 가지 여쭤볼게요.',
      },
      { id: 'bot-q-0', role: 'bot', text: STEPS[0].question },
    ]);
  }, []);

  // 새 메시지 추가 시 스크롤 하단으로
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages, routine, isPending]);

  const currentStep: Step | null = stepIdx < STEPS.length ? STEPS[stepIdx] : null;
  const isCollecting = currentStep !== null && !routine;

  function callGenerate(allAnswers: Partial<Record<StepKey, string>>, easier: boolean) {
    const input = buildInput(allAnswers, easier);
    mutate(input, {
      onSuccess: (r) => {
        // title/intro 는 결과 카드 안에서 보여주므로 별도 챗 버블은 추가하지 않음.
        setRoutine(r);
      },
      onError: () => {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-err-${Date.now()}`,
            role: 'bot',
            text: '루틴을 만들지 못했어요. 잠시 후 다시 시도해주세요.',
          },
        ]);
      },
    });
  }

  function handleSelect(option: string) {
    if (!currentStep || isPending) return;

    const newAnswers = { ...answers, [currentStep.key]: option };
    setAnswers(newAnswers);

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', text: option },
    ]);

    if (stepIdx + 1 < STEPS.length) {
      const nextStep = STEPS[stepIdx + 1];
      setStepIdx(stepIdx + 1);
      setMessages((prev) => [
        ...prev,
        { id: `bot-q-${stepIdx + 1}`, role: 'bot', text: nextStep.question },
      ]);
    } else {
      // 마지막 답변 — 모든 답 수집됨 → 생성 호출
      setStepIdx(stepIdx + 1);
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-gen-${Date.now()}`,
          role: 'bot',
          text: '잠시만요, 맞춤 루틴을 만들고 있어요...',
        },
      ]);
      callGenerate(newAnswers, false);
    }
  }

  function handleMakeEasier() {
    if (isPending || !routine) return;
    setRoutine(null);
    setMessages((prev) => [
      ...prev,
      {
        id: `u-easier-${Date.now()}`,
        role: 'user',
        text: '더 쉬운 루틴으로 바꿔주세요',
      },
      {
        id: `bot-easier-${Date.now()}`,
        role: 'bot',
        text: '강도를 한 단계 낮춰서 다시 만들어볼게요.',
      },
    ]);
    callGenerate(answers, true);
  }

  async function handleStartSession() {
    if (!routine || isStarting) return;
    setIsStarting(true);
    setSessionRoutine(routine);
    await prepareSessionAudio(routine);
    router.replace('/workout/session');
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.replace('/workout')}
            style={({ pressed }) => [
              styles.backBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}>
            <ChevronLeft color={theme.text} size={24} />
          </Pressable>
          <ThemedText type="subtitle">AI 운동 코치</ThemedText>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {messages.map((m) => (
            <View
              key={m.id}
              style={[
                styles.bubbleRow,
                { justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' },
              ]}>
              {m.role === 'bot' && (
                <View style={styles.avatar}>
                  <Sparkles color={Palette.white} size={16} />
                </View>
              )}
              <View
                style={[
                  styles.bubble,
                  m.role === 'user' ? styles.userBubble : styles.botBubble,
                ]}>
                <ThemedText
                  type="default"
                  style={[
                    { color: m.role === 'user' ? Palette.white : Palette.primary },
                    m.role === 'user' && { fontSize: 15, lineHeight: 22 },
                  ]}>
                  {m.text}
                </ThemedText>
              </View>
            </View>
          ))}

          {/* 현재 질문에 대한 옵션 — 봇 버블 바로 아래 인라인 노출. */}
          {isCollecting && currentStep && !isPending && (
            <View style={styles.inlineChipRow}>
              {currentStep.options.map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => handleSelect(opt)}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      backgroundColor: pressed ? Palette.primaryLight : Palette.bgMuted,
                    },
                  ]}>
                  <ThemedText
                    type="label"
                    style={{ color: Palette.gray500, fontSize: 13, lineHeight: 19 }}>
                    {opt}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          )}

          {/* 루틴 생성 중 인디케이터 */}
          {isPending && (
            <View style={[styles.bubbleRow, { justifyContent: 'flex-start' }]}>
              <View style={styles.avatar}>
                <Sparkles color={Palette.white} size={16} />
              </View>
              <View style={[styles.bubble, styles.botBubble]}>
                <ActivityIndicator color={Palette.primary} />
              </View>
            </View>
          )}

          {/* 결과 카드 */}
          {routine && !isPending && (
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
              <ThemedText type="subtitle">{routine.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {routine.meta}
              </ThemedText>
              <ThemedText type="default" style={styles.resultIntro}>
                {routine.intro}
              </ThemedText>

              <View style={styles.exerciseList}>
                {routine.exercises.map((ex, idx) => (
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
                    <ThemedText type="default" style={styles.exerciseName}>
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
                  <ThemedText type="subtitle" style={{ color: Palette.white }}>
                    운동 시작하기
                  </ThemedText>
                )}
              </Pressable>

              <Pressable
                onPress={handleMakeEasier}
                disabled={isPending || isStarting}
                style={({ pressed }) => [
                  styles.ghostButton,
                  { opacity: pressed || isPending || isStarting ? 0.6 : 1 },
                ]}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  더 쉬운 루틴으로 바꾸기
                </ThemedText>
              </Pressable>
            </ThemedView>
          )}

          {error && !routine && !isPending && (
            <View
              style={[
                styles.errorCard,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: Palette.error,
                },
              ]}>
              <ThemedText type="small">
                {error instanceof Error
                  ? error.message
                  : '알 수 없는 오류가 발생했어요.'}
              </ThemedText>
            </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ScreenPadding,
    paddingVertical: Spacing.sm,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: ScreenPadding,
    paddingTop: Spacing.sm,
    // 웹에서 position:fixed 하단 탭 바(80px)에 가려지지 않도록 BottomTabInset 만큼 띄움.
    paddingBottom: BottomTabInset + Spacing.lg,
    gap: Spacing.sm,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  // 봇 말풍선: 좌상단을 작게 깎아 왼쪽 위로 향하는 꼬리 느낌.
  botBubble: {
    backgroundColor: Palette.primaryLight,
    borderTopLeftRadius: Radius.small,
    borderTopRightRadius: Radius.card,
    borderBottomRightRadius: Radius.card,
    borderBottomLeftRadius: Radius.card,
  },
  // 사용자 말풍선: 우상단을 깎아 오른쪽 위로 향하는 꼬리.
  // 봇 버블보다 패딩을 줄여 작게, primary 에 80% alpha 로 연한 보라.
  userBubble: {
    backgroundColor: `${Palette.primary}CC`,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderTopLeftRadius: Radius.card,
    borderTopRightRadius: Radius.small,
    borderBottomRightRadius: Radius.card,
    borderBottomLeftRadius: Radius.card,
  },
  resultCard: {
    marginTop: Spacing.sm,
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
  resultIntro: {
    marginTop: Spacing.xs,
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
  cta: {
    height: 52,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  inlineChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: -Spacing.xs / 2,
    // 아바타(32) + gap(4) = 36 인 버블 시작점보다 살짝 더 안쪽으로.
    marginLeft: 44,
  },
  chip: {
    minHeight: 28,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
