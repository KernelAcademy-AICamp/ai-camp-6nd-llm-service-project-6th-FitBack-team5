import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Apple, ArrowLeft, ArrowUp, Calendar, CalendarPlus, Camera, Check, Dumbbell, History, Sparkles, Trash2, TrendingUp, X, type LucideIcon } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

const CHARACTER = require('../../../assets/images/Chat.png') as number;

import { ThemedText } from '@/components/themed-text';
import { Icon, Input } from '@/components/ui';
import { Palette, Radius, ScreenPadding, Spacing } from '@/constants/theme';
import { EVENTS, logEvent } from '@/features/analytics/events';
import { useProfile } from '@/features/auth/useProfile';
import { deleteSession, loadSessions, saveSession, type ChatSession } from '@/features/coach/chatHistory';
import type { AppResponse, DietResponse, FollowupAction, PlanBody, RoiInfo } from '@/features/coach/chatbot.types';
import { useAddMeal, type MealType } from '@/features/diet/useMeals';
import { useAiFeedback } from '@/features/coach/useAiFeedback';
import { useDietSummary } from '@/features/coach/useDietSummary';
import { pickFoodImage } from '@/features/diet/pickFoodImage';
import { useHomeActivity } from '@/features/home/useHomeActivity';
import { useAddSchedule, useSchedules, type ScheduleType } from '@/features/home/useSchedules';
import { computeRisk, sortByRisk } from '@/features/membership/dashboard';
import { useMemberships } from '@/features/membership/useMemberships';
import { fetchCoachCandidates } from '@/features/workout/exercises';
import { prepareSessionAudio } from '@/features/workout/start-session';
import { useGenerateRoutine, type Routine, type RoutineInput } from '@/features/workout/useGenerateRoutine';
import { useWorkoutSession } from '@/stores/workout-session';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

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

// 빠른 실행 칩 — 기능 동일, UI만 태그 칩. action으로 동작 분기.
const WELCOME_OPTIONS: {
  icon: LucideIcon;
  label: string;
  action: 'workout' | 'photo' | 'message';
  message?: string;
}[] = [
  { icon: TrendingUp, label: '회원권 활용도', action: 'message', message: '내 회원권 활용도 어때?' },
  { icon: Dumbbell, label: '오늘 운동 추천', action: 'workout' },
  { icon: Apple, label: '식단 추천', action: 'message', message: '오늘 식단 추천해줘' },
  { icon: Camera, label: '식단 사진 분석', action: 'photo' },
  { icon: Calendar, label: '내 일정 확인', action: 'message', message: '이번 주 일정 알려줘' },
];

/** 히스토리 목록 시각 표기: "6/26 14:41" */
function fmtSessionTime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

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

/** 챗봇 추천 plan(자유형) → complete.tsx 가 기대하는 최소 Routine 으로 변환. TTS 스크립트는 비운다(기록 전용). */
function planToRoutine(body: PlanBody): Routine {
  return {
    id: 'coach-plan',
    title: `${body.focus_part} 루틴`,
    meta: `${body.duration_min || 0}분`,
    intro: '',
    exercises: body.items.map((it) => ({
      name: it.name,
      detail: `${it.reps}회 × ${it.sets}세트`,
      description: '',
      caution: '',
      earlyReps: [],
      middleReps: [],
      finalReps: [],
      timeScripts: [],
      halfwayEncouragement: '',
      repScripts: [],
      isStretch: false,
      videoUrl: null,
    })),
  };
}

// ── Helpers ──────────────────────────────────────────────


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

/** AI 추천(운동/식단)을 오늘 일정에 추가. source='ai'. */
function AddToScheduleButton({
  type,
  title,
  payload,
}: {
  type: ScheduleType;
  title: string;
  payload?: Record<string, unknown>;
}) {
  const add = useAddSchedule();
  const [added, setAdded] = useState(false);
  const [failed, setFailed] = useState(false);
  const now = new Date();
  const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const color = added ? Palette.profit : failed ? Palette.error : Palette.primary;
  return (
    <Pressable
      onPress={() => {
        if (added || add.isPending) return;
        setFailed(false);
        logEvent(EVENTS.recommendClick, { type, title });
        add.mutate(
          { date: ymd, type, title, payload, source: 'ai' },
          { onSuccess: () => setAdded(true), onError: () => setFailed(true) },
        );
      }}
      disabled={added || add.isPending}
      style={({ pressed }) => [addSchedStyles.btn, pressed && { opacity: 0.6 }, added && addSchedStyles.done, failed && addSchedStyles.fail]}
      accessibilityRole="button"
      accessibilityLabel={added ? '일정에 넣었어요' : '일정에 넣기(예정)'}>
      <Icon icon={added ? Check : CalendarPlus} size={14} color={color} />
      <ThemedText type="label" style={{ color }}>
        {added ? '일정에 넣었어요(예정)' : failed ? '추가 실패 · 다시 시도' : '일정에 넣기(예정)'}
      </ThemedText>
    </Pressable>
  );
}
const addSchedStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.small,
    borderWidth: 0.5,
    borderColor: Palette.primary,
  },
  done: { borderColor: Palette.profit },
  fail: { borderColor: Palette.error },
});

// ── "오늘 식단으로 기록" — 끼니 선택 후 실제 DB 저장 ────────
const DIET_TIME_OPTIONS = ['아침', '점심', '저녁', '오늘'] as const;
type DietTimeOption = typeof DIET_TIME_OPTIONS[number];

function DietLogButton({
  meals,
  totalKcal,
  proteinG,
}: {
  meals: DietResponse['body']['meals'];
  totalKcal: number;
  proteinG: number;
}) {
  const addMeal = useAddMeal();
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [savedTime, setSavedTime] = useState<DietTimeOption | null>(null);

  async function handleSave(time: DietTimeOption) {
    if (status !== 'idle') return;
    const toSave = time === '오늘' ? meals : meals.filter((m) => m.time === time);
    if (!toSave.length) return;
    setSavedTime(time);
    setStatus('saving');
    try {
      for (const m of toSave) {
        // protein 비례 추정, carb/fat은 AI 응답에 없어 0으로 저장
        await addMeal.mutateAsync({
          mealType: m.time as MealType,
          name: m.menu,
          kcal: m.kcal,
          carb: 0,
          protein: totalKcal > 0 ? Math.round((m.kcal / totalKcal) * proteinG) : 0,
          fat: 0,
          inputMethod: 'manual',
        });
      }
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'saved') {
    return (
      <View style={dietLogStyles.savedRow}>
        <Icon icon={Check} size={16} color={Palette.profit} />
        <ThemedText type="captionBold" style={{ color: Palette.profit }}>
          {savedTime === '오늘' ? '오늘 식단이 기록됐어요!' : `${savedTime} 식단이 기록됐어요!`}
        </ThemedText>
      </View>
    );
  }

  // 처음부터 끼니 칩을 바로 표시 (클릭 2단계 없음)
  return (
    <View style={dietLogStyles.pickerWrap}>
      <ThemedText type="label" themeColor="textSecondary">
        {status === 'saving' ? '저장 중…' : '오늘 식단으로 기록'}
      </ThemedText>
      <View style={dietLogStyles.chipRow}>
        {DIET_TIME_OPTIONS.map((t) => {
          const hasMeals = t === '오늘' ? meals.length > 0 : meals.some((m) => m.time === t);
          return (
            <Pressable
              key={t}
              onPress={() => handleSave(t)}
              disabled={!hasMeals || status === 'saving'}
              style={({ pressed }) => [
                dietLogStyles.chip,
                !hasMeals && dietLogStyles.chipDisabled,
                pressed && { opacity: 0.7 },
                status === 'saving' && { opacity: 0.4 },
              ]}
              accessibilityRole="button">
              <ThemedText type="captionBold" style={{ color: hasMeals ? Palette.primary : Palette.gray300 }}>
                {t}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      {status === 'error' && (
        <ThemedText type="label" style={{ color: Palette.error }}>
          저장에 실패했어요. 다시 시도해주세요.
        </ThemedText>
      )}
    </View>
  );
}

const dietLogStyles = StyleSheet.create({
  pickerWrap: {
    gap: Spacing.sm, padding: Spacing.md,
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.button, alignSelf: 'stretch',
  },
  chipRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  chip: {
    borderWidth: 1, borderColor: Palette.primary,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: Palette.bgSurface,
  },
  chipDisabled: { borderColor: Palette.gray300, backgroundColor: Palette.bgSurface },
  savedRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    padding: Spacing.md, backgroundColor: Palette.successLight,
    borderRadius: Radius.button, alignSelf: 'stretch',
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
            <View style={{ flex: 1 }}>
              <ThemedText type="caption">{item.name}</ThemedText>
              {item.source && item.source !== item.name ? (
                <ThemedText type="label" themeColor="textSecondary">📚 {item.source}</ThemedText>
              ) : null}
            </View>
            <ThemedText type="caption" themeColor="textSecondary">
              {item.sets}세트 × {item.reps}회
            </ThemedText>
          </View>
        ))}
        {items.some((it) => it.source) ? (
          <ThemedText type="label" themeColor="textSecondary">📚 운동 라이브러리 기반 추천</ThemedText>
        ) : null}
        <AddToScheduleButton type="workout" title={`${focus_part} 루틴`} payload={{ items, duration_min }} />
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
        <AddToScheduleButton type="diet" title={response.summary} payload={{ meals, target_kcal, protein_g }} />
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

export function CoachChat({ onClose, initialMessage, initialCoachMessage }: { onClose: () => void; initialMessage?: string; initialCoachMessage?: string }) {
  const router = useRouter();
  const { summary } = useDietSummary();
  const { data: home } = useHomeActivity();
  const { data: profile } = useProfile();
  const { data: memberships } = useMemberships();
  const aiFeedback = useAiFeedback();

  const [view, setView] = useState<'welcome' | 'chat' | 'history'>('welcome');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');

  // 채팅 히스토리(로컬 영속화) — 사용자별 키.
  const userKey = profile?.id ?? 'local';
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  // 코치 진입 이벤트(1회)
  useEffect(() => {
    logEvent(EVENTS.coachOpen);
  }, []);

  // 대화가 시작되면 세션 id 부여.
  useEffect(() => {
    if (!sessionId && messages.some((m) => !m.isLoading && m.text.trim().length > 0)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSessionId(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    }
  }, [messages, sessionId]);

  // 메시지 변동 시 현재 세션을 로컬에 저장(로딩 메시지 제외).
  useEffect(() => {
    if (!sessionId) return;
    const settled = messages.filter((m) => !m.isLoading && (m.text.trim() || m.response || m.wcRoutineResult));
    if (settled.length === 0) return;
    const title = messages.find((m) => m.role === 'user' && m.text.trim())?.text.slice(0, 30) ?? '새 대화';
    void saveSession(userKey, {
      id: sessionId,
      title,
      updatedAt: Date.now(),
      messages: settled.map((m) => ({ role: m.role, text: m.text, response: m.response, wcRoutineResult: m.wcRoutineResult })),
    });
  }, [messages, sessionId, userKey]);

  function openHistory() {
    void loadSessions(userKey).then(setSessions);
    setView('history');
  }
  function openSession(s: ChatSession) {
    setMessages(s.messages as ChatMsg[]);
    setSessionId(s.id);
    setWcMode(false);
    setView('chat');
  }
  async function removeSession(id: string) {
    await deleteSession(userKey, id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  // initialMessage가 있으면 마운트 직후 자동 전송
  useEffect(() => {
    if (initialCoachMessage) {
      const msgs: ChatMsg[] = [];
      if (initialMessage) msgs.push({ role: 'user', text: initialMessage });
      msgs.push({ role: 'coach', text: initialCoachMessage });
      setMessages(msgs);
      setView('chat');
    } else if (initialMessage) {
      const t = setTimeout(() => send(initialMessage), 150);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Workout coach inline flow state
  const [wcMode, setWcMode] = useState(false);
  const [wcStepIdx, setWcStepIdx] = useState(0);
  const [wcAnswers, setWcAnswers] = useState<Partial<Record<WcStepKey, string>>>({});
  const [wcRoutine, setWcRoutine] = useState<Routine | null>(null);
  const [wcIsStarting, setWcIsStarting] = useState(false);
  const [wcShowCustom, setWcShowCustom] = useState(false);
  const [wcCustomText, setWcCustomText] = useState('');

  // Photo analysis state
  const [showPhotoSource, setShowPhotoSource] = useState(false);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const { mutate: generateRoutine, isPending: routinePending } = useGenerateRoutine();
  const setSessionRoutine = useWorkoutSession((s) => s.setRoutine);
  const startWorkoutSession = useWorkoutSession((s) => s.startSession);
  const setSessionCompletedCount = useWorkoutSession((s) => s.setCompletedCount);

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


  // 일정(캘린더) 컨텍스트 — 오늘 + 앞으로 7일 예정. 챗봇이 중복 추천을 피하고 예정 일정을 참고.
  const now0 = new Date();
  const { data: monthSchedules } = useSchedules(now0.getFullYear(), now0.getMonth() + 1);
  const scheduleCtx = useMemo(() => {
    const all = monthSchedules ?? [];
    if (all.length === 0) return null;
    const ymd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const WD = ['일', '월', '화', '수', '목', '금', '토'];
    const when = (iso: string) => {
      const d = new Date(`${iso}T00:00:00`);
      return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})`;
    };
    const today = new Date();
    const todayYmd = ymd(today);
    const cut = new Date(today);
    cut.setDate(cut.getDate() + 7);
    const cutYmd = ymd(cut);
    const todayItems = all
      .filter((s) => s.date === todayYmd)
      .map((s) => ({ when: when(s.date), type: s.type, title: s.title, status: s.status }));
    const upcoming = all
      .filter((s) => s.date > todayYmd && s.date <= cutYmd && s.status === 'planned')
      .map((s) => ({ when: when(s.date), type: s.type, title: s.title }));
    if (todayItems.length === 0 && upcoming.length === 0) return null;
    return { today: todayItems, upcoming };
  }, [monthSchedules]);

  // RAG-lite: 운동 라이브러리 후보(회피 부위 제외) — plan 인텐트 grounding + 출처 표시용.
  const { data: exerciseCandidates } = useQuery({
    queryKey: ['coach-exercise-candidates', profile?.avoid_exercise_parts],
    staleTime: 1000 * 60 * 30,
    queryFn: () => fetchCoachCandidates(profile?.avoid_exercise_parts ?? []),
  });

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
    if (scheduleCtx) ctx.schedule = scheduleCtx;
    if (exerciseCandidates?.length) ctx.exercise_candidates = exerciseCandidates;
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
    // 멀티턴 — 직전 대화 최근 6턴. 코치 멘트(text)뿐 아니라 구조화 응답(루틴/식단/사진)의
    // 실제 내용까지 요약해 history에 넣어야 "두 번째 운동 설명해줘" 같은 후속질문이 이어진다.
    const history = messages
      .filter((m) => !m.isLoading)
      .map((m) => {
        let text = m.text?.trim() ?? '';
        const r = m.response;
        if (r) {
          if (r.intent === 'plan') {
            text += ` [추천 루틴 ${r.body.focus_part}: ${r.body.items
              .map((it, i) => `${i + 1}.${it.name} ${it.sets}x${it.reps}`)
              .join(', ')}]`;
          } else if (r.intent === 'diet') {
            text += ` [추천 식단: ${r.body.meals.map((mm) => `${mm.time} ${mm.menu}`).join(', ')}]`;
          } else if (r.intent === 'photo') {
            text += ` [사진 분석: ${r.body.foods.map((f) => f.name).join(', ')} 총 ${r.body.total_kcal}kcal]`;
          }
        }
        if (m.wcRoutineResult) {
          text += ` [추천 루틴: ${m.wcRoutineResult.exercises
            .map((e, i) => `${i + 1}.${e.name} ${e.detail}`)
            .join(', ')}]`;
        }
        return { role: m.role, text: text.trim() };
      })
      .filter((h) => h.text.length > 0)
      .slice(-6);
    setMessages((prev) => [...prev, { role: 'coach', text: '', isLoading: true }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    aiFeedback.mutate(
      { userContext: buildContext(), roi: buildRoi(), userMessage: message, questionAnswer, history },
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
    callAI(q);
  }

  // 추천 액션 칩(퀵 리플라이) — 딥링크형은 화면 이동, 그 외는 템플릿 질문 전송.
  function handleAction(a: FollowupAction, planBody?: PlanBody) {
    const { type, label } = a;
    if (type === 'log_workout') {
      // 추천 루틴을 완료 기록 작성 화면(/workout/complete)으로 미리 채워 진입 → 사용자가 저장.
      if (planBody && planBody.items.length > 0) {
        const routine = planToRoutine(planBody);
        setSessionRoutine(routine);
        startWorkoutSession();
        setSessionCompletedCount(routine.exercises.length); // 추천 루틴을 '완료'로 표시
        onClose();
        router.navigate('/workout/complete' as never);
      } else {
        onClose();
        router.navigate('/workout' as never);
      }
    } else if (type === 'view_plan') {
      onClose();
      router.navigate('/workout' as never);
    } else if (type === 'view_diet' || type === 'log_meal') {
      onClose();
      router.navigate('/diet' as never);
    } else if (type === 'book_session') {
      onClose();
      router.navigate('/membership' as never);
    } else {
      send(label);
    }
  }

  // 정적 케이스 버튼 — LLM이 actions를 안 줄 때(미배포 포함) general 응답에 기본 칩 부착.
  function fallbackActions(intent: string): FollowupAction[] {
    if (intent !== 'general') return [];
    return [
      { type: 'ask_question', label: '오늘 운동 추천' },
      { type: 'ask_question', label: '이번 주 일정 알려줘' },
      { type: 'book_session', label: '회원권 보기' },
    ];
  }

  // ── Photo analysis handler ────────────────────────────

  async function handlePhotoSelect(source: 'camera' | 'library') {
    setShowPhotoSource(false);

    // pickFoodImage는 user gesture가 살아있을 때 먼저 호출해야 권한 요청이 정상 작동
    let img;
    try {
      img = await pickFoodImage(source);
    } catch (e) {
      // 권한 거부 등 — 조용히 종료 (diet screen과 동일 처리)
      return;
    }
    if (!img) return; // 취소

    // 이미지 획득 후 chat 상태 전환
    setView('chat');
    setMessages([
      { role: 'user', text: '식단 사진 분석해줘' },
      { role: 'coach', text: '', isLoading: true },
    ]);
    setIsAnalyzingPhoto(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

    let analyzed;
    try {
      if (!SUPABASE_URL || !ANON) throw new Error('서버 설정 없음');
      const rawBase64 = img.base64.replace(/^data:[^;]+;base64,/, '');
      const r = await fetch(`${SUPABASE_URL}/functions/v1/food-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ANON}`,
          apikey: ANON,
        },
        body: JSON.stringify({ action: 'analyze-image', image: rawBase64, mediaType: img.mediaType }),
      });
      const json = await r.json();
      if (!r.ok || json.error || typeof json.kcal !== 'number') {
        console.error('[analyze-image] 실패:', r.status, json);
        throw new Error(json.error ?? '분석 실패');
      }
      analyzed = json;
    } catch (err) {
      console.error('[analyze-image] catch:', err);
      setMessages((prev) => {
        const next = [...prev];
        const idx = next.findLastIndex((m) => m.isLoading);
        if (idx !== -1) next[idx] = { role: 'coach', text: 'AI 분석 서비스에 일시적인 문제가 생겼어요. 잠시 후 다시 시도해주세요.' };
        return next;
      });
      setIsAnalyzingPhoto(false);
      return;
    }

    aiFeedback.mutate(
      { userContext: buildContext(), roi: buildRoi(), userMessage: '식단 사진 분석해줘', photoAnalysis: analyzed },
      {
        onSuccess: (res) => {
          setMessages((prev) => {
            const next = [...prev];
            const idx = next.findLastIndex((m) => m.isLoading);
            if (idx !== -1) next[idx] = { role: 'coach', text: res.coach_message, response: res };
            return next;
          });
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
        },
        onError: () => {
          setMessages((prev) => {
            const next = [...prev];
            const idx = next.findLastIndex((m) => m.isLoading);
            if (idx !== -1) next[idx] = { role: 'coach', text: '잠시 후 다시 시도해 주세요.' };
            return next;
          });
        },
        onSettled: () => setIsAnalyzingPhoto(false),
      }
    );
  }

  // ── Workout coach inline handlers ──────────────────────

  function initWorkoutCoach() {
    setMessages([
      { role: 'coach', text: '안녕하세요! 오늘 운동을 함께 만들어봐요. 몇 가지 여쭤볼게요.' },
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

  const isThinking = aiFeedback.isPending;

  // ── Shared input bar ─────────────────────────────────

  const inputBar = (
    <View style={styles.inputBar}>
      <Input
        value={input}
        onChangeText={setInput}
        placeholder={isThinking ? 'AI 코치가 답변 중이에요…' : '무엇이든 물어보세요'}
        onSubmitEditing={() => send(input)}
        returnKeyType="send"
        editable={!isThinking}
        style={{ flex: 1, width: undefined }}
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



  // ── History screen ────────────────────────────────────

  if (view === 'history') {
    return (
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => setView(messages.length ? 'chat' : 'welcome')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="뒤로">
            <Icon icon={ArrowLeft} size={22} color={Palette.gray500} />
          </Pressable>
          <ThemedText type="subtitle">이전 대화</ThemedText>
          <View style={{ width: 22 }} />
        </View>
        <ScrollView contentContainerStyle={styles.welcomeBody} showsVerticalScrollIndicator={false}>
          {sessions.length === 0 ? (
            <ThemedText type="caption" themeColor="textSecondary" style={styles.disclaimer}>
              저장된 대화가 없어요.
            </ThemedText>
          ) : (
            sessions.map((s) => (
              <View key={s.id} style={styles.historyRow}>
                <Pressable style={styles.historyMain} onPress={() => openSession(s)} accessibilityRole="button">
                  <ThemedText type="captionBold" numberOfLines={1}>{s.title}</ThemedText>
                  <ThemedText type="label" themeColor="textSecondary">{fmtSessionTime(s.updatedAt)}</ThemedText>
                </Pressable>
                <Pressable onPress={() => removeSession(s.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel="삭제">
                  <Icon icon={Trash2} size={16} color={Palette.gray500} />
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Welcome screen ────────────────────────────────────

  if (view === 'welcome') {
    return (
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          <View style={styles.pill}>
            <Icon icon={Sparkles} size={13} color={Palette.primary} />
            <ThemedText type="label" style={{ color: Palette.primary }}>핏쌤</ThemedText>
          </View>
          <View style={styles.topRight}>
            <Pressable onPress={openHistory} hitSlop={8} accessibilityRole="button" accessibilityLabel="이전 대화 보기">
              <Icon icon={History} size={20} color={Palette.gray500} />
            </Pressable>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="닫기">
              <Icon icon={X} size={22} color={Palette.gray500} />
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.welcomeBody} showsVerticalScrollIndicator={false}>
          {/* Avatar + greeting */}
          <View style={styles.avatarRow}>
            <View style={styles.avatarCircle}>
              <Image source={CHARACTER} style={styles.avatarImg} resizeMode="contain" />
            </View>
            <View style={{ gap: 2 }}>
              <ThemedText type="label" themeColor="textSecondary">안녕하세요!</ThemedText>
              <ThemedText type="subtitle">회원권 활용도를 챙기는 AI 코치예요</ThemedText>
            </View>
          </View>

          {/* 코치 소개 — 첫 진입 시 무엇을 돕는지 안내 */}
          <View style={styles.introCard}>
            <ThemedText type="caption" style={styles.introText}>
              저는 회원권이 그냥 사라지지 않게 옆에서 챙기는 코치예요.{'\n'}이런 걸 도와드려요.
            </ThemedText>
            <View style={styles.introList}>
              <ThemedText type="caption" themeColor="textSecondary" style={styles.introText}>· 회원권 활용도·만료 — 얼마 남았고 얼마나 활용했는지</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary" style={styles.introText}>· 오늘 운동 추천 — 내 상황에 맞는 루틴(운동 라이브러리 기반)</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary" style={styles.introText}>· 식단 추천·사진 분석 — 목표에 맞춰</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary" style={styles.introText}>· 내 일정 확인 — 이번 주 뭐가 잡혀있는지</ThemedText>
            </View>
            <ThemedText type="caption" style={styles.introText}>무엇이든 편하게 물어보세요.</ThemedText>
          </View>

          {/* 빠른 실행 — 태그 칩 (가로 배열·넘치면 줄바꿈) */}
          <ThemedText type="body" style={{ marginTop: Spacing.sm }}>무엇을 도와드릴까요?</ThemedText>
          <View style={styles.chipsWrap}>
            {WELCOME_OPTIONS.map((opt) => (
              <Pressable
                key={opt.label}
                style={({ pressed }) => [styles.welcomeChip, pressed && styles.pressed]}
                onPress={() => {
                  if (opt.action === 'workout') initWorkoutCoach();
                  else if (opt.action === 'photo') setShowPhotoSource(true);
                  else if (opt.message) send(opt.message);
                }}
                accessibilityRole="button">
                <Icon icon={opt.icon} size={15} color={Palette.primary} />
                <ThemedText type="captionBold">{opt.label}</ThemedText>
              </Pressable>
            ))}
          </View>

          <ThemedText type="label" themeColor="textSecondary" style={styles.disclaimer}>
            회원님의 운동·회원권 기록을 기반으로 답해요.{'\n'}AI 답변은 제한된 데이터에 근거하니 참고용으로 확인해 주세요.
          </ThemedText>
        </ScrollView>

        {/* Photo source picker sheet */}
        {showPhotoSource && (
          <View style={styles.photoSheet}>
            <View style={styles.photoSheetHandle} />
            <ThemedText type="captionBold" style={{ textAlign: 'center', marginBottom: Spacing.sm }}>
              사진 선택
            </ThemedText>
            <Pressable
              onPress={() => handlePhotoSelect('camera')}
              style={({ pressed }) => [styles.photoSheetBtn, pressed && styles.pressed]}>
              <Icon icon={Camera} size={18} color={Palette.primary} />
              <ThemedText type="captionBold" style={{ color: Palette.primary }}>카메라로 찍기</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => handlePhotoSelect('library')}
              style={({ pressed }) => [styles.photoSheetBtn, pressed && styles.pressed]}>
              <Icon icon={Camera} size={18} color={Palette.gray700} />
              <ThemedText type="captionBold">앨범에서 선택</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setShowPhotoSource(false)}
              style={({ pressed }) => [styles.photoSheetCancel, pressed && styles.pressed]}>
              <ThemedText type="caption" themeColor="textSecondary">취소</ThemedText>
            </Pressable>
          </View>
        )}
        <View style={styles.inputSection}>{inputBar}</View>
      </KeyboardAvoidingView>
    );
  }

  // ── Chat screen ───────────────────────────────────────

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.topBar}>
        <View style={styles.topRight}>
          <Pressable onPress={() => setView('welcome')} hitSlop={8} accessibilityRole="button" accessibilityLabel="뒤로">
            <Icon icon={ArrowLeft} size={22} color={Palette.gray500} />
          </Pressable>
          <Pressable onPress={openHistory} hitSlop={8} accessibilityRole="button" accessibilityLabel="이전 대화 보기">
            <Icon icon={History} size={20} color={Palette.gray500} />
          </Pressable>
        </View>
        <View style={styles.topCenter}>
          <View style={styles.pill}>
            <Icon icon={Sparkles} size={13} color={Palette.primary} />
            <ThemedText type="label" style={{ color: Palette.primary }}>핏쌤</ThemedText>
          </View>
        </View>
        <View style={{ width: 22 }} />
      </View>

      {/* Messages */}
      <ScrollView ref={scrollRef} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {messages.map((m, i) => {
          const isLast = i === messages.length - 1;

          if (m.role === 'user') {
            return (
              <View key={i} style={styles.userLine}>
                <View style={[styles.bubble, styles.userBubble]}>
                  <ThemedText type="body" style={{ color: Palette.primary }}>{m.text}</ThemedText>
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
                  <ThemedText type="label" themeColor="textSecondary">핏쌤</ThemedText>
                </View>
              )}

              {/* Bubble: loading / question / plain error — wcRoutineResult는 별도 카드로 렌더 */}
              {(m.isLoading || m.isQuestion || (!m.response && !m.wcRoutineResult)) && (
                <View style={[styles.bubble, styles.coachBubble]}>
                  {m.isLoading
                    ? <TypingIndicator />
                    : <ThemedText type="body" style={{ color: Palette.white }}>{m.text}</ThemedText>
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
                  <AddToScheduleButton
                    type="workout"
                    title={m.wcRoutineResult.title}
                    payload={{ meta: m.wcRoutineResult.meta, exercises: m.wcRoutineResult.exercises }}
                  />
                </View>
              )}

              {/* Structured AI response */}
              {m.response ? (
                <>
                  <ResponseBody response={m.response} />

                  {/* 코치 답변 — 핏쌤 말풍선(컬러 버블·흰 글씨)로 통일 */}
                  {m.text ? (
                    <View style={[styles.bubble, styles.coachBubble]}>
                      <ThemedText type="body" style={{ color: Palette.white }}>{m.text}</ThemedText>
                    </View>
                  ) : null}

                  {/* Caution — 박스 유지, 텍스트 크기는 답변과 동일(caption) */}
                  {m.response.caution ? (
                    <View style={styles.caution}>
                      <ThemedText type="caption" style={styles.cautionText}>
                        ⚠ {m.response.caution}
                      </ThemedText>
                    </View>
                  ) : null}

                  {/* Followup button — routes by type.
                      followup이 구버전 string으로 올 경우도 방어 처리.
                      diet + log_meal 조합은 DietLogButton으로 대체. */}
                  {m.response.followup && !isThinking ? (() => {
                    const raw = m.response.followup;
                    const followupObj = typeof raw === 'string'
                      ? { type: 'ask_question' as const, label: raw as string }
                      : raw as FollowupAction;
                    if (!followupObj.label) return null;

                    // 맥락화 — 실행형 버튼(기록/보기)은 해당 카드가 있을 때만. general(설명·조회)엔 숨김.
                    const EXEC_TYPES = ['log_workout', 'view_plan', 'log_meal', 'view_diet'];
                    if (m.response.intent === 'general' && EXEC_TYPES.includes(followupObj.type)) return null;

                    // 식단 기록 → 끼니 선택 후 실제 DB 저장
                    if (m.response.intent === 'diet' && followupObj.type === 'log_meal') {
                      const dietBody = (m.response as DietResponse).body;
                      return (
                        <DietLogButton
                          meals={dietBody.meals}
                          totalKcal={dietBody.target_kcal}
                          proteinG={dietBody.protein_g}
                        />
                      );
                    }

                    return (
                      <Pressable
                        onPress={() => {
                          console.log('[analytics] followup_tap', { type: followupObj.type, intent: m.response!.intent });
                          const planBody = m.response!.intent === 'plan' ? m.response!.body : undefined;
                          handleAction(followupObj, planBody);
                        }}
                        style={({ pressed }) => [styles.followupBtn, pressed && styles.pressed]}
                        accessibilityRole="button">
                        <ThemedText type="captionBold" style={{ color: Palette.white }}>
                          {followupObj.type === 'log_workout' ? '운동 완료 기록' : followupObj.label}
                        </ThemedText>
                      </Pressable>
                    );
                  })() : null}

                  {/* 추천 액션 칩(퀵 리플라이) — actions 우선, 없으면 general 기본 칩. followup과 중복 라벨 제외. */}
                  {!isThinking ? (() => {
                    const followLabel = typeof m.response.followup === 'string' ? m.response.followup : m.response.followup?.label;
                    const chips = (m.response.actions?.length ? m.response.actions : fallbackActions(m.response.intent))
                      .filter((a) => a.label && a.label !== followLabel);
                    if (chips.length === 0) return null;
                    return (
                      <View style={styles.actionChips}>
                        {chips.slice(0, 3).map((a, idx) => (
                          <Pressable
                            key={`${a.label}-${idx}`}
                            onPress={() => handleAction(a)}
                            style={({ pressed }) => [styles.actionChip, pressed && styles.pressed]}
                            accessibilityRole="button">
                            <ThemedText type="label" style={{ color: Palette.primary }}>{a.label}</ThemedText>
                          </Pressable>
                        ))}
                      </View>
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
                <Input
                  value={wcCustomText}
                  onChangeText={setWcCustomText}
                  placeholder="직접 입력해주세요"
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
        ) : !isThinking && !wcMode && messages.length === 0 ? (
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
  root: { flex: 1, backgroundColor: Palette.bgSurface },

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
  topRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.button,
    borderWidth: 0.5,
    borderColor: Palette.lineDefault,
    backgroundColor: Palette.bgSurface,
  },
  historyMain: { flex: 1, gap: 2 },
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
  introCard: {
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.card,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  introText: { lineHeight: 22, letterSpacing: -0.3 },
  introList: { gap: 8, marginVertical: Spacing.sm },
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
  // 빠른 실행 칩 (흰 배경 · 메인컬러 아이콘 · 가로 wrap)
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  welcomeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.lineDefault,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  disclaimer: { textAlign: 'center', marginTop: Spacing.xs, lineHeight: 18 },

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
  caution: {
    backgroundColor: Palette.errorLight,
    borderRadius: Radius.small, padding: Spacing.sm, maxWidth: '90%',
  },
  cautionText: { color: Palette.error, lineHeight: 22 },

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

  // 추천 액션 칩(퀵 리플라이) — 모든 칩은 흰 배경으로 통일. (새 칩도 이 스타일을 재사용)
  actionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, alignSelf: 'stretch' },
  actionChip: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 0.5, borderColor: Palette.primary,
    backgroundColor: Palette.white,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },

  // Followup button
  followupBtn: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Palette.primary,
    borderRadius: Radius.button, padding: Spacing.md,
    alignSelf: 'stretch',
  },

  // Photo source sheet
  photoSheet: {
    borderTopWidth: 0.5, borderTopColor: Palette.lineDefault,
    backgroundColor: Palette.bgSurface,
    paddingHorizontal: ScreenPadding, paddingTop: Spacing.sm, paddingBottom: Spacing.md,
    gap: Spacing.xs,
  },
  photoSheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Palette.lineStrong,
    alignSelf: 'center', marginBottom: Spacing.sm,
  },
  photoSheetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm,
    borderRadius: Radius.small,
  },
  photoSheetCancel: {
    alignItems: 'center', paddingVertical: Spacing.sm, marginTop: Spacing.xs,
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
    backgroundColor: Palette.white,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full,
  },
  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: ScreenPadding, paddingTop: Spacing.sm, paddingBottom: Spacing.md,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: Radius.full,
    backgroundColor: Palette.primary, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Palette.gray300 },
  pressed: { opacity: 0.6 },
});
