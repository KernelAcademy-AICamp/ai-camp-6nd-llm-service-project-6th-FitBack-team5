import { Apple, ArrowLeft, ArrowUp, Camera, Dumbbell, Flame, Sparkles, X } from 'lucide-react-native';
import { useMemo, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

const CHARACTER = require('../../../assets/images/character_chat.png') as number;

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui';
import { Palette, Radius, ScreenPadding, Spacing } from '@/constants/theme';
import { useProfile } from '@/features/auth/useProfile';
import type { AppResponse, ChatbotIntent, FollowupAction, RoiInfo } from '@/features/coach/chatbot.types';
import { INTENT_QUESTIONS, IntentQuestion } from '@/features/coach/IntentQuestion';
import { useAiFeedback } from '@/features/coach/useAiFeedback';
import { useDietSummary } from '@/features/coach/useDietSummary';
import { computeRisk, sortByRisk, won } from '@/features/membership/dashboard';
import { useMemberships } from '@/features/membership/useMemberships';
import { useHomeActivity } from '@/features/home/useHomeActivity';
import { type Routine, type RoutineInput, useGenerateRoutine } from '@/features/workout/useGenerateRoutine';
import { prepareSessionAudio } from '@/features/workout/start-session';
import { useWorkoutSession } from '@/stores/workout-session';

// ── Types ────────────────────────────────────────────────

interface ChatMsg {
  role: 'coach' | 'user';
  text: string;
  response?: AppResponse;
  isLoading?: boolean;
  isQuestion?: boolean;
  wcRoutineResult?: Routine;
}

// ── Welcome screen option cards ──────────────────────────

const WELCOME_OPTIONS = [
  {
    icon: Dumbbell,
    label: '오늘 운동 추천해줘',
    desc: '내 수준에 맞는 루틴을 짜드려요',
    iconColor: Palette.primary,
    bg: Palette.primaryLight,
    message: null,
    navigate: '/workout/coach' as const,
  },
  {
    icon: Apple,
    label: '식단 질문',
    desc: '목표에 맞는 식단을 추천해요',
    iconColor: Palette.gray500,
    bg: Palette.bgMuted,
    message: '오늘 식단 추천해줘',
  },
  {
    icon: Camera,
    label: '식단 사진 분석',
    desc: '음식 사진으로 칼로리를 분석해요',
    iconColor: Palette.gray500,
    bg: Palette.bgMuted,
    message: '식단 사진 분석해줘',
  },
];

// ── Workout coach inline flow ─────────────────────────────

type WcStepKey = 'goal' | 'equipment' | 'condition' | 'bodyPart' | 'duration';
interface WcStep { key: WcStepKey; question: string; options: readonly string[] }
const WC_STEPS: readonly WcStep[] = [
  { key: 'goal', question: '오늘 어떤 목표로 운동하실 거예요?', options: ['체력 향상', '체중 감량', '자세 개선'] },
  { key: 'equipment', question: '쓸 수 있는 장비가 있나요?', options: ['매트', '없음', '덤벨'] },
  { key: 'condition', question: '오늘 컨디션은 어떠세요?', options: ['좋음', '보통', '피곤해요'] },
  { key: 'bodyPart', question: '불편한 부위 있으세요?', options: ['없음', '무릎', '허리'] },
  { key: 'duration', question: '얼마나 운동하실 거예요?', options: ['10분', '15분', '20분'] },
];
function buildWcInput(a: Partial<Record<WcStepKey, string>>, easier: boolean): RoutineInput {
  return { goal: a.goal ?? '체력 향상', equipment: a.equipment ?? '매트', condition: a.condition ?? '보통', bodyPart: a.bodyPart ?? '없음', duration: a.duration ?? '15분', easier };
}

// ── Helpers ──────────────────────────────────────────────

function detectIntent(text: string): ChatbotIntent | null {
  if (/식단|다이어트|먹|칼로리|단백질|탄수|지방|체중/.test(text)) return 'diet';
  if (/운동|헬스|pt|트레이닝|부위|허벅지|등|어깨|가슴|루틴|근력/.test(text)) return 'plan';
  return null;
}

function TypingDot({ delay }: { delay: number }) {
  const [y] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(y, { toValue: -6, duration: 300, useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.delay(450 - delay),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return <Animated.View style={[dotStyles.dot, { transform: [{ translateY: y }] }]} />;
}
const dotStyles = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Palette.white },
});

function TypingIndicator() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 4, paddingVertical: 2 }}>
      <TypingDot delay={0} />
      <TypingDot delay={150} />
      <TypingDot delay={300} />
    </View>
  );
}

function NumCircle({ n }: { n: number }) {
  return (
    <View style={numStyles.circle}>
      <ThemedText type="label" style={{ color: Palette.primary }}>{n}</ThemedText>
    </View>
  );
}
const numStyles = StyleSheet.create({
  circle: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
});

function ResponseBody({ response }: { response: AppResponse }) {
  if (response.intent === 'general') return null;

  if (response.intent === 'plan') {
    const { focus_part, items, duration_min } = response.body;
    return (
      <View style={styles.responseCard}>
        <View style={styles.responseCardHead}>
          <ThemedText type="captionBold">{focus_part} 루틴</ThemedText>
          <View style={styles.miniTag}>
            <ThemedText type="label" style={{ color: Palette.gray500 }}>
              {focus_part} · {duration_min}분
            </ThemedText>
          </View>
        </View>
        {items.map((item, i) => (
          <View key={i} style={styles.exerciseRow}>
            <NumCircle n={i + 1} />
            <ThemedText type="caption" style={{ flex: 1 }}>{item.name}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {item.sets}세트 × {item.reps}회
            </ThemedText>
          </View>
        ))}
      </View>
    );
  }

  if (response.intent === 'diet') {
    const { target_kcal, protein_g, meals } = response.body;
    return (
      <View style={styles.responseCard}>
        <ThemedText type="captionBold">{response.summary}</ThemedText>
        {/* 2열 지표 */}
        <View style={styles.dietMetrics}>
          <View style={styles.dietMetricCell}>
            <ThemedText type="label" themeColor="textSecondary">목표 칼로리</ThemedText>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
              <ThemedText type="h2">{target_kcal.toLocaleString()}</ThemedText>
              <ThemedText type="label" themeColor="textSecondary"> kcal</ThemedText>
            </View>
          </View>
          <View style={styles.dietMetricCell}>
            <ThemedText type="label" themeColor="textSecondary">단백질</ThemedText>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
              <ThemedText type="h2">{protein_g}</ThemedText>
              <ThemedText type="label" themeColor="textSecondary"> g</ThemedText>
            </View>
          </View>
        </View>
        {/* 식단 리스트 */}
        {meals.map((meal, i) => (
          <View key={i} style={styles.mealRow}>
            <ThemedText type="label" themeColor="textSecondary" style={styles.mealTime}>{meal.time}</ThemedText>
            <ThemedText type="caption" style={{ flex: 1 }}>{meal.menu}</ThemedText>
            <ThemedText type="label" themeColor="textSecondary">{meal.kcal}</ThemedText>
          </View>
        ))}
      </View>
    );
  }

  if (response.intent === 'photo') {
    const { foods, total_kcal, comment } = response.body;
    return (
      <View style={styles.responseCard}>
        <View style={styles.responseCardHead}>
          <ThemedText type="captionBold">분석 결과</ThemedText>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
            <ThemedText type="label" themeColor="textSecondary">총 </ThemedText>
            <ThemedText type="subtitle" style={{ color: Palette.gray900 }}>{total_kcal}</ThemedText>
            <ThemedText type="label" themeColor="textSecondary"> kcal</ThemedText>
          </View>
        </View>
        {foods.map((food, i) => (
          <View key={i} style={styles.exerciseRow}>
            <ThemedText type="caption" style={{ flex: 1 }}>{food.name}</ThemedText>
            <ThemedText type="label" themeColor="textSecondary">
              {food.est_kcal}kcal · 단백질 {food.protein_g}g
            </ThemedText>
          </View>
        ))}
        {comment ? (
          <View style={styles.photoComment}>
            <ThemedText type="label" themeColor="textSecondary">{comment}</ThemedText>
          </View>
        ) : null}
      </View>
    );
  }

  return null;
}

// ── Main component ───────────────────────────────────────

export function CoachChat({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { summary } = useDietSummary();
  const { data: home } = useHomeActivity();
  const { data: profile } = useProfile();
  const { data: memberships } = useMemberships();
  const aiFeedback = useAiFeedback();

  const [view, setView] = useState<'welcome' | 'chat'>('welcome');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [pendingIntent, setPendingIntent] = useState<ChatbotIntent | null>(null);

  // Workout coach inline flow state
  const [wcMode, setWcMode] = useState(false);
  const [wcStepIdx, setWcStepIdx] = useState(0);
  const [wcAnswers, setWcAnswers] = useState<Partial<Record<WcStepKey, string>>>({});
  const [wcRoutine, setWcRoutine] = useState<Routine | null>(null);
  const [wcIsStarting, setWcIsStarting] = useState(false);
  const [wcShowCustom, setWcShowCustom] = useState(false);
  const [wcCustomText, setWcCustomText] = useState('');
  const { mutate: generateRoutine, isPending: routinePending } = useGenerateRoutine();
  const setSessionRoutine = useWorkoutSession((s) => s.setRoutine);

  const scrollRef = useRef<ScrollView>(null);

  const membership = useMemo(() => {
    const active = memberships?.filter((m) => m.status === 'active') ?? [];
    if (!active.length) return null;
    return sortByRisk(active, (m) => computeRisk(m, home?.weekVisits ?? 0))[0] ?? null;
  }, [memberships, home?.weekVisits]);

  const risk = useMemo(
    () => (membership ? computeRisk(membership, home?.weekVisits ?? 0) : null),
    [membership, home?.weekVisits]
  );

  const riskColor = !risk ? Palette.gray500
    : risk.level === 'danger' ? Palette.loss
    : risk.level === 'safe' ? Palette.profit
    : risk.level === 'warning' ? Palette.warning
    : Palette.gray500;

  const riskBg = !risk ? Palette.bgMuted
    : risk.level === 'safe' ? Palette.profitLight
    : Palette.bgSurface;

  const riskLabel = !risk ? ''
    : risk.level === 'danger' ? '위험'
    : risk.level === 'warning' ? '주의'
    : risk.level === 'safe' ? '안전' : '';

  function buildContext(): Record<string, unknown> {
    const ctx: Record<string, unknown> = {};
    if (profile) {
      ctx.age = profile.age; ctx.gender = profile.gender;
      ctx.height = profile.height; ctx.weight = profile.weight;
      ctx.exercise_level = profile.exercise_level;
      ctx.injury_history = profile.injury_history;
      ctx.medical_conditions = profile.medical_conditions;
      ctx.avoid_exercise_parts = profile.avoid_exercise_parts;
    }
    if (summary) {
      ctx.today_diet = { totalKcal: summary.totalKcal, carb_g: summary.carb_g, protein_g: summary.protein_g, fat_g: summary.fat_g };
    }
    if (home) { ctx.streak_weeks = home.streakWeeks; ctx.week_visits = home.weekVisits; }
    if (risk) { ctx.membership_risk = risk.level; ctx.value_at_risk = risk.valueAtRisk; ctx.remaining_days = risk.remainingDays; }
    return ctx;
  }

  function buildRoi(): RoiInfo | null {
    if (!risk || !membership) return null;
    return {
      utilization_pct: Math.round(risk.sessionFilledRatio * 100),
      days_left: risk.remainingDays,
      pace_status: risk.level === 'safe' ? 'ahead' : risk.level === 'warning' ? 'on_track' : 'behind',
      value_at_risk: risk.valueAtRisk,
    };
  }

  function callAI(message: string, questionAnswer?: string) {
    setMessages((prev) => [...prev, { role: 'coach', text: '', isLoading: true }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    aiFeedback.mutate(
      { userContext: buildContext(), roi: buildRoi(), userMessage: message, questionAnswer },
      {
        onSuccess: (data) => {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: 'coach', text: data.coach_message, response: data };
            return next;
          });
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
        },
        onError: () => {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: 'coach', text: '잠시 후 다시 시도해 주세요.' };
            return next;
          });
        },
      }
    );
  }

  function send(text: string) {
    const q = text.trim();
    if (!q) return;
    setInput('');
    if (view === 'welcome') setView('chat');
    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    const intent = detectIntent(q);
    if (intent === 'diet' || intent === 'plan') {
      const question = INTENT_QUESTIONS[intent];
      if (question) {
        setMessages((prev) => [...prev, { role: 'coach', text: question.prompt, isQuestion: true }]);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
      }
      setPendingMessage(q);
      setPendingIntent(intent);
    } else {
      callAI(q);
    }
  }

  function onIntentAnswer(answer: string) {
    if (!pendingMessage) return;
    const message = pendingMessage;
    setPendingMessage(null);
    setPendingIntent(null);
    if (answer) setMessages((prev) => [...prev, { role: 'user', text: answer }]);
    callAI(message, answer || undefined);
  }

  // ── Workout coach inline handlers ──────────────────────

  function initWorkoutCoach() {
    setMessages([
      { role: 'coach', text: '안녕하세요! 오늘 운동을 함께 만들어볼게요. 몇 가지 여쭤볼게요.' },
      { role: 'coach', text: WC_STEPS[0].question },
    ]);
    setWcStepIdx(0);
    setWcAnswers({});
    setWcRoutine(null);
    setWcIsStarting(false);
    setWcMode(true);
    setWcShowCustom(false);
    setWcCustomText('');
    setView('chat');
  }

  function wcCallGenerate(allAnswers: Partial<Record<WcStepKey, string>>, easier: boolean) {
    generateRoutine(buildWcInput(allAnswers, easier), {
      onSuccess: (r) => {
        setWcRoutine(r);
        setMessages((prev) => [...prev, { role: 'coach', text: '', wcRoutineResult: r }]);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
      },
      onError: () => {
        setMessages((prev) => [...prev, { role: 'coach', text: '루틴을 만들지 못했어요. 잠시 후 다시 시도해주세요.' }]);
      },
    });
  }

  function wcHandleSelect(option: string) {
    const step = wcStepIdx < WC_STEPS.length ? WC_STEPS[wcStepIdx] : null;
    if (!step || routinePending) return;
    setWcShowCustom(false);
    setWcCustomText('');
    const newAnswers = { ...wcAnswers, [step.key]: option };
    setWcAnswers(newAnswers);
    setMessages((prev) => [...prev, { role: 'user', text: option }]);
    if (wcStepIdx + 1 < WC_STEPS.length) {
      const next = WC_STEPS[wcStepIdx + 1];
      setWcStepIdx(wcStepIdx + 1);
      setMessages((prev) => [...prev, { role: 'coach', text: next.question }]);
    } else {
      setWcStepIdx(wcStepIdx + 1);
      setMessages((prev) => [...prev, { role: 'coach', text: '잠시만요, 맞춤 루틴을 만들고 있어요...' }]);
      wcCallGenerate(newAnswers, false);
    }
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }

  function wcHandleMakeEasier() {
    if (routinePending || !wcRoutine) return;
    setWcRoutine(null);
    setMessages((prev) => [...prev,
      { role: 'user', text: '더 쉬운 루틴으로 바꿔주세요' },
      { role: 'coach', text: '강도를 한 단계 낮춰서 다시 만들어볼게요.' },
    ]);
    wcCallGenerate(wcAnswers, true);
  }

  async function wcHandleStartSession() {
    if (!wcRoutine || wcIsStarting) return;
    setWcIsStarting(true);
    setSessionRoutine(wcRoutine);
    await prepareSessionAudio(wcRoutine);
    onClose();
    router.push('/workout/session' as never);
  }

  const isWaiting = pendingIntent !== null;
  const isThinking = aiFeedback.isPending;

  // ── Shared input bar ─────────────────────────────────

  const inputBar = (
    <View style={styles.inputBar}>
      <TextInput
        value={input}
        onChangeText={setInput}
        placeholder={isThinking ? 'AI 코치가 답변 중이에요…' : '무엇이든 물어보세요'}
        placeholderTextColor={Palette.gray300}
        style={styles.textInput}
        onSubmitEditing={() => send(input)}
        returnKeyType="send"
        editable={!isThinking}
      />
      <Pressable
        onPress={() => send(input)}
        disabled={!input.trim() || isThinking}
        style={({ pressed }) => [
          styles.sendBtn,
          (!input.trim() || isThinking) && styles.sendBtnDisabled,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button" accessibilityLabel="보내기">
        <Icon icon={ArrowUp} size={18} color={Palette.white} />
      </Pressable>
    </View>
  );



  // ── Welcome screen ────────────────────────────────────

  if (view === 'welcome') {
    return (
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          <View style={styles.pill}>
            <Icon icon={Sparkles} size={13} color={Palette.primary} />
            <ThemedText type="label" style={{ color: Palette.primary }}>AI 피트니스</ThemedText>
          </View>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="닫기">
            <Icon icon={X} size={22} color={Palette.gray500} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.welcomeBody} showsVerticalScrollIndicator={false}>
          {/* Avatar + greeting */}
          <View style={styles.avatarRow}>
            <View style={styles.avatarCircle}>
              <Image source={CHARACTER} style={styles.avatarImg} resizeMode="contain" />
            </View>
            <View style={{ gap: 2 }}>
              <ThemedText type="label" themeColor="textSecondary">안녕하세요!</ThemedText>
              <ThemedText type="subtitle">회원권 본전 챙기는 피트니스예요</ThemedText>
            </View>
          </View>

          {/* ROI card */}
          {risk && membership ? (
            <View style={[styles.roiCard, { backgroundColor: riskBg }]}>
              <View style={styles.roiCardHead}>
                <ThemedText type="label" themeColor="textSecondary">내 회원권 활용도</ThemedText>
                {riskLabel ? (
                  <View style={[styles.riskBadge, { borderColor: riskColor }]}>
                    <ThemedText type="label" style={{ color: riskColor }}>{riskLabel}</ThemedText>
                  </View>
                ) : null}
              </View>
              {risk.hasSessions ? (
                <>
                  <ThemedText type="h1" themeColor="text">
                    활용률 {Math.round(risk.sessionFilledRatio * 100)}%
                  </ThemedText>
                  <ThemedText type="label" themeColor="textSecondary">
                    {membership.name} {risk.usedSessions}회 완료 · D-{risk.remainingDays}
                  </ThemedText>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, {
                      flex: Math.max(0.001, risk.sessionFilledRatio),
                      backgroundColor: riskColor,
                    }]} />
                    <View style={{ flex: Math.max(0.001, 1 - risk.sessionFilledRatio) }} />
                  </View>
                  {risk.valueAtRisk > 0 ? (
                    <ThemedText type="label" style={{ color: riskColor }}>
                      ⚠ 지금 페이스면 {won(risk.valueAtRisk)}이 날아져요
                    </ThemedText>
                  ) : null}
                </>
              ) : (
                <>
                  <ThemedText type="h1" themeColor="text">D-{risk.remainingDays}</ThemedText>
                  <ThemedText type="label" themeColor="textSecondary">{membership.name}</ThemedText>
                </>
              )}
            </View>
          ) : null}

          {/* Option cards */}
          <ThemedText type="body" style={{ marginTop: Spacing.sm }}>무엇을 도와드릴까요?</ThemedText>
          <View style={styles.optionsList}>
            {WELCOME_OPTIONS.map((opt) => (
              <Pressable
                key={opt.label}
                style={({ pressed }) => [styles.optionCard, pressed && styles.pressed]}
                onPress={() => 'navigate' in opt ? initWorkoutCoach() : send((opt as { message: string }).message)}
                accessibilityRole="button">
                <View style={[styles.optionIconWrap, { backgroundColor: opt.bg }]}>
                  <Icon icon={opt.icon} size={20} color={opt.iconColor} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText type="captionBold">{opt.label}</ThemedText>
                  <ThemedText type="label" themeColor="textSecondary">{opt.desc}</ThemedText>
                </View>
              </Pressable>
            ))}
          </View>

          <ThemedText type="label" themeColor="textSecondary" style={styles.disclaimer}>
            회원님의 운동·회원권 기록을 기반으로 답해요
          </ThemedText>
        </ScrollView>

        <View style={styles.inputSection}>{inputBar}</View>
      </KeyboardAvoidingView>
    );
  }

  // ── Chat screen ───────────────────────────────────────

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.topBar}>
        <Pressable onPress={() => setView('welcome')} hitSlop={8} accessibilityRole="button" accessibilityLabel="뒤로">
          <Icon icon={ArrowLeft} size={22} color={Palette.gray500} />
        </Pressable>
        <View style={styles.topCenter}>
          <View style={styles.pill}>
            <Icon icon={Sparkles} size={13} color={Palette.primary} />
            <ThemedText type="label" style={{ color: Palette.primary }}>AI 피트니스</ThemedText>
          </View>
          {home && home.streakWeeks > 0 ? (
            <View style={styles.streakBadge}>
              <Icon icon={Flame} size={12} color={Palette.warning} />
              <ThemedText type="label" themeColor="textSecondary">연속 {home.streakWeeks}주</ThemedText>
            </View>
          ) : null}
        </View>
        {risk && risk.remainingDays > 0 ? (
          <View style={[styles.roiChip, {
            backgroundColor: risk.level === 'safe' ? Palette.profitLight : Palette.bgMuted,
            borderColor: riskColor,
          }]}>
            {risk.hasSessions ? (
              <ThemedText type="label" style={{ color: riskColor }}>
                {Math.round(risk.sessionFilledRatio * 100)}% · D-{risk.remainingDays}
              </ThemedText>
            ) : (
              <ThemedText type="label" style={{ color: riskColor }}>D-{risk.remainingDays}</ThemedText>
            )}
          </View>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      {/* Messages */}
      <ScrollView ref={scrollRef} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {messages.map((m, i) => {
          const isLast = i === messages.length - 1;

          if (m.role === 'user') {
            return (
              <View key={i} style={styles.userLine}>
                <View style={[styles.bubble, styles.userBubble]}>
                  <ThemedText type="caption" style={{ color: Palette.primary }}>{m.text}</ThemedText>
                </View>
              </View>
            );
          }

          // Coach message
          return (
            <View key={i} style={styles.coachLine}>
              {/* Avatar row — not shown for loading bubble */}
              {!m.isLoading && (
                <View style={styles.coachAvatarRow}>
                  <View style={styles.coachAvatar}>
                    <Image source={CHARACTER} style={styles.coachAvatarImg} resizeMode="contain" />
                  </View>
                  <ThemedText type="label" themeColor="textSecondary">피트니스</ThemedText>
                </View>
              )}

              {/* Bubble: loading / question / plain error — wcRoutineResult는 별도 카드로 렌더 */}
              {(m.isLoading || m.isQuestion || (!m.response && !m.wcRoutineResult)) && (
                <View style={[styles.bubble, styles.coachBubble]}>
                  {m.isLoading
                    ? <TypingIndicator />
                    : <ThemedText type="caption" style={{ color: Palette.white }}>{m.text}</ThemedText>
                  }
                </View>
              )}

              {/* Workout routine result card */}
              {m.wcRoutineResult && (
                <View style={[styles.responseCard, { maxWidth: '100%', alignSelf: 'stretch' }]}>
                  <View style={[styles.miniTag, { alignSelf: 'flex-start', backgroundColor: Palette.primaryLight }]}>
                    <ThemedText type="label" style={{ color: Palette.primary }}>AI 추천 루틴</ThemedText>
                  </View>
                  <ThemedText type="subtitle">{m.wcRoutineResult.title}</ThemedText>
                  <ThemedText type="label" themeColor="textSecondary">{m.wcRoutineResult.meta}</ThemedText>
                  <ThemedText type="caption">{m.wcRoutineResult.intro}</ThemedText>
                  {m.wcRoutineResult.exercises.map((ex, i) => (
                    <View key={ex.name} style={styles.exerciseRow}>
                      <NumCircle n={i + 1} />
                      <ThemedText type="caption" style={{ flex: 1 }}>{ex.name}</ThemedText>
                      <ThemedText type="label" themeColor="textSecondary">{ex.detail}</ThemedText>
                    </View>
                  ))}
                  <Pressable
                    onPress={wcHandleStartSession}
                    disabled={wcIsStarting}
                    style={({ pressed }) => [styles.wcCta, { backgroundColor: pressed ? Palette.primaryPressed : Palette.primary, opacity: wcIsStarting ? 0.7 : 1 }]}>
                    {wcIsStarting ? <ActivityIndicator color={Palette.white} /> : <ThemedText type="subtitle" style={{ color: Palette.white }}>운동 시작하기</ThemedText>}
                  </Pressable>
                  <Pressable
                    onPress={wcHandleMakeEasier}
                    disabled={routinePending || wcIsStarting}
                    style={({ pressed }) => [styles.wcGhost, { opacity: pressed || routinePending || wcIsStarting ? 0.6 : 1 }]}>
                    <ThemedText type="label" themeColor="textSecondary">더 쉬운 루틴으로 바꾸기</ThemedText>
                  </Pressable>
                </View>
              )}

              {/* Structured AI response */}
              {m.response ? (
                <>
                  <ResponseBody response={m.response} />

                  {/* Info box: coach message text */}
                  <View style={styles.coachInfoBox}>
                    <ThemedText type="caption" style={{ color: Palette.primary, lineHeight: 22 }}>
                      {m.text}
                    </ThemedText>
                  </View>

                  {/* Caution */}
                  {m.response.caution ? (
                    <View style={styles.caution}>
                      <ThemedText type="label" style={styles.cautionText}>
                        ⚠ {m.response.caution}
                      </ThemedText>
                    </View>
                  ) : null}

                  {/* Followup button — routes by type.
                      followup이 구버전 string으로 올 경우도 방어 처리. */}
                  {m.response.followup && !isWaiting && !isThinking ? (() => {
                    const raw = m.response.followup;
                    const followupObj = typeof raw === 'string'
                      ? { type: 'ask_question' as const, label: raw as string }
                      : raw as FollowupAction;
                    if (!followupObj.label) return null;
                    return (
                      <Pressable
                        onPress={() => {
                          const { type, label } = followupObj;
                          console.log('[analytics] followup_tap', { type, intent: m.response!.intent });
                          if (type === 'log_workout' || type === 'view_plan') {
                            onClose(); router.navigate('/workout' as never);
                          } else if (type === 'view_diet' || type === 'log_meal') {
                            onClose(); router.navigate('/diet' as never);
                          } else if (type === 'book_session') {
                            onClose(); router.navigate('/membership' as never);
                          } else {
                            send(label);
                          }
                        }}
                        style={({ pressed }) => [styles.followupBtn, pressed && styles.pressed]}
                        accessibilityRole="button">
                        <ThemedText type="captionBold" style={{ color: Palette.white }}>
                          {followupObj.label}
                        </ThemedText>
                      </Pressable>
                    );
                  })() : null}
                </>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      {/* Bottom panel */}
      <View style={styles.inputSection}>
        {/* Workout coach selection — replaces input bar while collecting */}
        {wcMode && wcStepIdx < WC_STEPS.length && !wcRoutine && !routinePending ? (
          <View style={styles.wcChipPanel}>
            {/* Progress indicator */}
            <View style={styles.wcProgressRow}>
              <ThemedText type="label" themeColor="textSecondary">
                {wcStepIdx + 1} / {WC_STEPS.length}
              </ThemedText>
              <View style={styles.wcProgressTrack}>
                {WC_STEPS.map((_, i) => (
                  <View
                    key={i}
                    style={[styles.wcProgressDot, { backgroundColor: i <= wcStepIdx ? Palette.primary : Palette.lineDefault }]}
                  />
                ))}
              </View>
            </View>
            {wcShowCustom ? (
              <View style={{ gap: Spacing.sm }}>
                <TextInput
                  style={styles.wcCustomInput}
                  value={wcCustomText}
                  onChangeText={setWcCustomText}
                  placeholder="직접 입력해주세요"
                  placeholderTextColor={Palette.gray300}
                  onSubmitEditing={() => { if (wcCustomText.trim()) wcHandleSelect(wcCustomText.trim()); }}
                  returnKeyType="done"
                  autoFocus
                />
                <Pressable
                  onPress={() => { if (wcCustomText.trim()) wcHandleSelect(wcCustomText.trim()); }}
                  style={({ pressed }) => [styles.wcOptionBtn, { backgroundColor: pressed ? Palette.primaryPressed : Palette.primary }]}>
                  <ThemedText type="captionBold" style={{ color: Palette.white }}>
                    {wcCustomText.trim() ? '이걸로 할게요' : '넘어갈게요'}
                  </ThemedText>
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: Spacing.sm }}>
                {WC_STEPS[wcStepIdx].options.map((opt) => (
                  <Pressable
                    key={opt}
                    onPress={() => wcHandleSelect(opt)}
                    style={({ pressed }) => [styles.wcOptionBtn, styles.wcOptionBtnOutline, pressed && styles.pressed]}>
                    <ThemedText type="captionBold" style={{ color: Palette.gray900 }}>{opt}</ThemedText>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => setWcShowCustom(true)}
                  style={({ pressed }) => [styles.wcOptionBtn, styles.wcOptionBtnDashed, pressed && styles.pressed]}>
                  <ThemedText type="captionBold" style={{ color: Palette.gray500 }}>기타 (직접입력)</ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        ) : isWaiting && pendingIntent ? (
          <View style={styles.intentPanel}>
            <IntentQuestion intent={pendingIntent} onAnswer={onIntentAnswer} />
          </View>
        ) : !isThinking && !wcMode ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
            keyboardShouldPersistTaps="handled">
            {['오늘 식단 추천해줘', '운동 루틴 짜줘', '이번 주 페이스 괜찮아?'].map((q) => (
              <Pressable
                key={q}
                onPress={() => send(q)}
                style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                accessibilityRole="button">
                <ThemedText type="label" style={{ color: Palette.primary }}>{q}</ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        {/* input bar — wcMode 수집 중에는 숨김 */}
        {!(wcMode && wcStepIdx < WC_STEPS.length && !wcRoutine && !routinePending) && inputBar}
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ScreenPadding,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Palette.lineDefault,
  },
  topCenter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Palette.primaryLight,
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
    borderRadius: Radius.full,
  },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  roiChip: {
    borderWidth: 0.5, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },

  // Welcome
  welcomeBody: {
    padding: ScreenPadding,
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatarCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Palette.primaryLight,
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: 52, height: 52 },
  roiCard: {
    borderRadius: Radius.card, padding: Spacing.md, gap: Spacing.sm,
  },
  roiCardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  riskBadge: {
    borderWidth: 0.5, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  progressTrack: {
    flexDirection: 'row', height: 6,
    borderRadius: Radius.full, overflow: 'hidden',
    backgroundColor: Palette.bgSurface,
  },
  progressFill: { height: 6 },
  optionsList: { gap: Spacing.sm },
  optionCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Palette.bgSurface,
    borderWidth: 0.5, borderColor: Palette.lineDefault,
    borderRadius: Radius.card, padding: Spacing.md,
  },
  optionIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  disclaimer: { textAlign: 'center', marginTop: Spacing.xs },

  // Chat messages
  body: { padding: ScreenPadding, gap: Spacing.sm },
  coachLine: { alignItems: 'flex-start', gap: Spacing.xs },
  userLine: { alignItems: 'flex-end' },
  coachAvatarRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  coachAvatar: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Palette.primaryLight,
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  coachAvatarImg: { width: 26, height: 26 },
  bubble: {
    maxWidth: '82%', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.card, minHeight: 36, justifyContent: 'center',
  },
  coachBubble: { backgroundColor: Palette.primary, borderTopLeftRadius: Radius.small },
  userBubble: { backgroundColor: Palette.primaryLight, borderTopRightRadius: Radius.small },

  // Response
  responseCard: {
    backgroundColor: Palette.bgSurface,
    borderWidth: 0.5, borderColor: Palette.lineDefault,
    borderRadius: Radius.button, padding: Spacing.md,
    gap: Spacing.sm, maxWidth: '92%',
  },
  responseCardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  miniTag: {
    borderWidth: 0.5, borderColor: Palette.lineStrong,
    borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  coachInfoBox: {
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.button, padding: Spacing.md, maxWidth: '92%',
  },
  caution: {
    backgroundColor: Palette.errorLight,
    borderRadius: Radius.small, padding: Spacing.sm, maxWidth: '90%',
  },
  cautionText: { color: Palette.error },

  // Diet card
  dietMetrics: {
    flexDirection: 'row', gap: Spacing.sm,
  },
  dietMetricCell: {
    flex: 1, backgroundColor: Palette.bgMuted,
    borderRadius: Radius.small, padding: Spacing.sm, gap: 2,
  },
  mealRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  mealTime: { width: 36 },

  // Photo card
  photoComment: {
    marginTop: Spacing.xs, paddingTop: Spacing.xs,
    borderTopWidth: 0.5, borderTopColor: Palette.lineDefault,
  },

  // Followup button
  followupBtn: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Palette.primary,
    borderRadius: Radius.button, padding: Spacing.md,
    alignSelf: 'stretch',
  },

  // Workout coach inline styles
  wcChipPanel: { paddingHorizontal: ScreenPadding, paddingTop: Spacing.sm, paddingBottom: Spacing.sm, gap: Spacing.sm },
  wcProgressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wcProgressTrack: { flexDirection: 'row', gap: 5 },
  wcProgressDot: { width: 20, height: 4, borderRadius: 2 },
  wcOptionBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.small, alignItems: 'center' },
  wcOptionBtnOutline: { borderWidth: 1, borderColor: Palette.lineDefault, backgroundColor: Palette.bgSurface },
  wcOptionBtnDashed: { borderWidth: 1, borderStyle: 'dashed', borderColor: Palette.gray300, backgroundColor: Palette.bgSurface },
  wcCustomInput: { borderWidth: 1, borderColor: Palette.lineDefault, borderRadius: Radius.small, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 15, color: Palette.gray900, backgroundColor: Palette.bgSurface },
  wcCta: { height: 48, borderRadius: Radius.button, alignItems: 'center', justifyContent: 'center' },
  wcGhost: { height: 40, alignItems: 'center', justifyContent: 'center' },

  // Bottom input section
  inputSection: { borderTopWidth: 0.5, borderTopColor: Palette.lineDefault },
  intentPanel: {
    paddingHorizontal: ScreenPadding, paddingTop: Spacing.md, paddingBottom: Spacing.sm, gap: Spacing.sm,
  },
  chips: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: ScreenPadding, paddingTop: Spacing.sm, paddingBottom: Spacing.xs, gap: Spacing.xs,
  },
  chip: {
    flexShrink: 0, borderWidth: 0.5, borderColor: Palette.lineStrong,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full,
  },
  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: ScreenPadding, paddingTop: Spacing.sm, paddingBottom: Spacing.md,
  },
  textInput: {
    flex: 1, backgroundColor: Palette.gray100, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: 14, color: Palette.gray900,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: Radius.full,
    backgroundColor: Palette.primary, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Palette.gray300 },
  pressed: { opacity: 0.6 },
});
