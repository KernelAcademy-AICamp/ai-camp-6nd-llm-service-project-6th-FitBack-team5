import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Droplet,
  Dumbbell,
  Egg,
  Flame,
  Footprints,
  Images,
  Info,
  Moon,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Star,
  Sun,
  Sunrise,
  Trash2,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type DimensionValue,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

// ── 아이콘 (design-system.md §아이콘: Lucide outline, 24px, stroke 1.5) ──────
// MaterialIcons 이름 → Lucide 컴포넌트 매핑. 이름 문자열은 그대로 두고 Icon 래퍼로 렌더.
const ICONS = {
  add: Plus,
  'arrow-back': ArrowLeft,
  'arrow-downward': ArrowDown,
  'arrow-upward': ArrowUp,
  'auto-awesome': Sparkles,
  bedtime: Moon,
  bolt: Zap,
  check: Check,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  close: X,
  'delete-outline': Trash2,
  edit: Pencil,
  egg: Egg,
  'fitness-center': Dumbbell,
  clock: Clock,
  footprints: Footprints,
  info: Info,
  star: Star,
  'info-outline': Info,
  'keyboard-arrow-down': ChevronDown,
  'local-fire-department': Flame,
  'photo-camera': Camera,
  'photo-library': Images,
  search: Search,
  'water-drop': Droplet,
  'wb-sunny': Sun,
  'wb-twilight': Sunrise,
} satisfies Record<string, LucideIcon>;
type IconName = keyof typeof ICONS;

function Icon({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const C = ICONS[name];
  return <C size={size} color={color} strokeWidth={1.5} style={style} />;
}

import { useProfile } from '@/features/auth/useProfile';
import { useAnalyzeImage, useAnalyzeMeal } from '@/features/diet/analyzeMeal';
import { useMealFeedback } from '@/features/diet/mealFeedback';
import { useFoodSearch, type FoodSearchResult } from '@/features/diet/foodSearch';
import {
  MOCK_CONTEXT,
  PART_LABEL,
  calorieTargetFromProfile,
  generateGuide,
  proteinTargetFromProfile,
} from '@/features/diet/guide';
import { pickFoodImage } from '@/features/diet/pickFoodImage';
import { useRecommend } from '@/features/diet/recommend';
import {
  MEAL_TYPES,
  useAddMeal,
  useDeleteMeal,
  useMeals,
  useUpdateMeal,
  type Meal,
  type MealType,
} from '@/features/diet/useMeals';

/**
 * 식단 탭 — design.md 디자인 시스템 적용. UI 가안 구현본.
 *
 * 핵심 가치: "추천 대비 회복 목표 달성률"이 1순위 정보 (얼마나 먹었나가 아님).
 * 구성: ① 운동 맞춤 식단 가이드(운동 대비 섭취 상태 게이지 + 목표 매크로)
 *      ② 코칭(다음 행동 + 추천 식품)  ③ 섭취 칼로리  ④ 오늘 기록
 *
 * 목표 매크로/칼로리는 회원 신체정보(profiles) 기반 — 화면 내 단일 소스(guide.target).
 */

// ── design.md 토큰 ─────────────────────────────────────────
const D = {
  primary: '#6675FF',
  primaryPressed: '#4957D8',
  primaryLight: '#EEF1FF',
  bgBase: '#FAF9F7',
  surface: '#FFFFFF',
  muted: '#F3F4F6',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  gray900: '#111827',
  gray700: '#374151',
  gray500: '#6B7280',
  gray400: '#999999',
  gray300: '#D1D5DB',
  gray100: '#F3F4F6',
  line: 'rgba(0,0,0,0.07)',
  lineStrong: 'rgba(0,0,0,0.15)',
} as const;

const S = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
const R = { small: 8, button: 12, card: 16, modal: 20, full: 100 } as const;
const SIDE = 20; // 좌우 여백 (전 화면 공통)
const NAV_HEIGHT = 64; // 하단 네비바 높이 (app-tabs.web)
const LEVEL1 = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};

// ── 타이포그래피 (자간 -2.5%) ───────────────────────────────
type Variant = 'display' | 'h1' | 'h2' | 'body' | 'caption' | 'label';
const TYPE: Record<Variant, TextStyle> = {
  display: { fontSize: 32, fontWeight: '700', lineHeight: 40, letterSpacing: -0.8 },
  h1: { fontSize: 24, fontWeight: '700', lineHeight: 30, letterSpacing: -0.6 },
  h2: { fontSize: 20, fontWeight: '600', lineHeight: 25, letterSpacing: -0.5 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 24, letterSpacing: -0.4 },
  caption: { fontSize: 14, fontWeight: '400', lineHeight: 21, letterSpacing: -0.35 },
  label: { fontSize: 12, fontWeight: '500', lineHeight: 18, letterSpacing: -0.3 },
};

function Txt({
  variant = 'body',
  color = D.gray900,
  weight,
  style,
  children,
  numberOfLines,
}: {
  variant?: Variant;
  color?: string;
  weight?: TextStyle['fontWeight'];
  style?: TextStyle;
  children: React.ReactNode;
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[TYPE[variant], { color }, weight ? { fontWeight: weight } : null, style]}>
      {children}
    </Text>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// ── 데이터 ──────────────────────────────────────────────────
// Meal · MealType · InputMethod · MEAL_TYPES 는 @/features/diet/useMeals 에서 가져온다.

// 운동 완료 여부 — source='recent'(완료) 일 때만 운동 데이터 표시. 연동 전 가데이터.
const HAS_WORKOUT = MOCK_CONTEXT.source === 'recent';
const WORKOUT_MIN = 45; // 운동 시간(분) — 가데이터
const STEP_COUNT = 6234; // 오늘 걸음수 — 가데이터 (운동 전/계획 없을 때 표시)
// 걸음 소모 칼로리: 약 0.04 kcal/step (성인 평균 추정치)
const STEP_KCAL = Math.round(STEP_COUNT * 0.04);
const BURNED_KCAL = HAS_WORKOUT ? 420 : STEP_KCAL; // 운동 완료면 운동 소모, 아니면 걸음 소모

// 탄단지 표시 정의 (순서: 단 → 탄 → 지). 목표 값은 가이드(guide.target)에서 가져온다.
const MACRO_META = [
  { key: 'protein', label: '단백질' },
  { key: 'carb', label: '탄수화물' },
  { key: 'fat', label: '지방' },
] as const;

// 매크로별 아이콘·색 (다음 식사 추천 표시용)
const MACRO_ICON: Record<'protein' | 'carb' | 'fat', { icon: IconName; color: string }> = {
  protein: { icon: 'local-fire-department', color: '#F5A623' },
  carb: { icon: 'bolt', color: '#F2B807' },
  fat: { icon: 'water-drop', color: '#6675FF' },
};

function currentMealType(): MealType {
  return '저녁'; // 가데이터: 시간대 기본 끼니 (라이브 시각 미사용)
}

// 운동 대비 섭취 상태 (순섭취/목표 비율 → 부족/적정/과다)
function balanceStatus(ratio: number): { label: string; color: string; desc: string } {
  if (ratio < 0.9)
    return { label: '부족', color: D.warning, desc: '현재 운동량 기준 권장 섭취보다 적게 먹었어요.' };
  if (ratio <= 1.05)
    return { label: '적정', color: D.success, desc: '현재 운동량 기준 권장 섭취 범위 안에 있어요.' };
  return { label: '과다', color: D.error, desc: '현재 운동량 기준 권장 섭취를 넘었어요.' };
}

// ── 공통 컴포넌트 ───────────────────────────────────────────
function ProgressBar({ ratio, color = D.primary }: { ratio: number; color?: string }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { backgroundColor: color, width: `${Math.min(Math.max(ratio, 0), 1) * 100}%` }]} />
    </View>
  );
}

// 목표 매크로 진행 — 라벨 + 섭취/목표(g) + 진행 바
function MacroProgress({ label, value, goal }: { label: string; value: number; goal: number }) {
  return (
    <View style={styles.macroCol}>
      <Txt variant="caption" color={D.gray500}>
        {label}
      </Txt>
      <View style={styles.macroValueRow}>
        <Txt variant="body" weight="700">
          {value}
        </Txt>
        <Txt variant="caption" color={D.gray500}>
          {' '}
          / {goal}g
        </Txt>
      </View>
      <View style={styles.macroBar}>
        <ProgressBar ratio={goal > 0 ? value / goal : 0} />
      </View>
    </View>
  );
}

// 반원형 게이지 — 운동 대비 섭취 상태(부족/적정/과다)를 색·채움·라벨로 표현.
// netRatio(순섭취/목표)를 0~1.5 → 0~100%로 매핑(적정 ≈ 2/3 지점). 기록 전(active=false)엔 회색·'등록 전'.
function SemiGauge({
  ratio,
  status,
  active,
}: {
  ratio: number;
  status: { label: string; color: string };
  active: boolean;
}) {
  const W = 148;
  const SW = 13; // 아크 두께
  const r = (W - SW) / 2;
  const cx = W / 2;
  const cy = r + SW / 2;
  const H = cy + SW / 2;
  const p = active ? Math.min(Math.max(ratio, 0), 1) : 0; // 좌→우 채움 비율 (100% = 가득)
  const theta = Math.PI * (1 - p); // 좌(π) → 우(0)
  const ex = cx + r * Math.cos(theta);
  const ey = cy - r * Math.sin(theta);
  const track = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const prog = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
  const color = active ? status.color : D.gray300;
  const score = Math.max(0, Math.round(ratio * 100)); // 마이너스 없이 현재 점수
  return (
    <View style={[styles.gaugeWrap, { width: W, height: H }]}>
      <Svg width={W} height={H}>
        <Path d={track} stroke={D.gray100} strokeWidth={SW} fill="none" strokeLinecap="round" />
        {p > 0 && (
          <Path d={prog} stroke={color} strokeWidth={SW} fill="none" strokeLinecap="round" />
        )}
      </Svg>
      <View style={styles.gaugeLabel}>
        <Txt variant="h1" weight="700" color={active ? D.gray900 : D.gray500}>
          {score}%
        </Txt>
        <Txt variant="caption" weight="700" color={active ? status.color : D.gray500}>
          {active ? status.label : '등록 전'}
        </Txt>
      </View>
    </View>
  );
}

// 스크롤 상단 페이드 — 콘텐츠가 날짜 스트립 아래로 부드럽게 사라지도록 bg색→투명 그라데이션
function FadeTop() {
  return (
    <View pointerEvents="none" style={styles.fadeTop}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="fadeTop" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={D.bgBase} stopOpacity={1} />
            <Stop offset="1" stopColor={D.bgBase} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#fadeTop)" />
      </Svg>
    </View>
  );
}

// 칼로리 그라데이션 바 — 보라→시안 fill + 활동 전/후 점선 마커
function CalorieBar({ consumed, goal, burned }: { consumed: number; goal: number; burned: number }) {
  const scale = goal + burned; // 활동 후(최대)
  const fill = Math.min(Math.max(consumed / scale, 0), 1);
  const beforePos = Math.min(Math.max(goal / scale, 0), 1); // 활동 전 위치
  return (
    <View>
      <View style={styles.calBarWrap}>
        <View style={styles.calTrack}>
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="calGrad" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#8E9BFF" />
                <Stop offset="1" stopColor="#6675FF" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={`${(fill * 100).toFixed(1)}%`} height="100%" rx="6" fill="url(#calGrad)" />
          </Svg>
        </View>
        <View style={[styles.calMarker, { left: `${(beforePos * 100).toFixed(1)}%` as DimensionValue }]} />
        <View style={[styles.calMarker, { left: '100%' }]} />
      </View>
      <View style={styles.calLabels}>
        <View style={[styles.calLabelAnchor, { left: `${(beforePos * 100).toFixed(1)}%` as DimensionValue }]}>
          <Txt variant="label" color="#999999" style={styles.calLabelCentered}>
            활동 전
          </Txt>
        </View>
        <Txt variant="label" color="#999999" style={styles.calLabelRight}>
          활동 후
        </Txt>
      </View>
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryBtn,
        { backgroundColor: disabled ? D.gray300 : pressed ? D.primaryPressed : D.primary },
      ]}>
      <Txt variant="body" weight="600" color="#FFFFFF">
        {label}
      </Txt>
    </Pressable>
  );
}

// 끼니별 아이콘·색 (배경 없이 아이콘 틴트만)
const MEAL_VISUAL: Record<MealType, { icon: IconName; tint: string }> = {
  아침: { icon: 'wb-twilight', tint: '#F5A623' },
  점심: { icon: 'wb-sunny', tint: '#F2B807' },
  저녁: { icon: 'bedtime', tint: '#7C6CF0' },
  간식: { icon: 'egg', tint: '#F5A623' },
};

// 끼니 슬롯 — 해당 끼니의 기록을 요약(없으면 추가 버튼). 탭하면 그 끼니로 기록 추가.
function MealSlot({ type, meals, onPress }: { type: MealType; meals: Meal[]; onPress: (t: MealType) => void }) {
  const v = MEAL_VISUAL[type];
  const mine = meals.filter((m) => m.mealType === type);
  const has = mine.length > 0;
  const name = mine.map((m) => m.name).join(', ');
  const kcal = mine.reduce((s, m) => s + m.kcal, 0);
  const time = mine[0]?.time;
  return (
    <Pressable onPress={() => onPress(type)} style={styles.slotCard}>
      <View style={styles.slotIcon}>
        <Icon name={v.icon} size={28} color={v.tint} />
      </View>
      <View style={styles.flex1}>
        <Txt variant="body" weight="700">
          {type}
        </Txt>
        {has ? (
          <>
            <Txt variant="caption" color={D.gray700} numberOfLines={1}>
              {name}
            </Txt>
            <Txt variant="caption" color={D.gray500}>
              {time} · {kcal} kcal
            </Txt>
          </>
        ) : (
          <Txt variant="caption" color={D.gray500}>
            아직 기록 없음
          </Txt>
        )}
      </View>
      {has ? (
        <View style={styles.slotRight}>
          <View style={styles.slotBadge}>
            <Icon name="check" size={12} color={D.success} />
            <Txt variant="label" weight="600" color={D.success}>
              기록됨
            </Txt>
          </View>
          <Icon name="chevron-right" size={20} color={D.gray300} />
        </View>
      ) : (
        <View style={styles.slotAddBtn}>
          <Icon name="add" size={20} color={D.primary} />
        </View>
      )}
    </Pressable>
  );
}

// ── 기록 모달 (전체 화면 + 탭) ──────────────────────────────
type RecTab = 'image' | 'text' | 'search' | 'favorites';
type RecStep = 'input' | 'analyzing' | 'review' | 'result';
type MacroTotals = { kcal: number; carb: number; protein: number; fat: number };
// 결과 화면 매크로 점(컬러)
const MACRO_DOT: Record<'protein' | 'carb' | 'fat', string> = {
  protein: '#6675FF',
  carb: '#3B82F6',
  fat: '#14B8A6',
};

// 코치 피드백 = 한 줄 요약(title) + 상세(body).
type CoachText = { title: string; body: string };

// 실제 Claude 응답 문자열 → {요약, 상세}. 첫 줄(또는 첫 문장)을 제목으로 분리.
function splitCoach(text: string): CoachText {
  const t = text.trim();
  const nl = t.indexOf('\n');
  if (nl > 0) return { title: t.slice(0, nl).trim().replace(/^[-•]\s*/, ''), body: t.slice(nl + 1).trim() };
  const m = t.match(/^(.+?[.!?])\s+([\s\S]+)$/);
  if (m) return { title: m[1].trim(), body: m[2].trim() };
  return { title: t, body: '' };
}

// AI 코치 피드백 로컬 폴백 — feedback 액션 배포 전(또는 호출 실패) UI를 채운다.
// 실제 PT가 회원을 관리하듯 수치 기반으로 구체적·솔직하게. 배포되면 실제 Claude 응답이 우선.
function coachFallback(m: { kcal: number; carb: number; protein: number; fat: number }, context?: string): CoachText {
  const ctx = context ?? '운동';
  const p = Math.round(m.protein);
  const c = Math.round(m.carb);
  const f = Math.round(m.fat);
  const lines: string[] = [];

  // 한 줄 요약(제목) — 가장 중요한 한 가지(단백질 기준)
  const title =
    p >= 30 ? '단백질 완벽, 회복 준비 끝!' : p >= 18 ? '좋아요, 단백질만 조금 더!' : p >= 5 ? '회복엔 단백질이 부족해요' : '단백질을 꼭 추가하세요';

  // 단백질 — 회복의 핵심. 한 끼 30g 기준으로 솔직하게.
  if (p >= 30) lines.push(`단백질 ${p}g, 아주 잘 챙기셨어요. ${ctx} 후 근육 회복에 딱 좋은 양이에요.`);
  else if (p >= 18) lines.push(`단백질 ${p}g, 나쁘지 않아요. 다만 회복을 제대로 노린다면 한 끼 30g까지는 끌어올리는 게 좋아요.`);
  else if (p >= 5) lines.push(`솔직히 단백질 ${p}g은 회복엔 좀 부족해요. ${ctx}을 한 날엔 닭가슴살·계란·두부로 20g 이상은 챙겨야 효과가 나요.`);
  else lines.push(`이 끼니엔 단백질이 거의 없네요. 회복을 위해 단백질 한 가지는 꼭 더해주세요.`);

  // 탄수화물 — 에너지/글리코겐 보충.
  if (c >= 70) lines.push(`탄수화물 ${c}g으로 에너지는 충분히 채웠으니, 다음 끼니는 좀 가볍게 가도 됩니다.`);
  else if (c >= 30) lines.push(`탄수화물 ${c}g은 적당한 수준이에요.`);
  else if (c >= 1) lines.push(`탄수화물이 ${c}g으로 적은 편이라, 운동한 날엔 고구마·현미밥으로 조금 더 채우면 회복이 빨라져요.`);

  // 지방 — 과다만 솔직히 짚기.
  if (f >= 25) lines.push(`지방 ${f}g은 살짝 높은 편이니, 다음 끼니에선 기름진 메뉴는 줄여봐요.`);

  // 마무리 동기부여.
  lines.push('이렇게 기록 꾸준히 하는 것만으로도 잘하고 있는 거예요. 다음 끼니도 같이 챙겨봐요!');
  return { title, body: lines.join(' ') };
}
const REC_TABS: { key: RecTab; label: string; icon: IconName }[] = [
  { key: 'image', label: '사진 촬영', icon: 'photo-camera' },
  { key: 'text', label: '텍스트 입력', icon: 'edit' },
  { key: 'search', label: '검색', icon: 'search' },
  { key: 'favorites', label: '즐겨찾기', icon: 'star' },
];

function RecordModal({
  visible,
  initialMealType,
  target,
  totals,
  dayMeals,
  onClose,
  onSave,
}: {
  visible: boolean;
  initialMealType?: MealType;
  target: MacroTotals; // 일일 목표 매크로
  totals: MacroTotals; // 저장 직전까지의 오늘 누적
  dayMeals: Meal[]; // 결과 화면 점수 추이 그래프용 (그날 기록)
  onClose: () => void;
  onSave: (meal: Omit<Meal, 'id' | 'time'>, eatenAt: Date) => void;
}) {
  // 슬롯에서 열면 그 끼니로, 아니면 시간대 기본 끼니
  const mealType = initialMealType ?? currentMealType();
  const [tab, setTab] = useState<RecTab>('image');
  const [step, setStep] = useState<RecStep>('input');
  const [textInput, setTextInput] = useState('');
  const [gramsInput, setGramsInput] = useState(''); // 선택: 총 섭취량(g)
  const [searchInput, setSearchInput] = useState('');
  const [draft, setDraft] = useState<Omit<Meal, 'id' | 'time'> | null>(null);
  const [resultBase, setResultBase] = useState<MacroTotals | null>(null); // 저장 시점 누적 스냅샷
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const analyzeMeal = useAnalyzeMeal();
  const analyzeImage = useAnalyzeImage();
  const [editingReview, setEditingReview] = useState(false); // 리뷰 값 직접 편집 모드
  // 수량 스테퍼 — AI 분석 1인분 기준값 × quantity
  const [quantity, setQuantity] = useState(1);
  const [baseNutrition, setBaseNutrition] = useState<{ kcal: number; carb: number; protein: number; fat: number } | null>(null);
  // 식사 시간 — 모달 열릴 때 시각으로 초기화
  const [mealTime, setMealTime] = useState(() => new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const feedback = useMealFeedback();
  const feedbackRequested = useRef(false); // 리뷰 진입당 1회만 요청(편집 중 재호출 방지)

  // 오늘 운동 맥락 (가데이터) — 트레이너 피드백에 회복 관점 반영
  const feedbackContext = MOCK_CONTEXT.part ? `${PART_LABEL[MOCK_CONTEXT.part]} 운동 회복` : undefined;

  // 수량 반영 스케일값 — 편집 중엔 draft 그대로, 아닐 때는 baseNutrition × quantity
  const scaledKcal    = baseNutrition && !editingReview ? Math.round(baseNutrition.kcal     * quantity) : (draft?.kcal     ?? 0);
  const scaledCarb    = baseNutrition && !editingReview ? Math.round(baseNutrition.carb     * quantity) : (draft?.carb     ?? 0);
  const scaledProtein = baseNutrition && !editingReview ? Math.round(baseNutrition.protein  * quantity) : (draft?.protein  ?? 0);
  const scaledFat     = baseNutrition && !editingReview ? Math.round(baseNutrition.fat      * quantity) : (draft?.fat      ?? 0);
  const goalPct       = target.kcal > 0 ? Math.round((scaledKcal / target.kcal) * 100) : 0;
  const remainingKcal = Math.max(0, target.kcal - totals.kcal - scaledKcal);

  function formatMealTime(d: Date): string {
    const h = d.getHours(), m = d.getMinutes();
    const ampm = h < 12 ? '오전' : '오후';
    return `${d.getMonth() + 1}.${d.getDate()} ${ampm} ${h % 12 || 12}:${String(m).padStart(2, '0')}`;
  }

  // 수정 버튼 토글 — 편집 시작 시 스케일값을 draft에 스냅샷
  function toggleEdit() {
    if (!editingReview && draft) {
      setDraft({ ...draft, kcal: scaledKcal, carb: scaledCarb, protein: scaledProtein, fat: scaledFat });
      setBaseNutrition(null);
      setQuantity(1);
    }
    setEditingReview((v) => !v);
  }

  // 리뷰 진입 시 트레이너 피드백 1회 요청 (편집으로 값이 바뀌어도 재요청 안 함)
  useEffect(() => {
    if (step !== 'review' || !draft || feedbackRequested.current) return;
    feedbackRequested.current = true;
    feedback.mutate({
      name: draft.name,
      kcal: draft.kcal,
      carb: draft.carb,
      protein: draft.protein,
      fat: draft.fat,
      mealType: draft.mealType,
      context: feedbackContext,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, draft]);

  // 리뷰를 떠날 때(뒤로/닫기) 다음 분석에서 피드백 재요청되도록 초기화
  function leaveReview() {
    setStep('input');
    setEditingReview(false);
    setQuantity(1);
    setBaseNutrition(null);
    feedbackRequested.current = false;
    feedback.reset();
  }

  function close() {
    setTab('image');
    setStep('input');
    setTextInput('');
    setGramsInput('');
    setSearchInput('');
    setDraft(null);
    setResultBase(null);
    setAnalyzeError(null);
    setEditingReview(false);
    setQuantity(1);
    setBaseNutrition(null);
    setMealTime(new Date());
    feedbackRequested.current = false;
    feedback.reset();
    onClose();
  }

  // 저장 → 결과 화면으로. 누적 스냅샷을 잡아 '이번 식사 기여' 계산에 사용.
  function saveAndShowResult() {
    if (!draft) return;
    const toSave: Omit<Meal, 'id' | 'time'> = { ...draft, kcal: scaledKcal, carb: scaledCarb, protein: scaledProtein, fat: scaledFat };
    setDraft(toSave); // ResultView에서도 스케일된 값 사용
    setResultBase(totals);
    onSave(toSave, mealTime);
    setStep('result');
  }

  // 결과 화면에서 '기록 계속하기' → 입력 단계로 리셋(모달 유지)
  function continueRecording() {
    setStep('input');
    setTab('image');
    setTextInput('');
    setGramsInput('');
    setSearchInput('');
    setDraft(null);
    setResultBase(null);
    setEditingReview(false);
    setQuantity(1);
    setBaseNutrition(null);
    setMealTime(new Date());
    feedbackRequested.current = false;
    feedback.reset();
  }

  // 텍스트 탭: Claude(analyze-meal Edge Function)로 실제 영양 추정
  async function analyzeText() {
    const text = textInput.trim();
    if (!text) return;
    const grams = parseInt(gramsInput, 10);
    setAnalyzeError(null);
    setStep('analyzing');
    try {
      const r = await analyzeMeal.mutateAsync({ text, grams: Number.isFinite(grams) && grams > 0 ? grams : undefined });
      setBaseNutrition({ kcal: r.kcal, carb: r.carb, protein: r.protein, fat: r.fat });
      setQuantity(1);
      setDraft({
        mealType,
        name: r.name,
        kcal: r.kcal,
        carb: r.carb,
        protein: r.protein,
        fat: r.fat,
        inputMethod: 'manual',
      });
      setStep('review');
    } catch {
      setStep('input');
      setAnalyzeError('분석에 실패했어요. 음식을 더 구체적으로 적고 다시 시도해 주세요.');
    }
  }

  // 사진 탭: 앨범/카메라로 사진 → Claude 비전 영양 추정
  async function analyzeFromImage(source: 'camera' | 'library') {
    setAnalyzeError(null);
    let picked;
    try {
      picked = await pickFoodImage(source);
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : '사진을 불러오지 못했어요.');
      return;
    }
    if (!picked) return; // 사용자가 취소
    setStep('analyzing');
    try {
      const r = await analyzeImage.mutateAsync(picked);
      setBaseNutrition({ kcal: r.kcal, carb: r.carb, protein: r.protein, fat: r.fat });
      setQuantity(1);
      setDraft({
        mealType,
        name: r.name,
        kcal: r.kcal,
        carb: r.carb,
        protein: r.protein,
        fat: r.fat,
        inputMethod: 'image',
      });
      setStep('review');
    } catch {
      setStep('input');
      setAnalyzeError('사진 분석에 실패했어요. 음식이 잘 보이는 사진으로 다시 시도해 주세요.');
    }
  }

  function pickFood(food: FoodSearchResult) {
    setBaseNutrition({ kcal: food.kcal, carb: food.carb, protein: food.protein, fat: food.fat });
    setQuantity(1);
    setDraft({
      mealType,
      name: food.name,
      kcal: food.kcal,
      carb: food.carb,
      protein: food.protein,
      fat: food.fat,
      inputMethod: 'manual',
    });
    setStep('review');
  }

  // 검색어 디바운스(350ms) 후 식약처 DB 검색
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);
  const search = useFoodSearch(debouncedQuery);
  const searchResults = search.data ?? [];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.recScreen} edges={['top', 'bottom', 'left', 'right']}>
        {/* 헤더 */}
        <View style={styles.recHeader}>
          <Pressable onPress={() => (step === 'review' ? leaveReview() : close())} hitSlop={8} style={styles.recHeaderBtn}>
            <Icon name={step === 'review' ? 'arrow-back' : 'close'} size={24} color={D.gray900} />
          </Pressable>
          <Txt variant="h2">
            {step === 'review' ? 'AI 분석 결과' : step === 'result' ? '기록 완료' : '식단 기록'}
          </Txt>
          <View style={styles.recHeaderBtn} />
        </View>

        {step === 'review' && draft ? (
          <ScrollView contentContainerStyle={styles.reviewBody} showsVerticalScrollIndicator={false}>
            {/* ① 음식 카드 — 이미지 + 이름 + 수량 스테퍼 */}
            <View style={styles.reviewFoodCard}>
              <View style={styles.reviewFoodTop}>
                <View style={styles.reviewFoodImg}>
                  <Icon name="photo-library" size={28} color={D.primary} />
                </View>
                <View style={styles.reviewFoodInfo}>
                  {editingReview ? (
                    <TextInput
                      value={draft.name}
                      onChangeText={(t) => setDraft({ ...draft, name: t })}
                      placeholder="음식 이름"
                      placeholderTextColor={D.gray300}
                      style={styles.reviewNameInput}
                    />
                  ) : (
                    <>
                      <View style={styles.reviewFoodNameRow}>
                        <Txt variant="body" weight="700">{draft.name}</Txt>
                        <View style={styles.reviewAiBadge}>
                          <Txt variant="label" weight="600" color={D.primary}>AI 추정값</Txt>
                        </View>
                      </View>
                      <Txt variant="caption" color={D.gray500}>인식 결과가 다르면 수정해 주세요</Txt>
                    </>
                  )}
                </View>
                <Pressable onPress={toggleEdit} hitSlop={8} style={styles.reviewEditBtnTop}>
                  <Icon name={editingReview ? 'check' : 'edit'} size={14} color={D.primary} />
                  <Txt variant="label" weight="700" color={D.primary}>{editingReview ? '완료' : '수정'}</Txt>
                </Pressable>
              </View>
              {!editingReview && (
                <View style={styles.reviewStepperRow}>
                  <View style={styles.reviewStepper}>
                    <Pressable onPress={() => setQuantity((q) => Math.max(1, q - 1))} style={styles.stepperBtn} hitSlop={8}>
                      <Txt variant="h2" color={D.gray700}>-</Txt>
                    </Pressable>
                    <Txt variant="body" weight="700" style={styles.stepperNum}>{quantity}</Txt>
                    <Pressable onPress={() => setQuantity((q) => q + 1)} style={styles.stepperBtn} hitSlop={8}>
                      <Txt variant="h2" color={D.gray700}>+</Txt>
                    </Pressable>
                  </View>
                  <View style={styles.stepperUnit}>
                    <Txt variant="body" color={D.gray700}>인분</Txt>
                    <Icon name="keyboard-arrow-down" size={18} color={D.gray500} />
                  </View>
                </View>
              )}
            </View>

            {/* ② 영양 카드 — kcal + 목표% + 탄단지 */}
            <View style={styles.reviewNutrCard}>
              <View style={styles.reviewNutrKcalRow}>
                {editingReview ? (
                  <TextInput
                    value={String(draft.kcal)}
                    onChangeText={(t) => setDraft({ ...draft, kcal: toInt(onlyDigits(t)) })}
                    keyboardType="number-pad"
                    style={styles.reviewKcalInput}
                  />
                ) : (
                  <Txt variant="display" weight="700" color={D.gray900}>{scaledKcal}</Txt>
                )}
                <Txt variant="body" color={D.gray500}> kcal</Txt>
                {!editingReview && (
                  <View style={styles.dailyPctBadge}>
                    <Txt variant="label" weight="600" color={D.primary}>일일 목표 {goalPct}%</Txt>
                  </View>
                )}
              </View>
              {!editingReview && (
                <Txt variant="caption" color={D.gray500}>
                  오늘 목표까지 {remainingKcal.toLocaleString()}kcal 남았어요
                </Txt>
              )}
              <View style={styles.macroRow}>
                {(['carb', 'protein', 'fat'] as const).map((k) => {
                  const label = k === 'carb' ? '탄수화물' : k === 'protein' ? '단백질' : '지방';
                  const val = k === 'carb' ? scaledCarb : k === 'protein' ? scaledProtein : scaledFat;
                  return (
                    <MacroBox key={k} mkey={k} label={label}>
                      {editingReview ? (
                        <TextInput
                          value={String(draft[k])}
                          onChangeText={(t) => setDraft({ ...draft, [k]: toInt(onlyDigits(t)) })}
                          keyboardType="number-pad"
                          style={styles.reviewMacroInput}
                        />
                      ) : (
                        <>
                          <Txt variant="h2" weight="700" color={D.gray900}>{val}g</Txt>
                          <View style={styles.macroBar}>
                            <ProgressBar ratio={target[k] > 0 ? (totals[k] + val) / target[k] : 0} color={MACRO_DOT[k]} />
                          </View>
                        </>
                      )}
                    </MacroBox>
                  );
                })}
              </View>
              <Pressable style={styles.nutriDetailRow}>
                <Txt variant="label" color={D.gray500}>영양소 상세</Txt>
                <Icon name="chevron-right" size={14} color={D.gray500} />
              </Pressable>
            </View>

            {/* ③ AI 피드백 버블 */}
            {(feedback.isPending || !!feedback.data) && (
              <View style={styles.reviewFeedbackBubble}>
                <Icon name="auto-awesome" size={16} color={D.primary} style={{ marginTop: 2 }} />
                {feedback.isPending ? (
                  <>
                    <ActivityIndicator size="small" color={D.primary} />
                    <Txt variant="caption" color={D.gray500}>코멘트 준비 중…</Txt>
                  </>
                ) : (
                  <Txt variant="body" color={D.gray900} style={styles.flex1}>
                    {(() => { const c = splitCoach(feedback.data ?? ''); return [c.title, c.body].filter(Boolean).join(' '); })()}
                  </Txt>
                )}
              </View>
            )}

            {/* ④ 끼니 */}
            <Txt variant="caption" weight="600" color={D.gray500}>끼니</Txt>
            <View style={styles.chipRow}>
              {MEAL_TYPES.map((t) => {
                const selected = draft.mealType === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setDraft({ ...draft, mealType: t })}
                    style={[
                      styles.mealChip,
                      selected
                        ? { backgroundColor: D.primaryLight, borderColor: D.primary }
                        : { backgroundColor: D.surface, borderColor: D.line },
                    ]}>
                    <Txt variant="caption" weight="600" color={selected ? D.primary : D.gray700}>{t}</Txt>
                  </Pressable>
                );
              })}
            </View>

            {/* ⑤ 식사 시간 */}
            <Pressable style={styles.mealTimeRow} onPress={() => setShowTimePicker((v) => !v)}>
              <Icon name="clock" size={16} color={D.gray500} />
              <Txt variant="body" color={D.gray700} style={styles.flex1}>식사 시간</Txt>
              <Txt variant="body" weight="600" color={D.gray700}>{formatMealTime(mealTime)}</Txt>
              <Icon name={showTimePicker ? 'arrow-upward' : 'keyboard-arrow-down'} size={18} color={D.gray500} />
            </Pressable>

            {showTimePicker && (
              <View style={styles.timePicker}>
                {/* 시 */}
                <View style={styles.timePickerGroup}>
                  <Pressable
                    hitSlop={8}
                    onPress={() => setMealTime((prev) => { const n = new Date(prev); n.setHours((prev.getHours() + 23) % 24, prev.getMinutes()); return n; })}
                    style={styles.timePickerArrow}>
                    <Icon name="arrow-upward" size={18} color={D.gray700} />
                  </Pressable>
                  <Txt variant="h2" weight="700" color={D.gray900}>{String(mealTime.getHours()).padStart(2, '0')}</Txt>
                  <Pressable
                    hitSlop={8}
                    onPress={() => setMealTime((prev) => { const n = new Date(prev); n.setHours((prev.getHours() + 1) % 24, prev.getMinutes()); return n; })}
                    style={styles.timePickerArrow}>
                    <Icon name="arrow-downward" size={18} color={D.gray700} />
                  </Pressable>
                </View>
                <Txt variant="h2" color={D.gray400}>:</Txt>
                {/* 분 */}
                <View style={styles.timePickerGroup}>
                  <Pressable
                    hitSlop={8}
                    onPress={() => setMealTime((prev) => { const n = new Date(prev); n.setHours(prev.getHours(), ((prev.getMinutes() - 5 + 60) % 60)); return n; })}
                    style={styles.timePickerArrow}>
                    <Icon name="arrow-upward" size={18} color={D.gray700} />
                  </Pressable>
                  <Txt variant="h2" weight="700" color={D.gray900}>{String(mealTime.getMinutes()).padStart(2, '0')}</Txt>
                  <Pressable
                    hitSlop={8}
                    onPress={() => setMealTime((prev) => { const n = new Date(prev); n.setHours(prev.getHours(), (prev.getMinutes() + 5) % 60); return n; })}
                    style={styles.timePickerArrow}>
                    <Icon name="arrow-downward" size={18} color={D.gray700} />
                  </Pressable>
                </View>
                <Pressable onPress={() => setShowTimePicker(false)} style={styles.timePickerDone} hitSlop={8}>
                  <Txt variant="caption" weight="600" color={D.primary}>완료</Txt>
                </Pressable>
              </View>
            )}

            <PrimaryButton label="저장하기" onPress={saveAndShowResult} />
          </ScrollView>
        ) : step === 'result' && draft ? (
          <ResultView
            draft={draft}
            target={target}
            base={resultBase}
            dayMeals={dayMeals}
            context={feedbackContext}
            feedback={feedback}
            onContinue={continueRecording}
            onDone={close}
          />
        ) : step === 'analyzing' ? (
          <View style={styles.analyzing}>
            <ActivityIndicator size="large" color={D.primary} />
            <Txt variant="body">AI가 음식을 분석하고 있어요</Txt>
            <Txt variant="caption" color={D.gray500}>
              음식 인식 · 칼로리 추정 · 탄단지 분석
            </Txt>
          </View>
        ) : (
          <>
            {/* 탭 */}
            <View style={styles.recTabBar}>
              {REC_TABS.map((t) => {
                const active = tab === t.key;
                const color = active ? D.primary : D.gray500;
                return (
                  <Pressable key={t.key} onPress={() => setTab(t.key)} style={styles.recTab}>
                    <Txt variant="body" weight={active ? '700' : '400'} color={color}>
                      {t.label}
                    </Txt>
                    {active && <View style={styles.recTabIndicator} />}
                  </Pressable>
                );
              })}
            </View>

            {/* 탭 내용 */}
            {tab === 'image' && (
              <View style={styles.photoArea}>
                <Pressable onPress={() => analyzeFromImage('camera')} style={styles.photoBtn}>
                  <Icon name="photo-camera" size={40} color={D.primary} />
                </Pressable>
                <Txt variant="body" weight="600">
                  사진으로 기록하기
                </Txt>
                <Txt variant="caption" color={D.gray500} style={styles.center}>
                  음식을 촬영하면 AI가 칼로리·탄단지를 분석해요.
                </Txt>
                <View style={styles.photoBtnRow}>
                  <Pressable onPress={() => analyzeFromImage('camera')} style={styles.photoAction}>
                    <Icon name="photo-camera" size={20} color={D.primary} />
                    <Txt variant="caption" weight="600" color={D.primary}>
                      촬영
                    </Txt>
                  </Pressable>
                  <Pressable onPress={() => analyzeFromImage('library')} style={styles.photoAction}>
                    <Icon name="photo-library" size={20} color={D.primary} />
                    <Txt variant="caption" weight="600" color={D.primary}>
                      앨범에서 선택
                    </Txt>
                  </Pressable>
                </View>
                {analyzeError && (
                  <Txt variant="caption" color={D.error} style={styles.center}>
                    {analyzeError}
                  </Txt>
                )}
              </View>
            )}

            {tab === 'text' && (
              <View style={styles.tabForm}>
                <TextInput
                  value={textInput}
                  onChangeText={setTextInput}
                  placeholder={'먹은 음식을 입력하세요.\n(예: 치킨 2조각, 현미밥 한공기, 사과 1개)'}
                  placeholderTextColor={D.gray300}
                  style={styles.textArea}
                  multiline
                  autoFocus
                />
                <View style={styles.gramsRow}>
                  <Txt variant="label" color={D.gray500} style={styles.flex1}>
                    총 섭취량 (선택)
                  </Txt>
                  <TextInput
                    value={gramsInput}
                    onChangeText={(t) => setGramsInput(t.replace(/[^0-9]/g, ''))}
                    placeholder="예: 250"
                    placeholderTextColor={D.gray300}
                    keyboardType="number-pad"
                    style={styles.gramsInput}
                  />
                  <Txt variant="body" color={D.gray500}>
                    g
                  </Txt>
                </View>
                {analyzeError && (
                  <Txt variant="caption" color={D.error}>
                    {analyzeError}
                  </Txt>
                )}
                <PrimaryButton label="AI 분석" disabled={!textInput.trim()} onPress={analyzeText} />
              </View>
            )}

            {tab === 'favorites' && (
              <View style={styles.photoArea}>
                <View style={[styles.photoBtn, { backgroundColor: D.muted }]}>
                  <Icon name="star" size={36} color={D.gray300} />
                </View>
                <Txt variant="body" weight="600" color={D.gray700}>
                  즐겨찾기한 음식이 없어요
                </Txt>
                <Txt variant="caption" color={D.gray500} style={{ textAlign: 'center' }}>
                  검색에서 음식을 찾은 후{'\n'}별표를 눌러 저장해보세요.
                </Txt>
              </View>
            )}

            {tab === 'search' && (
              <View style={styles.tabForm}>
                <View style={styles.searchBar}>
                  <Icon name="search" size={20} color={D.gray500} />
                  <TextInput
                    value={searchInput}
                    onChangeText={setSearchInput}
                    placeholder="음식 이름 검색"
                    placeholderTextColor={D.gray300}
                    style={styles.searchInput}
                    autoFocus
                  />
                </View>
                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  {searchResults.map((f, i) => (
                    <Pressable key={`${f.name}-${i}`} onPress={() => pickFood(f)} style={styles.searchItem}>
                      <View style={styles.flex1}>
                        <Txt variant="body" weight="600">
                          {f.name}
                        </Txt>
                        <Txt variant="caption" color={D.gray500}>
                          100g 기준 · 탄 {f.carb}g · 단 {f.protein}g · 지 {f.fat}g
                          {f.servingSize ? ` · 1회 ${f.servingSize}` : ''}
                        </Txt>
                      </View>
                      <Txt variant="body" weight="600" color={D.primary}>
                        {f.kcal} kcal
                      </Txt>
                    </Pressable>
                  ))}
                  {search.isFetching && (
                    <View style={styles.searchEmpty}>
                      <ActivityIndicator color={D.primary} />
                    </View>
                  )}
                  {!search.isFetching && search.isError && (
                    <Txt variant="caption" color={D.error} style={styles.searchEmpty}>
                      검색 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.
                    </Txt>
                  )}
                  {!search.isFetching &&
                    !search.isError &&
                    debouncedQuery.length >= 2 &&
                    searchResults.length === 0 && (
                      <Txt variant="caption" color={D.gray500} style={styles.searchEmpty}>
                        검색 결과가 없어요.
                      </Txt>
                    )}
                  {debouncedQuery.length < 2 && (
                    <Txt variant="caption" color={D.gray500} style={styles.searchEmpty}>
                      음식 이름을 2자 이상 입력하면 검색해요.
                    </Txt>
                  )}
                </ScrollView>
              </View>
            )}
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// 공통 매크로 박스 — 테두리(배경 없음) + 컬러 점 + 라벨 + 내용. 리뷰/기록완료 화면 공용.
function MacroBox({
  mkey,
  label,
  children,
}: {
  mkey: 'protein' | 'carb' | 'fat';
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.macroCol}>
      <View style={styles.resultMacroHead}>
        <View style={[styles.resultDot, { backgroundColor: MACRO_DOT[mkey] }]} />
        <Txt variant="label" color={D.gray500}>
          {label}
        </Txt>
      </View>
      {children}
    </View>
  );
}

// ── 저장 후 결과 화면 ────────────────────────────────────────
// 운동 효과 점수 상승(끼니별 누적 라인 그래프) + 이번 식사 기여 + AI 코치 피드백.

// 점수 추이 라인 그래프 — 컨테이너 폭을 측정해 픽셀 좌표로 그린다(왜곡 없음).
function ScoreGraph({ points }: { points: { label: string; score: number }[] }) {
  const [w, setW] = useState(0);
  const H = 96;
  const PAD = 8;
  const n = points.length;
  const x = (i: number) => (n > 1 ? PAD + (i / (n - 1)) * (w - 2 * PAD) : w / 2);
  const y = (s: number) => H - PAD - (Math.min(Math.max(s, 0), 100) / 100) * (H - 2 * PAD);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.score).toFixed(1)}`).join(' ');
  const area = w > 0 ? `${line} L ${x(n - 1).toFixed(1)} ${H} L ${x(0).toFixed(1)} ${H} Z` : '';
  const last = points[n - 1];
  return (
    <View style={styles.graphWrap}>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: H }}>
        {w > 0 && (
          <Svg width={w} height={H}>
            <Defs>
              <LinearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={D.primary} stopOpacity={0.18} />
                <Stop offset="1" stopColor={D.primary} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {[0, 0.5, 1].map((g) => {
              const gy = PAD + g * (H - 2 * PAD);
              return <Line key={g} x1={0} y1={gy} x2={w} y2={gy} stroke={D.line} strokeWidth={1} />;
            })}
            <Path d={area} fill="url(#scoreFill)" />
            <Path d={line} stroke={D.primary} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            <Circle cx={x(n - 1)} cy={y(last.score)} r={4.5} fill={D.primary} stroke="#FFFFFF" strokeWidth={2} />
          </Svg>
        )}
      </View>
      <View style={styles.graphLabels}>
        {points.map((p, i) => (
          <Txt key={p.label} variant="label" color={i === n - 1 ? D.gray900 : D.gray500}>
            {p.label}
          </Txt>
        ))}
      </View>
    </View>
  );
}

function ResultMacro({
  mkey,
  label,
  contrib,
  total,
  goal,
}: {
  mkey: 'protein' | 'carb' | 'fat';
  label: string;
  contrib: number;
  total: number;
  goal: number;
}) {
  return (
    <MacroBox mkey={mkey} label={label}>
      <Txt variant="h2" weight="700" color={D.gray900}>
        +{contrib}g
      </Txt>
      <Txt variant="label" color={D.gray500}>
        {total} / {goal}g
      </Txt>
      <View style={styles.macroBar}>
        <ProgressBar ratio={goal > 0 ? total / goal : 0} color={MACRO_DOT[mkey]} />
      </View>
    </MacroBox>
  );
}

function ResultView({
  draft,
  target,
  base,
  dayMeals,
  context,
  feedback,
  onContinue,
  onDone,
}: {
  draft: Omit<Meal, 'id' | 'time'>;
  target: MacroTotals;
  base: MacroTotals | null;
  dayMeals: Meal[];
  context?: string;
  feedback: ReturnType<typeof useMealFeedback>;
  onContinue: () => void;
  onDone: () => void;
}) {
  const b = base ?? { kcal: 0, carb: 0, protein: 0, fat: 0 };
  // 운동 효과 점수 = 메인 게이지와 동일(섭취÷(목표+운동소모)×100). 저장 전/후 비교.
  const energyTarget = target.kcal + BURNED_KCAL;
  const scoreOf = (kcal: number) => Math.max(0, Math.round((energyTarget > 0 ? kcal / energyTarget : 0) * 100));
  const after = scoreOf(b.kcal + draft.kcal);
  const delta = after - scoreOf(b.kcal);

  // 끼니별 누적 점수 추이 — 아침→점심→저녁 누적, 마지막은 '현재'(= after).
  const kcalOf = (t: MealType) => dayMeals.filter((m) => m.mealType === t).reduce((s, m) => s + m.kcal, 0);
  let cum = 0;
  const graphPoints: { label: string; score: number }[] = (['아침', '점심', '저녁'] as MealType[]).map((t) => {
    cum += kcalOf(t);
    return { label: t as string, score: scoreOf(cum) };
  });
  graphPoints.push({ label: '현재', score: after });

  // 코치 코멘트 — 실제 응답 있으면 요약 분리, 없으면 폴백(요약+상세)
  const coach = feedback.data ? splitCoach(feedback.data) : coachFallback(draft, context);
  const [memo, setMemo] = useState('');

  // 다음 식사 가이드 — 남은 영양소 기준 2개 카드
  const totalAfter = {
    kcal: b.kcal + draft.kcal,
    protein: b.protein + draft.protein,
    carb: b.carb + draft.carb,
  };
  const remKcal = Math.max(0, target.kcal - totalAfter.kcal);
  const remProtein = Math.max(0, target.protein - totalAfter.protein);
  const remCarb = Math.max(0, target.carb - totalAfter.carb);
  type GuideItem = { icon: IconName; title: string; desc: string };
  const guideItems: GuideItem[] = [];
  if (remProtein >= 15)
    guideItems.push({ icon: 'fitness-center', title: '단백질 보충', desc: `단백질 ${remProtein}g 남았어요. 닭가슴살·계란·그릭요거트로 채워보세요.` });
  if (remCarb >= 25)
    guideItems.push({ icon: 'bolt', title: '탄수화물 보충', desc: `탄수화물 ${remCarb}g 남았어요. 고구마·현미밥·바나나로 에너지를 보충해요.` });
  if (guideItems.length < 2 && remKcal >= 200)
    guideItems.unshift({ icon: 'local-fire-department', title: '든든한 식사', desc: `칼로리 여유 ${remKcal}kcal. 한 끼 더 드셔도 괜찮아요.` });
  if (guideItems.length < 2)
    guideItems.push(remKcal < 50
      ? { icon: 'check', title: '오늘 목표 달성', desc: '오늘 식단 목표에 거의 도달했어요. 잘하셨어요!' }
      : { icon: 'egg', title: '가벼운 간식', desc: '두유·견과류 같은 건강한 간식으로 마무리해요.' });
  const displayGuide = guideItems.slice(0, 2);

  return (
    <View style={styles.flex1}>
      <ScrollView contentContainerStyle={styles.reviewBody} showsVerticalScrollIndicator={false}>
        {/* 운동 효과 점수 + 이번 식사 기여 (통합 카드) */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreHero}>
            <View style={styles.scoreHeadRow}>
              <Txt variant="label" color={D.gray500}>
                운동 효과 점수
              </Txt>
              <Icon name="info-outline" size={14} color={D.gray300} />
            </View>
            <View style={styles.scoreRow}>
              <Txt variant="display" color={D.gray900}>
                {after}
              </Txt>
              <Txt variant="h2" color={D.gray500}>
                점
              </Txt>
              {delta !== 0 && (
                <View style={styles.scoreDelta}>
                  <Icon
                    name={delta > 0 ? 'arrow-upward' : 'arrow-downward'}
                    size={13}
                    color={delta > 0 ? D.success : D.gray500}
                  />
                  <Txt variant="caption" weight="700" color={delta > 0 ? D.success : D.gray500}>
                    {delta > 0 ? '+' : ''}
                    {delta}점
                  </Txt>
                </View>
              )}
            </View>
            <Txt variant="caption" color={D.gray500}>
              {delta > 0
                ? `${draft.name} 기록으로 운동 효과 점수가 올랐어요.`
                : `${draft.name} · ${draft.kcal}kcal 기록됐어요.`}
            </Txt>
          </View>
          <ScoreGraph points={graphPoints} />

          {/* 구분선 */}
          <View style={styles.sectionDivider} />

          {/* 칼로리 기여 (full-width) */}
          <View style={styles.kcalContrib}>
            <View style={styles.resultMacroHead}>
              <View style={[styles.resultDot, { backgroundColor: D.primary }]} />
              <Txt variant="label" color={D.gray500}>칼로리</Txt>
            </View>
            <Txt variant="h2" weight="700" color={D.gray900}>+{draft.kcal}kcal</Txt>
            <Txt variant="label" color={D.gray500}>{totalAfter.kcal} / {target.kcal}kcal</Txt>
            <View style={styles.macroBar}>
              <ProgressBar ratio={target.kcal > 0 ? totalAfter.kcal / target.kcal : 0} color={D.primary} />
            </View>
          </View>

          {/* 매크로 3열 */}
          <View style={styles.macroRow}>
            {MACRO_META.map((m) => (
              <ResultMacro
                key={m.key}
                mkey={m.key}
                label={m.label}
                contrib={draft[m.key]}
                total={b[m.key] + draft[m.key]}
                goal={target[m.key]}
              />
            ))}
          </View>
        </View>

        {/* 다음 식사 가이드 */}
        <View style={styles.nextMealSection}>
          <Txt variant="body" weight="700" color={D.gray900}>
            다음 식사 추천
          </Txt>
          <View style={styles.nextMealRow}>
            {displayGuide.map((item) => (
              <View key={item.title} style={styles.nextMealCard}>
                <View style={styles.nextMealIcon}>
                  <Icon name={item.icon} size={28} color={D.primary} />
                </View>
                <Txt variant="body" weight="700" color={D.gray900} style={{ textAlign: 'center' }}>
                  {item.title}
                </Txt>
                <Txt variant="caption" color={D.gray500} style={{ textAlign: 'center' }}>
                  {item.desc}
                </Txt>
              </View>
            ))}
          </View>
        </View>

        {/* AI 코치 피드백 (얼굴 없음) — 한 줄 요약 제목 + 상세 */}
        <View style={styles.coachCard}>
          <View style={styles.coachHead}>
            <View style={styles.coachAvatar}>
              <Icon name="fitness-center" size={15} color={D.primary} />
            </View>
            <Txt variant="caption" weight="700" color={D.primary}>
              AI 코치 피드백
            </Txt>
            {context && (
              <View style={styles.coachTag}>
                <Txt variant="label" weight="600" color={D.gray700}>
                  {context} 기준
                </Txt>
              </View>
            )}
          </View>
          {feedback.isPending ? (
            <View style={styles.coachLoading}>
              <ActivityIndicator color={D.primary} size="small" />
              <Txt variant="caption" color={D.gray500}>
                코멘트를 준비하고 있어요…
              </Txt>
            </View>
          ) : (
            <>
              <Txt variant="body" weight="700" color={D.gray900}>
                {coach.title}
              </Txt>
              {coach.body ? (
                <Txt variant="caption" color={D.gray700}>
                  {coach.body}
                </Txt>
              ) : null}
            </>
          )}
        </View>

        {/* 메모 남기기 */}
        <View style={styles.memoSection}>
          <Txt variant="label" weight="600" color={D.gray500}>
            메모 남기기
          </Txt>
          <View style={styles.memoBox}>
            <TextInput
              value={memo}
              onChangeText={(t) => setMemo(t.slice(0, 1000))}
              placeholder="식사 시간, 식사 순서 등을 메모해보세요."
              placeholderTextColor={D.gray300}
              style={styles.memoInput}
              multiline
              maxLength={1000}
            />
            <Txt variant="label" color={D.gray500} style={styles.memoCounter}>
              {memo.length}/1,000자
            </Txt>
          </View>
        </View>
      </ScrollView>

      {/* 하단 고정 버튼 */}
      <View style={styles.resultBtns}>
        <Pressable onPress={onContinue} style={styles.resultSecondaryBtn}>
          <Txt variant="body" weight="600" color={D.gray700}>
            기록 계속하기
          </Txt>
        </Pressable>
        <Pressable
          onPress={onDone}
          style={({ pressed }) => [
            styles.resultPrimaryBtn,
            { backgroundColor: pressed ? D.primaryPressed : D.primary },
          ]}>
          <Txt variant="body" weight="600" color="#FFFFFF">
            완료
          </Txt>
        </Pressable>
      </View>
    </View>
  );
}

// ── 끼니 상세/수정 모달 ─────────────────────────────────────
// 기록된 끼니를 탭하면 그 끼니의 음식 목록 → 항목 탭 시 값(이름·칼로리·탄단지) 수정/삭제.
const onlyDigits = (s: string) => s.replace(/[^0-9]/g, '');
const toInt = (s: string) => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
};

type EditForm = { name: string; kcal: string; carb: string; protein: string; fat: string };

function SlotDetailModal({
  visible,
  mealType,
  meals,
  date,
  onClose,
  onAddMore,
}: {
  visible: boolean;
  mealType: MealType | null;
  meals: Meal[];
  date: string;
  onClose: () => void;
  onAddMore: (t: MealType) => void;
}) {
  const items = mealType ? meals.filter((m) => m.mealType === mealType) : [];
  const updateMeal = useUpdateMeal(date);
  const deleteMeal = useDeleteMeal(date);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm>({ name: '', kcal: '', carb: '', protein: '', fat: '' });
  const editing = items.find((m) => m.id === editingId) ?? null;

  function startEdit(m: Meal) {
    setForm({
      name: m.name,
      kcal: String(m.kcal),
      carb: String(m.carb),
      protein: String(m.protein),
      fat: String(m.fat),
    });
    setEditingId(m.id);
  }

  function close() {
    setEditingId(null);
    onClose();
  }

  async function save() {
    if (!editing || !mealType) return;
    await updateMeal.mutateAsync({
      id: editing.id,
      mealType,
      name: form.name.trim() || editing.name,
      kcal: toInt(form.kcal),
      carb: toInt(form.carb),
      protein: toInt(form.protein),
      fat: toInt(form.fat),
    });
    setEditingId(null);
  }

  async function remove() {
    if (!editing) return;
    await deleteMeal.mutateAsync(editing.id);
    setEditingId(null);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.recScreen} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.recHeader}>
          <Pressable
            onPress={() => (editing ? setEditingId(null) : close())}
            hitSlop={8}
            style={styles.recHeaderBtn}>
            <Icon name={editing ? 'arrow-back' : 'close'} size={24} color={D.gray900} />
          </Pressable>
          <Txt variant="h2">{editing ? '기록 수정' : `${mealType ?? ''} 기록`}</Txt>
          <View style={styles.recHeaderBtn} />
        </View>

        {editing ? (
          <ScrollView contentContainerStyle={styles.reviewBody} showsVerticalScrollIndicator={false}>
            <View style={styles.editCol}>
              <Txt variant="label" color={D.gray500}>
                음식
              </Txt>
              <TextInput
                value={form.name}
                onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
                placeholder="음식 이름"
                placeholderTextColor={D.gray300}
                style={styles.editInput}
              />
            </View>
            <View style={styles.editCol}>
              <Txt variant="label" color={D.gray500}>
                칼로리 (kcal)
              </Txt>
              <TextInput
                value={form.kcal}
                onChangeText={(t) => setForm((f) => ({ ...f, kcal: onlyDigits(t) }))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={D.gray300}
                style={styles.editInput}
              />
            </View>
            <View style={styles.editRow}>
              {(['carb', 'protein', 'fat'] as const).map((k) => (
                <View key={k} style={[styles.editCol, styles.flex1]}>
                  <Txt variant="label" color={D.gray500}>
                    {k === 'carb' ? '탄수화물(g)' : k === 'protein' ? '단백질(g)' : '지방(g)'}
                  </Txt>
                  <TextInput
                    value={form[k]}
                    onChangeText={(t) => setForm((f) => ({ ...f, [k]: onlyDigits(t) }))}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={D.gray300}
                    style={styles.editInput}
                  />
                </View>
              ))}
            </View>

            <PrimaryButton label="저장하기" onPress={save} disabled={updateMeal.isPending} />
            <Pressable onPress={remove} disabled={deleteMeal.isPending} style={styles.deleteBtn} hitSlop={8}>
              <Icon name="delete-outline" size={18} color={D.error} />
              <Txt variant="caption" weight="600" color={D.error}>
                이 기록 삭제
              </Txt>
            </Pressable>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.slotDetailBody} showsVerticalScrollIndicator={false}>
            {items.map((m) => (
              <Pressable key={m.id} onPress={() => startEdit(m)} style={styles.slotEditRow}>
                <View style={styles.flex1}>
                  <Txt variant="body" weight="600">
                    {m.name}
                  </Txt>
                  <Txt variant="caption" color={D.gray500}>
                    {m.time} · 탄 {m.carb} · 단 {m.protein} · 지 {m.fat}
                  </Txt>
                </View>
                <Txt variant="body" weight="600" color={D.primary}>
                  {m.kcal} kcal
                </Txt>
                <Icon name="chevron-right" size={20} color={D.gray300} />
              </Pressable>
            ))}
            {mealType && (
              <Pressable onPress={() => onAddMore(mealType)} style={styles.addMoreBtn}>
                <Icon name="add" size={20} color={D.primary} />
                <Txt variant="body" weight="600" color={D.primary}>
                  이 끼니에 추가
                </Txt>
              </Pressable>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ── 날짜 스트립 (가로 스와이프) ─────────────────────────────
const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];

function isoOf(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const DATE_ITEM_W = 76;
function DateStrip({
  selected,
  onSelect,
  onOpenCalendar,
}: {
  selected: string;
  onSelect: (iso: string) => void;
  onOpenCalendar: () => void;
}) {
  // 오늘 기준 앞뒤 7일 (총 15일)
  const days = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return Array.from({ length: 15 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + (i - 7));
      return { iso: isoOf(d), month: d.getMonth() + 1, day: d.getDate(), dow: DOW_KO[d.getDay()] };
    });
  }, []);
  const ref = useRef<ScrollView>(null);
  const selIndex = days.findIndex((d) => d.iso === selected);

  // 선택 날짜가 가운데 오도록 초기 스크롤
  function centerSelected(width: number) {
    const x = Math.max(0, selIndex * DATE_ITEM_W - (width / 2 - DATE_ITEM_W / 2));
    ref.current?.scrollTo({ x, animated: false });
  }

  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={(e) => centerSelected(e.nativeEvent.layout.width)}
      style={styles.dateStrip}
      contentContainerStyle={styles.dateStripContent}>
      {days.map((d) => {
        const isSel = d.iso === selected;
        const color = isSel ? D.gray900 : D.gray500;
        return (
          <Pressable
            key={d.iso}
            onPress={() => (isSel ? onOpenCalendar() : onSelect(d.iso))}
            style={styles.dateItem}>
            <Txt variant="caption" weight={isSel ? '700' : '500'} color={color}>
              {d.month}.{d.day} {d.dow}
            </Txt>
            {isSel && <Icon name="keyboard-arrow-down" size={16} color={color} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// 전체 달력 팝업 (월 단위)
function CalendarModal({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: string;
  onSelect: (iso: string) => void;
  onClose: () => void;
}) {
  const init = parseIso(selected);
  const [view, setView] = useState({ y: init.getFullYear(), m: init.getMonth() });
  const todayIso = isoOf(new Date());

  const startDow = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const prev = () => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }));
  const next = () => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.calBackdrop} onPress={onClose}>
        <Pressable style={styles.calCard} onPress={() => {}}>
          <View style={styles.calHeader}>
            <Pressable onPress={prev} hitSlop={8} style={styles.calNav}>
              <Icon name="chevron-left" size={24} color={D.gray700} />
            </Pressable>
            <Txt variant="h2">
              {view.y}년 {view.m + 1}월
            </Txt>
            <Pressable onPress={next} hitSlop={8} style={styles.calNav}>
              <Icon name="chevron-right" size={24} color={D.gray700} />
            </Pressable>
          </View>
          <View style={styles.calWeekRow}>
            {DOW_KO.map((w) => (
              <Txt key={w} variant="label" color={D.gray500} style={styles.calWeekCell}>
                {w}
              </Txt>
            ))}
          </View>
          <View style={styles.calGrid}>
            {cells.map((d, i) => {
              if (d === null) return <View key={i} style={styles.calCell} />;
              const iso = isoOf(new Date(view.y, view.m, d));
              const isSel = iso === selected;
              const isToday = iso === todayIso;
              return (
                <Pressable
                  key={i}
                  style={styles.calCell}
                  onPress={() => {
                    onSelect(iso);
                    onClose();
                  }}>
                  <View style={[styles.calDay, isSel && { backgroundColor: D.primary }]}>
                    <Txt
                      variant="caption"
                      weight={isSel || isToday ? '700' : '400'}
                      color={isSel ? '#FFFFFF' : isToday ? D.primary : D.gray900}>
                      {d}
                    </Txt>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── 화면 ────────────────────────────────────────────────────
export default function DietScreen() {
  const [selectedDate, setSelectedDate] = useState(() => isoOf(new Date()));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { data: meals = [], isLoading, isError, refetch } = useMeals(selectedDate);
  const addMeal = useAddMeal(selectedDate);
  const addAnalyze = useAnalyzeMeal(); // 추천 음식 추가 시 영양값 계산용
  const [addingName, setAddingName] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMealType, setModalMealType] = useState<MealType | undefined>(undefined);
  const [detailType, setDetailType] = useState<MealType | null>(null); // 기록된 끼니 상세/수정 모달

  // 기록 모달 열기 — 끼니 슬롯에서 열면 그 끼니로 초기 선택
  function openRecord(type?: MealType) {
    setModalMealType(type);
    setModalOpen(true);
  }

  // 끼니 슬롯 탭 — 기록 있으면 상세/수정, 없으면 새로 기록
  function handleSlotPress(type: MealType) {
    if (meals.some((m) => m.mealType === type)) setDetailType(type);
    else openRecord(type);
  }

  // 추천 음식 칩의 + → analyze로 영양값 계산 후 다음 끼니로 바로 기록
  async function addRecommendedFood(name: string, amount: number, unit: string) {
    if (addingName) return;
    setAddingName(name);
    try {
      const recordedTypes = new Set(meals.map((m) => m.mealType));
      const mealType = MEAL_TYPES.find((t) => !recordedTypes.has(t)) ?? '간식';
      const r = await addAnalyze.mutateAsync({ text: `${name} ${amount}${unit}` });
      addMeal.mutate({ mealType, name: r.name, kcal: r.kcal, carb: r.carb, protein: r.protein, fat: r.fat, inputMethod: 'manual' });
    } catch {
      // 실패 시 조용히 무시 (다시 누르면 재시도)
    } finally {
      setAddingName(null);
    }
  }


  // 가이드 목표 — 회원 신체정보(profiles) 기반. 단백질=체중×1.5g, 칼로리=TDEE×목표보정.
  const { data: profile } = useProfile();
  const guide = useMemo(() => {
    const kcal = profile
      ? calorieTargetFromProfile(
          {
            age: profile.age,
            gender: profile.gender,
            height: profile.height,
            weight: profile.weight,
            exerciseLevel: profile.exercise_level,
          },
          MOCK_CONTEXT.goal,
        )
      : null;
    const protein = profile ? proteinTargetFromProfile(profile.weight) : null;
    return generateGuide(MOCK_CONTEXT, { kcal, protein });
  }, [profile]);

  const totals = useMemo(
    () =>
      meals.reduce(
        (a, m) => ({ kcal: a.kcal + m.kcal, carb: a.carb + m.carb, protein: a.protein + m.protein, fat: a.fat + m.fat }),
        { kcal: 0, carb: 0, protein: 0, fat: 0 },
      ),
    [meals],
  );

  const hasLog = meals.length > 0;
  const target = guide.target;

  const calorieGoal = target.kcal;
  const remaining = calorieGoal - totals.kcal;
  const over = remaining < 0;
  // 운동 대비 섭취 게이지 — 섭취 ÷ (목표 + 운동소모). 활동 후(목표+소모)가 100%.
  const energyTarget = calorieGoal + BURNED_KCAL;
  const intakeRatio = energyTarget > 0 ? totals.kcal / energyTarget : 0;
  const energyStatus = balanceStatus(intakeRatio);

  // 헤더 한 줄 코멘트 — 운동 상태(운동 대비 섭취) + 식단 상태(매크로 균형)에 따라 변동
  const partLabel = MOCK_CONTEXT.part ? PART_LABEL[MOCK_CONTEXT.part] : null;
  const stateHint = ((): string => {
    if (!hasLog) return partLabel ? `${partLabel} 후 식단을 기록해보세요.` : '식단을 기록해보세요.';
    // 1순위: 운동량 대비 섭취 상태
    if (intakeRatio < 0.9) return '운동량 대비 덜 먹었어요.';
    if (intakeRatio > 1.05) return '운동량 대비 많이 먹었어요.';
    // 적정 범위 → 매크로 균형으로 코멘트
    const rp = totals.protein / target.protein;
    const rc = totals.carb / target.carb;
    const rf = totals.fat / target.fat;
    if (rp >= 1) return '단백질까지 잘 챙겼어요!';
    if (rp >= rc && rp >= rf) return '단백질 위주로 잘 챙겼어요!';
    if (rc >= rf) return '탄수화물이 조금 높아요.';
    return '지방이 조금 높아요.';
  })();

  // 부족 영양소 (목표 - 섭취) — 결손 큰 상위 2개를 함께 고려해 균형 추천
  const deficits = [
    { key: 'protein' as const, label: '단백질', g: Math.max(0, target.protein - totals.protein) },
    { key: 'carb' as const, label: '탄수화물', g: Math.max(0, target.carb - totals.carb) },
    { key: 'fat' as const, label: '지방', g: Math.max(0, target.fat - totals.fat) },
  ];
  const topKeys = new Set(
    deficits
      .filter((d) => d.g > 0)
      .sort((a, b) => b.g - a.g)
      .slice(0, 2)
      .map((d) => d.key),
  );
  const deficitLines = deficits.filter((d) => topKeys.has(d.key)); // 매크로 순서(단·탄·지) 유지
  // 하루 3끼 기준 한 끼 분량(1/3)으로 추천
  const nextMealG = (g: number) => Math.max(1, Math.round(g / 3));

  // 부족 영양소(한 끼 분량) 기반 Claude 음식 조합 추천 — 운동 회복 맥락 포함
  const recContext = MOCK_CONTEXT.part ? `${PART_LABEL[MOCK_CONTEXT.part]} 운동 회복` : undefined;
  const recDeficits = deficitLines.map((d) => ({ label: d.label, g: nextMealG(d.g) }));
  const recommend = useRecommend(recDeficits, recContext);

  function handleSave(meal: Omit<Meal, 'id' | 'time'>, eatenAt: Date) {
    addMeal.mutate({ ...meal, eatenAt });
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <DateStrip
          selected={selectedDate}
          onSelect={setSelectedDate}
          onOpenCalendar={() => setCalendarOpen(true)}
        />
        <View style={styles.scrollWrap}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* 오늘 운동 요약 — 운동 완료 시: 유형/시간/소모칼로리 / 운동 전·계획 없음: 걸음수 */}
          <View style={styles.workoutBar}>
            {HAS_WORKOUT ? (
              <>
                <View style={styles.workoutLead}>
                  <Icon name="fitness-center" size={13} color={D.gray500} />
                  <Txt variant="label" weight="600" color={D.gray500}>
                    오늘 운동
                  </Txt>
                </View>
                <View style={styles.workoutDivider} />
                <View style={styles.workoutCell}>
                  <Txt variant="label" color={D.gray500}>
                    {MOCK_CONTEXT.part ? PART_LABEL[MOCK_CONTEXT.part] : '운동'}
                  </Txt>
                </View>
                <View style={styles.workoutDivider} />
                <View style={styles.workoutCell}>
                  <Txt variant="label" color={D.gray500}>
                    {WORKOUT_MIN}분
                  </Txt>
                </View>
                <View style={styles.workoutDivider} />
                <View style={styles.workoutCell}>
                  <Txt variant="label" color={D.gray500}>
                    {BURNED_KCAL}kcal
                  </Txt>
                </View>
              </>
            ) : (
              <>
                <View style={styles.workoutLead}>
                  <Icon name="footprints" size={13} color={D.gray500} />
                  <Txt variant="label" weight="600" color={D.gray500}>
                    오늘 걸음수
                  </Txt>
                </View>
                <View style={styles.workoutDivider} />
                <View style={styles.workoutCell}>
                  <Txt variant="label" color={D.gray500}>
                    {STEP_COUNT.toLocaleString()} 걸음
                  </Txt>
                </View>
                <View style={styles.workoutDivider} />
                <View style={styles.workoutCell}>
                  <Txt variant="label" color={D.gray500}>
                    {STEP_KCAL}kcal
                  </Txt>
                </View>
              </>
            )}
          </View>
          {/* ① 운동 맞춤 식단 가이드 — 운동 대비 섭취 상태 게이지 + 목표 매크로 */}
          <Card style={styles.guideCard}>
            {/* 운동 대비 섭취 상태 게이지 + '오늘의 식단' 타이틀 (상단 중앙) */}
            <View style={styles.guideHead}>
              <SemiGauge ratio={intakeRatio} status={energyStatus} active={hasLog} />
              <View style={styles.guideTitleWrap}>
                <Txt variant="body" color={D.gray500}>
                  {stateHint}
                </Txt>
              </View>
            </View>

            {/* 목표 매크로 (단 → 탄 → 지) */}
            <View style={styles.macroRow}>
              {MACRO_META.map((m) => (
                <MacroProgress key={m.key} label={m.label} value={totals[m.key]} goal={target[m.key]} />
              ))}
            </View>
          </Card>

          {/* ② 기록 전: 오늘의 식단 가이드 / 기록 후: 부족 영양소 기반 AI 식단 추천 */}
          <Card style={styles.aiRecCard}>
            {!hasLog ? (
              // 상태 1 — 목표 제시 + 기록 유도
              <>
                <Txt variant="body" weight="600">
                  오늘의 식단 가이드
                </Txt>
                <Txt variant="caption" color={D.gray500}>
                  오늘 운동 기준 목표예요.
                </Txt>
                <Txt variant="caption" color={D.gray700}>
                  단백질 {target.protein}g · 탄수화물 {target.carb}g · 지방 {target.fat}g
                </Txt>
                <Txt variant="caption" color={D.gray500}>
                  첫 식사를 기록하면 부족한 영양소를 분석해드려요.
                </Txt>
              </>
            ) : deficitLines.length > 0 ? (
              // 상태 2 — 부족 영양소(상위 2개) 분석 + 균형 잡힌 추천
              <>
                <View style={styles.aiHead}>
                  <Icon name="auto-awesome" size={16} color={D.primary} />
                  <Txt variant="label" weight="600" color={D.primary}>
                    다음 식단 추천
                  </Txt>
                </View>
                <View style={styles.deficitList}>
                  {deficitLines.map((d) => (
                    <View key={d.key} style={styles.deficitRow}>
                      <Icon name={MACRO_ICON[d.key].icon} size={16} color={D.gray500} />
                      <Txt variant="caption" color={D.gray700}>
                        {d.label}
                      </Txt>
                      <Txt variant="caption" weight="700">
                        {nextMealG(d.g)}g
                      </Txt>
                    </View>
                  ))}
                </View>
                {recommend.isPending ? (
                  <View style={styles.recLoading}>
                    <ActivityIndicator color={D.primary} size="small" />
                    <Txt variant="caption" color={D.gray500}>
                      추천을 만드는 중…
                    </Txt>
                  </View>
                ) : recommend.isError ? (
                  <Txt variant="caption" color={D.gray500}>
                    추천을 불러오지 못했어요.
                  </Txt>
                ) : (recommend.data ?? []).length === 0 ? (
                  <Txt variant="caption" color={D.gray500}>
                    추천할 음식이 없어요.
                  </Txt>
                ) : (
                  <View style={styles.foodChipWrap}>
                    {(recommend.data ?? []).slice(0, 5).map((f, i) => (
                      <Pressable
                        key={`${f.name}-${i}`}
                        onPress={() => addRecommendedFood(f.name, f.amount, f.unit)}
                        disabled={addingName !== null}
                        style={styles.foodChip}>
                        <Txt variant="label" weight="600" color={D.gray700}>
                          {f.name}
                        </Txt>
                        <Txt variant="label" color={D.gray500}>
                          {' '}
                          {f.amount}
                          {f.unit}
                        </Txt>
                        {addingName === f.name ? (
                          <ActivityIndicator size="small" color={D.primary} style={styles.chipAdd} />
                        ) : (
                          <Icon name="add" size={15} color={D.gray500} style={styles.chipAdd} />
                        )}
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            ) : (
              // 모든 목표 달성
              <>
                <View style={styles.aiHead}>
                  <Icon name="auto-awesome" size={16} color={D.primary} />
                  <Txt variant="label" weight="600" color={D.primary}>
                    다음 식단 추천
                  </Txt>
                </View>
                <Txt variant="body" weight="600">
                  오늘 목표 영양소를 모두 채웠어요!
                </Txt>
              </>
            )}
          </Card>

          {/* ③+④ 오늘 기록 — 섭취 칼로리 + 끼니별 슬롯 통합 */}
          <View style={styles.listHeadRow}>
            <Txt variant="body" weight="700" color={D.gray900} style={{ fontSize: 18 }}>
              오늘 기록
            </Txt>
          </View>
          <Card style={{ gap: 0 }}>
            {/* 섭취 칼로리 요약 */}
            <View style={styles.kcalHead}>
              <View style={styles.flex1}>
                <Txt variant="body" color={D.gray500}>
                  {over
                    ? `${(-remaining).toLocaleString()}kcal 초과예요`
                    : `${remaining.toLocaleString()}kcal 더 먹어도 돼요`}
                </Txt>
                <View style={styles.kcalBig}>
                  <Txt variant="h1" weight="700">
                    {totals.kcal.toLocaleString()}
                  </Txt>
                  <Txt variant="body" color={D.gray500}>
                    {' '}
                    / {calorieGoal.toLocaleString()}kcal
                  </Txt>
                  <Icon name="info" size={16} color={D.gray300} style={styles.infoIcon} />
                </View>
              </View>
              <Pressable
                onPress={() => setModalOpen(true)}
                style={({ pressed }) => [
                  styles.addBtn,
                  { backgroundColor: pressed ? D.primaryPressed : D.primary },
                ]}>
                <Icon name="add" size={24} color="#FFFFFF" />
              </Pressable>
            </View>
            <CalorieBar consumed={totals.kcal} goal={calorieGoal} burned={BURNED_KCAL} />

            {/* 구분선 */}
            <View style={styles.sectionDivider} />

            {/* 끼니별 슬롯 */}
            {isLoading ? (
              <View style={styles.listState}>
                <ActivityIndicator color={D.primary} />
                <Txt variant="caption" color={D.gray500}>
                  기록을 불러오는 중…
                </Txt>
              </View>
            ) : isError ? (
              <View style={styles.listState}>
                <Txt variant="caption" color={D.gray500}>
                  기록을 불러오지 못했어요.
                </Txt>
                <Pressable onPress={() => refetch()} hitSlop={8}>
                  <Txt variant="caption" weight="600" color={D.primary}>
                    다시 시도
                  </Txt>
                </Pressable>
              </View>
            ) : (
              <View>
                {MEAL_TYPES.map((t) => (
                  <MealSlot key={t} type={t} meals={meals} onPress={handleSlotPress} />
                ))}
              </View>
            )}
          </Card>
        </ScrollView>
          <FadeTop />
        </View>

      </SafeAreaView>

      <RecordModal
        visible={modalOpen}
        initialMealType={modalMealType}
        target={target}
        totals={totals}
        dayMeals={meals}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
      <SlotDetailModal
        visible={detailType !== null}
        mealType={detailType}
        meals={meals}
        date={selectedDate}
        onClose={() => setDetailType(null)}
        onAddMore={(t) => {
          setDetailType(null);
          openRecord(t);
        }}
      />
      <CalendarModal
        visible={calendarOpen}
        selected={selectedDate}
        onSelect={setSelectedDate}
        onClose={() => setCalendarOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: D.bgBase },
  safeArea: { flex: 1, width: '100%', maxWidth: 800, alignSelf: 'center' },

  // 날짜 스트립 (하단 선 없음, 아래 영역과 24px 간격)
  dateStrip: { flexGrow: 0, backgroundColor: D.bgBase },
  dateStripContent: { paddingHorizontal: S.sm, alignItems: 'center' },

  // 오늘 운동 요약 (날짜 바로 아래, 아주 작게)
  workoutBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: D.muted,
    borderRadius: R.button,
    paddingVertical: 6,
  },
  workoutLead: { flexDirection: 'row', alignItems: 'center', gap: S.xs, paddingHorizontal: S.md },
  workoutCell: { flex: 1, alignItems: 'center' },
  workoutDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: D.lineStrong, marginVertical: 4 },

  // 스크롤 영역 + 상단 페이드
  scrollWrap: { flex: 1, position: 'relative' },
  fadeTop: { position: 'absolute', top: 0, left: 0, right: 0, height: S.md, zIndex: 2 },
  dateItem: {
    width: DATE_ITEM_W,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingVertical: S.sm,
  },

  // 달력 팝업
  calBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: S.lg,
  },
  calCard: { width: '100%', maxWidth: 360, backgroundColor: D.surface, borderRadius: R.modal, padding: S.lg, gap: S.md },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calNav: { padding: S.xs },
  calWeekRow: { flexDirection: 'row' },
  calWeekCell: { width: `${100 / 7}%`, textAlign: 'center' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center', paddingVertical: S.xs },
  calDay: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  // paddingTop = FadeTop 높이(S.md) → 첫 콘텐츠가 그라데이션 아래에서 시작(가림 방지)
  scroll: { paddingHorizontal: SIDE, paddingTop: S.md, paddingBottom: NAV_HEIGHT + S.xxl + S.md, gap: S.md },
  flex1: { flex: 1 },

  card: {
    backgroundColor: D.surface,
    borderRadius: R.card,
    borderWidth: 0.5,
    borderColor: D.line,
    padding: S.lg,
    gap: S.sm,
    ...LEVEL1,
  },

  // 가이드 헤더
  aiHead: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  guideCard: { padding: S.lg, gap: S.md },
  // 가이드 카드 ↔ 이 카드 사이 여백 8px (스크롤 gap 16 - 8)
  aiRecCard: { marginTop: -S.sm },
  // 가이드 카드 헤더 — 게이지 + '오늘의 식단' 타이틀을 상단 중앙 정렬 (여백 넉넉히)
  guideHead: { alignItems: 'center', gap: S.sm, paddingTop: S.sm, paddingBottom: 0 },
  // 타이틀 ↔ 코멘트는 바짝 붙임
  guideTitleWrap: { alignItems: 'center', gap: 2 },

  // 반원형 게이지
  gaugeWrap: { position: 'relative', alignItems: 'center', justifyContent: 'flex-end' },
  gaugeLabel: { position: 'absolute', bottom: 2, left: 0, right: 0, alignItems: 'center' },

  // 목표 매크로
  macroRow: { flexDirection: 'row', gap: S.sm, marginTop: S.md },
  // 각 매크로를 테두리만(배경 없음) 박스로
  macroCol: {
    flex: 1,
    gap: 2,
    borderWidth: 1,
    borderColor: D.line,
    borderRadius: R.small,
    paddingVertical: S.sm,
    paddingHorizontal: S.sm,
  },
  macroValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  macroBar: { marginTop: S.xs },

  // progress
  track: { height: 6, borderRadius: R.full, backgroundColor: D.gray100, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: R.full },

  sectionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: D.line, marginTop: S.lg },

  // 트레이너 AI 피드백 (리뷰 화면)
  coachCard: {
    backgroundColor: D.primaryLight,
    borderRadius: R.card,
    padding: S.md,
    gap: S.sm,
  },
  coachHead: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  coachAvatar: {
    width: 28,
    height: 28,
    borderRadius: R.full,
    backgroundColor: D.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachLoading: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.xs },
  coachTag: { backgroundColor: D.surface, borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: 2 },

  // 메모 남기기 (결과 화면)
  memoSection: { gap: S.xs },
  memoBox: { backgroundColor: D.muted, borderRadius: R.card, padding: S.md, minHeight: 110 },
  memoInput: { flex: 1, minHeight: 64, fontSize: 16, lineHeight: 24, color: D.gray900, textAlignVertical: 'top' },
  memoCounter: { alignSelf: 'flex-end', marginTop: S.xs },

  // 저장 후 결과 화면 — 운동 효과 점수 상승 (카드 + 그래프)
  scoreCard: {
    backgroundColor: D.surface,
    borderRadius: R.card,
    borderWidth: 0.5,
    borderColor: D.line,
    padding: S.md,
    gap: S.sm,
    ...LEVEL1,
  },
  scoreHero: { gap: 2 },
  scoreHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: S.xs },
  scoreDelta: { flexDirection: 'row', alignItems: 'center', gap: 1, marginLeft: S.xs },
  graphWrap: { gap: S.xs },
  graphLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  resultSection: { gap: 2 },
  kcalContrib: { gap: 2 },
  nextMealSection: { gap: S.sm },
  nextMealRow: { flexDirection: 'row', gap: S.sm },
  nextMealCard: {
    flex: 1,
    backgroundColor: D.muted,
    borderRadius: R.card,
    padding: S.md,
    gap: S.xs,
    alignItems: 'center',
  },
  nextMealIcon: {
    width: 56,
    height: 56,
    borderRadius: R.card,
    backgroundColor: D.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: S.xs,
  },
  resultMacroHead: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  resultDot: { width: 8, height: 8, borderRadius: 4 },
  resultBtns: {
    flexDirection: 'row',
    gap: S.sm,
    paddingHorizontal: SIDE,
    paddingTop: S.sm,
    paddingBottom: S.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: D.line,
  },
  resultSecondaryBtn: {
    flex: 1,
    height: 52,
    borderRadius: R.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: D.line,
    backgroundColor: D.surface,
  },
  resultPrimaryBtn: { flex: 1, height: 52, borderRadius: R.button, alignItems: 'center', justifyContent: 'center' },

  // 끼니 상세/수정 모달
  slotDetailBody: { paddingHorizontal: SIDE, paddingTop: S.sm, paddingBottom: S.xxl },
  slotEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    paddingVertical: S.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: D.line,
  },
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.xs,
    marginTop: S.md,
    paddingVertical: S.md,
    borderRadius: R.button,
    borderWidth: 1,
    borderColor: D.primary,
    backgroundColor: D.primaryLight,
  },
  editCol: { gap: S.xs },
  editRow: { flexDirection: 'row', gap: S.sm },
  editInput: {
    height: 48,
    borderRadius: R.button,
    backgroundColor: D.muted,
    paddingHorizontal: S.md,
    fontSize: 16,
    color: D.gray900,
  },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, paddingVertical: S.md, marginTop: S.xs },

  // 코칭 — 부족 영양소 + 추천 식품 칩
  deficitList: { flexDirection: 'row', flexWrap: 'wrap', gap: S.md },
  deficitRow: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  recLoading: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.xs },
  comboList: { gap: S.sm },
  comboChip: {
    paddingHorizontal: S.md,
    paddingVertical: S.sm,
    borderRadius: R.button,
    backgroundColor: D.muted,
  },
  foodChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, marginTop: S.xs },
  foodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: 12,
    paddingRight: S.sm,
    paddingVertical: S.xs,
    borderRadius: R.full,
    borderWidth: 1,
    borderColor: D.lineStrong,
    backgroundColor: 'transparent',
  },
  chipAdd: { marginLeft: 2 },

  // 칼로리
  kcalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: S.sm },
  kcalBig: { flexDirection: 'row', alignItems: 'flex-end', marginTop: S.xs },
  infoIcon: { marginLeft: S.xs, marginBottom: 3 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  // 칼로리 그라데이션 바
  calBarWrap: { position: 'relative', marginTop: S.sm },
  calTrack: { height: 12, borderRadius: R.full, backgroundColor: D.gray100, overflow: 'hidden' },
  calMarker: {
    position: 'absolute',
    top: -2,
    width: 0,
    height: 16,
    borderLeftWidth: 1,
    borderStyle: 'dashed',
    borderColor: D.gray300,
  },
  calLabels: { position: 'relative', height: 16, marginTop: S.xs },
  calLabelAnchor: { position: 'absolute' },
  // '활동 전'은 마커에서 왼쪽으로(우측정렬), '활동 후'는 오른쪽 끝 → 겹침 방지
  calLabelCentered: { width: 40, textAlign: 'right', marginLeft: -40, paddingRight: 4 },
  calLabelRight: { position: 'absolute', right: 0 },

  // list
  listHead: { marginTop: S.xs, marginLeft: S.xs, marginBottom: -S.sm },
  listHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: S.md,
    marginHorizontal: S.xs,
    marginBottom: -S.sm,
  },
  addMealBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  slotList: { gap: S.sm },
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    paddingVertical: S.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: D.line,
  },
  slotIcon: { width: 48, height: 48, borderRadius: R.card, backgroundColor: D.muted, alignItems: 'center', justifyContent: 'center' },
  slotRight: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  slotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#EAF8EF',
    borderRadius: R.full,
    paddingHorizontal: S.sm,
    paddingVertical: 3,
  },
  slotAddBtn: {
    width: 36,
    height: 36,
    borderRadius: R.full,
    backgroundColor: D.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 섹션 위 여백 32px (스크롤 gap 16 + marginTop 16)
  kcalTitle: { marginTop: S.md, marginLeft: S.xs, marginBottom: -S.sm },
  listCard: { paddingVertical: 0 },
  listState: { alignItems: 'center', justifyContent: 'center', gap: S.sm, paddingVertical: S.lg },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: D.line },
  mealRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: S.sm, paddingVertical: S.md },
  mealLeft: { flexDirection: 'row', alignItems: 'center', gap: S.sm, flex: 1 },
  mealRight: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  mealTag: { paddingHorizontal: S.sm, paddingVertical: 2, borderRadius: R.small, backgroundColor: D.gray100 },
  mealInfo: { flex: 1, gap: 2 },
  mealMacros: { paddingBottom: S.md, paddingLeft: S.xs },

  // FAB

  // 모달
  // 기록 모달 (전체 화면 + 탭)
  recScreen: { flex: 1, backgroundColor: D.bgBase, width: '100%', maxWidth: 800, alignSelf: 'center' },
  recHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIDE,
    paddingVertical: S.md,
  },
  recHeaderBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  recTabBar: {
    flexDirection: 'row',
    paddingHorizontal: SIDE,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: D.line,
  },
  recTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: S.sm,
    position: 'relative',
  },
  recTabIndicator: {
    position: 'absolute',
    bottom: -StyleSheet.hairlineWidth,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: D.primary,
  },
  photoArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.sm, paddingHorizontal: SIDE },
  photoBtn: {
    width: 96,
    height: 96,
    borderRadius: R.card,
    backgroundColor: D.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: S.sm,
  },
  photoBtnRow: { flexDirection: 'row', gap: S.sm, marginTop: S.md },
  photoAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: S.sm,
    paddingHorizontal: S.lg,
    borderRadius: R.button,
    borderWidth: 1,
    borderColor: D.primary,
    backgroundColor: D.primaryLight,
  },
  tabForm: { flex: 1, paddingHorizontal: SIDE, paddingTop: S.lg, gap: S.md },
  textArea: {
    minHeight: 120,
    borderRadius: R.card,
    backgroundColor: D.muted,
    padding: S.md,
    fontSize: 18,
    lineHeight: 26,
    color: D.gray900,
    textAlignVertical: 'top',
  },
  gramsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    paddingHorizontal: S.xs,
  },
  gramsInput: {
    width: 96,
    height: 44,
    borderRadius: R.button,
    backgroundColor: D.muted,
    paddingHorizontal: S.md,
    fontSize: 16,
    color: D.gray900,
    textAlign: 'right',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    height: 48,
    borderRadius: R.button,
    backgroundColor: D.muted,
    paddingHorizontal: S.md,
  },
  searchInput: { flex: 1, fontSize: 16, color: D.gray900 },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: S.sm,
    paddingVertical: S.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: D.line,
  },
  searchEmpty: { textAlign: 'center', paddingVertical: S.xl, alignItems: 'center' },

  analyzing: { alignItems: 'center', gap: S.sm, paddingVertical: S.xxl },

  // 리뷰 화면 — 여백 넉넉히
  reviewBody: { paddingHorizontal: SIDE, paddingTop: S.lg, paddingBottom: S.xxl, gap: S.lg },
  reviewCard: {
    backgroundColor: D.muted,
    borderRadius: R.card,
    paddingVertical: S.lg,
    paddingHorizontal: S.md,
    gap: S.md,
    alignItems: 'center',
  },
  center: { textAlign: 'center' },
  estimateRow: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  reviewKcal: { flexDirection: 'row', alignItems: 'baseline', gap: S.sm, marginTop: S.xs },
  reviewKcalNum: { fontSize: 44, lineHeight: 52 },
  // 리뷰 값 직접 편집
  reviewEditBtn: { position: 'absolute', top: S.md, right: S.md, flexDirection: 'row', alignItems: 'center', gap: 2, zIndex: 1 },
  reviewNameInput: {
    fontSize: 20,
    fontWeight: '700',
    color: D.gray900,
    textAlign: 'center',
    minWidth: 160,
    paddingVertical: S.xs,
    paddingHorizontal: S.sm,
    borderRadius: R.button,
    backgroundColor: D.surface,
  },
  reviewKcalInput: {
    fontSize: 32,
    fontWeight: '700',
    color: D.primary,
    textAlign: 'center',
    minWidth: 96,
    paddingVertical: S.xs,
    borderRadius: R.button,
    backgroundColor: D.surface,
  },
  reviewMacroInput: {
    fontSize: 16,
    fontWeight: '600',
    color: D.gray900,
    textAlign: 'center',
    minWidth: 56,
    paddingVertical: S.xs,
    borderRadius: R.small,
    backgroundColor: D.surface,
  },

  // 리뷰 화면 재설계 — 음식 카드
  reviewFoodCard: {
    backgroundColor: D.surface,
    borderRadius: R.card,
    borderWidth: 0.5,
    borderColor: D.line,
    padding: S.lg,
    gap: S.md,
    ...LEVEL1,
  },
  reviewFoodTop: { flexDirection: 'row', alignItems: 'flex-start', gap: S.md },
  reviewFoodImg: {
    width: 64,
    height: 64,
    borderRadius: R.small,
    backgroundColor: D.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  reviewFoodInfo: { flex: 1, gap: 4 },
  reviewFoodNameRow: { flexDirection: 'row', alignItems: 'center', gap: S.xs, flexWrap: 'wrap' },
  reviewAiBadge: {
    paddingHorizontal: S.xs,
    paddingVertical: 2,
    borderRadius: R.small,
    backgroundColor: D.primaryLight,
  },
  reviewEditBtnTop: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: S.xs },
  reviewStepperRow: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  reviewStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: D.line,
    borderRadius: R.button,
    overflow: 'hidden',
  },
  stepperBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepperNum: { minWidth: 36, textAlign: 'center' },
  stepperUnit: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.sm,
    paddingVertical: S.xs,
    borderWidth: 1,
    borderColor: D.line,
    borderRadius: R.button,
    gap: 2,
  },

  // 리뷰 화면 재설계 — 영양 카드
  reviewNutrCard: {
    backgroundColor: D.surface,
    borderRadius: R.card,
    borderWidth: 0.5,
    borderColor: D.line,
    padding: S.lg,
    gap: S.sm,
    ...LEVEL1,
  },
  reviewNutrKcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: S.xs, flexWrap: 'wrap' },
  dailyPctBadge: {
    marginLeft: S.xs,
    paddingHorizontal: S.sm,
    paddingVertical: 2,
    borderRadius: R.full,
    backgroundColor: D.primaryLight,
  },
  nutriDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    paddingTop: S.xs,
  },

  // 리뷰 화면 재설계 — AI 피드백 버블
  reviewFeedbackBubble: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: S.sm,
    backgroundColor: D.primaryLight,
    borderRadius: R.card,
    padding: S.md,
  },

  // 리뷰 화면 재설계 — 식사 시간 행
  mealTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    paddingVertical: S.md,
    paddingHorizontal: S.sm,
    borderWidth: 1,
    borderColor: D.line,
    borderRadius: R.button,
    backgroundColor: D.surface,
  },

  chipRow: { flexDirection: 'row', gap: S.sm },
  mealChip: { flex: 1, alignItems: 'center', paddingVertical: S.sm, borderRadius: R.full, borderWidth: 1 },

  primaryBtn: { height: 52, borderRadius: R.button, alignItems: 'center', justifyContent: 'center', marginTop: S.sm },

  timePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.md,
    paddingVertical: S.md,
    borderWidth: 1,
    borderColor: D.line,
    borderRadius: R.button,
    backgroundColor: D.surface,
  },
  timePickerGroup: { alignItems: 'center', gap: S.xs },
  timePickerArrow: { padding: S.xs },
  timePickerDone: {
    position: 'absolute',
    right: S.md,
    paddingVertical: S.xs,
    paddingHorizontal: S.sm,
    borderRadius: R.full,
    backgroundColor: D.primaryLight,
  },
});