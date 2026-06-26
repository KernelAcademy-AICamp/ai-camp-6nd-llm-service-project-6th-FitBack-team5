import DateTimePicker from '@react-native-community/datetimepicker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams } from 'expo-router';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Camera,
  Check,
  ChevronDown,
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
  Image,
  Modal,
  Platform,
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

const COACH_CHARACTER = require('../../assets/images/Chat.png') as number;

import { IconArrowChevron } from '@/components/icons';
import { Input } from '@/components/ui';

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

type IconProps = { size?: number; color?: string; strokeWidth?: number; style?: StyleProp<ViewStyle> };
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
  const C = ICONS[name] as any;
  return <C size={size} color={color} strokeWidth={1.5} style={style} />;
}

import { CoachTipCard } from '@/components/coach-tip-card';
import { GnbBar } from '@/components/gnb-bar';
import { sheetPresentation } from '@/components/modal-presentation';
import { BottomTabInset, Elevation, Palette, Radius, ScreenPadding, Spacing, Typography } from '@/constants/theme';
import { MyPanel } from '@/features/auth/MyPanel';
import { useProfile } from '@/features/auth/useProfile';
import { CoachChat } from '@/features/coach/CoachChat';
import { useAnalyzeImage, useAnalyzeMeal } from '@/features/diet/analyzeMeal';
import { useFoodSearch, type FoodSearchResult } from '@/features/diet/foodSearch';
import {
  PART_LABEL,
  calorieTargetFromProfile,
  generateGuide,
  proteinTargetFromProfile,
} from '@/features/diet/guide';
import { useMealFeedback } from '@/features/diet/mealFeedback';
import { pickFoodImage, prepareImage } from '@/features/diet/pickFoodImage';
import { useRecommend } from '@/features/diet/recommend';
import { useDailyFeedback } from '@/features/diet/useDailyFeedback';
import {
  useFoodFavorites,
  useToggleFavorite,
  type FoodFavorite,
} from '@/features/diet/useFoodFavorites';
import {
  MEAL_TYPES,
  useAddMeal,
  useDeleteMeal,
  useMeals,
  useUpdateMeal,
  type Meal,
  type MealType,
} from '@/features/diet/useMeals';
import { MonthCalendar } from '@/features/home/MonthCalendar';
import { useTodayWorkoutLog } from '@/features/workout/useTodayWorkoutLog';

const GNB_HEIGHT = 68; // 52 헤더 + 16 하단 패딩

/**
 * 식단 탭 — design.md 디자인 시스템 적용. UI 가안 구현본.
 *
 * 핵심 가치: "추천 대비 회복 목표 달성률"이 1순위 정보 (얼마나 먹었나가 아님).
 * 구성: ① 운동 맞춤 식단 가이드(운동 대비 섭취 상태 게이지 + 목표 매크로)
 *      ② 코칭(다음 행동 + 추천 식품)  ③ 섭취 칼로리  ④ 오늘 기록
 *
 * 목표 매크로/칼로리는 회원 신체정보(profiles) 기반 — 화면 내 단일 소스(guide.target).
 */

const NAV_HEIGHT = 64; // 하단 네비바 높이 (app-tabs.web)

type Variant = keyof typeof Typography;

function Txt({
  variant = 'body',
  color = Palette.gray900,
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
      style={[Typography[variant], { color }, weight ? { fontWeight: weight } : null, style]}>
      {children}
    </Text>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// ── 데이터 ──────────────────────────────────────────────────
// Meal · MealType · InputMethod · MEAL_TYPES 는 @/features/diet/useMeals 에서 가져온다.

// 강조 매크로별 기능 캡션 (색+텍스트 병행 — §10 접근성)
const FOCUS_CAPTION: Record<'protein' | 'carb', string> = {
  protein: '근육 회복',
  carb: '에너지',
};
const STEP_COUNT = 6234; // 오늘 걸음수 — 가데이터 (운동 전/계획 없을 때 표시)
const STEP_KCAL = Math.round(STEP_COUNT * 0.04); // 걸음 소모 칼로리: 약 0.04 kcal/step

// 탄단지 표시 정의 (순서: 단 → 탄 → 지). 목표 값은 가이드(guide.target)에서 가져온다.
const MACRO_META = [
  { key: 'protein', label: '단백질' },
  { key: 'carb', label: '탄수화물' },
  { key: 'fat', label: '지방' },
] as const;

// 매크로별 아이콘·색 (다음 식사 추천 표시용)
const MACRO_ICON: Record<'protein' | 'carb' | 'fat', { icon: IconName; color: string }> = {
  protein: { icon: 'local-fire-department', color: Palette.tintOrange },
  carb: { icon: 'bolt', color: Palette.tintYellow },
  fat: { icon: 'water-drop', color: '#6675FF' },
};

function currentMealType(): MealType {
  return '저녁'; // 가데이터: 시간대 기본 끼니 (라이브 시각 미사용)
}

// 운동 대비 섭취 상태 (순섭취/목표 비율 → 부족/적정/과다)
function balanceStatus(ratio: number): { label: string; color: string; desc: string } {
  if (ratio < 0.9)
    return { label: '부족', color: Palette.warning, desc: '현재 운동량 기준 권장 섭취보다 적게 먹었어요.' };
  if (ratio <= 1.05)
    return { label: '적정', color: Palette.success, desc: '현재 운동량 기준 권장 섭취 범위 안에 있어요.' };
  return { label: '과다', color: Palette.error, desc: '현재 운동량 기준 권장 섭취를 넘었어요.' };
}

// 운동 효과 점수 → 게이지 상태 (0-100점)
function scoreStatus(score: number): { label: string; color: string } {
  if (score >= 70) return { label: '훌륭해요', color: Palette.success };
  if (score >= 40) return { label: '양호해요', color: Palette.warning };
  return { label: '더 채워봐요', color: Palette.warning };
}

// ── 공통 컴포넌트 ───────────────────────────────────────────
function ProgressBar({ ratio, color = Palette.primary }: { ratio: number; color?: string }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { backgroundColor: color, width: `${Math.min(Math.max(ratio, 0), 1) * 100}%` }]} />
    </View>
  );
}

// 목표 매크로 진행 — 라벨 + 섭취/목표(g) + 진행 바
// focused=true 시 라벨·수치·바를 Primary로, 아래에 기능 캡션 표시 (§10 색+텍스트 병행)
function MacroProgress({
  label,
  value,
  goal,
  focused,
  caption,
}: {
  label: string;
  value: number;
  goal: number;
  focused?: boolean;
  caption?: string;
}) {
  const labelColor = focused ? Palette.primary : Palette.gray500;
  const fillColor = focused ? Palette.primary : Palette.gray400;
  const valuePct = goal > 0 ? Math.min((value / goal) * 100, 100) : 0;
  return (
    <View style={styles.macroCol}>
      <Txt variant="caption" weight={focused ? '600' : '400'} color={labelColor}>
        {label}
      </Txt>
      <View style={styles.macroValueRow}>
        <Txt variant="body" weight="700" color={focused ? Palette.primary : Palette.gray900}>
          {value}
        </Txt>
        <Txt variant="caption" color={Palette.gray500}>
          g
        </Txt>
      </View>
      <View style={styles.macroBar}>
        {/* 범위 바 */}
        <View style={styles.rangeBarWrap}>
          <View style={styles.rangeBarTrack} />
          <View style={[styles.rangeBarFill, { width: `${valuePct}%` as any, backgroundColor: fillColor }]} />
          {/* 목표 지점 세로 선 */}
          <View style={styles.rangeBarGoalLine} />
        </View>
        {/* 목표 수치 */}
        <View style={styles.rangeLabels}>
          <Txt variant="label" color={Palette.gray400} style={{ position: 'absolute', right: 0 }}>
            {goal}g
          </Txt>
        </View>
      </View>
      {focused && caption && (
        <Txt variant="label" color={Palette.primary}>
          {caption}
        </Txt>
      )}
    </View>
  );
}

// 반원형 게이지 — 운동 대비 섭취 상태(부족/적정/과다)를 색·채움·라벨로 표현.
// netRatio(순섭취/목표)를 0~1.5 → 0~100%로 매핑(적정 ≈ 2/3 지점). 기록 전(active=false)엔 회색·'등록 전'.
function SemiGauge({
  ratio,
  status,
  active,
  centerLabel,
}: {
  ratio: number;
  status: { label: string; color: string };
  active: boolean;
  centerLabel?: string;
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
  const color = active ? status.color : Palette.gray300;
  const score = Math.max(0, Math.round(ratio * 100)); // 마이너스 없이 현재 점수
  return (
    <View style={[styles.gaugeWrap, { width: W, height: H }]}>
      <Svg width={W} height={H}>
        <Path d={track} stroke={Palette.gray100} strokeWidth={SW} fill="none" strokeLinecap="round" />
        {p > 0 && (
          <Path d={prog} stroke={color} strokeWidth={SW} fill="none" strokeLinecap="round" />
        )}
      </Svg>
      <View style={styles.gaugeLabel}>
        <Txt variant="display2" weight="700" color={active ? Palette.gray900 : Palette.gray500}>
          {centerLabel ?? `${score}%`}
        </Txt>
        <Txt variant="caption" weight="700" color={active ? status.color : Palette.gray500}>
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
            <Stop offset="0" stopColor={Palette.bgBase} stopOpacity={1} />
            <Stop offset="1" stopColor={Palette.bgBase} stopOpacity={0} />
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
                <Stop offset="0" stopColor={Palette.tintIndigo} />
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
        {burned > 0 && beforePos < 0.8 && (
          <View style={[styles.calLabelAnchor, { left: `${(beforePos * 100).toFixed(1)}%` as DimensionValue }]}>
            <Txt variant="label" color={Palette.gray400} style={styles.calLabelCentered}>
              활동 전
            </Txt>
          </View>
        )}
        <Txt variant="label" color={Palette.gray400} style={styles.calLabelRight}>
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
        { backgroundColor: disabled ? Palette.gray300 : pressed ? Palette.primaryPressed : Palette.primary },
      ]}>
      <Txt variant="body" weight="600" color="#FFFFFF">
        {label}
      </Txt>
    </Pressable>
  );
}

const MORNING_ICON = require('../../assets/images/icon/morning_icon.png') as number;
const LUNCH_ICON = require('../../assets/images/icon/lunch_icon.png') as number;
const NIGHT_ICON = require('../../assets/images/icon/night_icon.png') as number;
const DESSERT_ICON = require('../../assets/images/icon/dessert_icon.png') as number;

// 끼니별 아이콘·색 (배경 없이 아이콘 틴트만)
const MEAL_VISUAL: Record<MealType, { icon: IconName; tint: string; image?: number }> = {
  아침: { icon: 'wb-twilight', tint: Palette.bgBase, image: MORNING_ICON },
  점심: { icon: 'wb-sunny', tint: Palette.bgBase, image: LUNCH_ICON },
  저녁: { icon: 'bedtime', tint: Palette.bgBase, image: NIGHT_ICON },
  간식: { icon: 'egg', tint: Palette.bgBase, image: DESSERT_ICON },
};

// 끼니 슬롯 카드 — 2×2 그리드. 탭하면 그 끼니로 기록 추가/상세 진입.
function MealSlot({ type, meals, onPress }: { type: MealType; meals: Meal[]; onPress: (t: MealType) => void }) {
  const v = MEAL_VISUAL[type];
  const mine = meals.filter((m) => m.mealType === type);
  const has = mine.length > 0;
  const name = mine.map((m) => m.name).join(', ');
  const kcal = mine.reduce((s, m) => s + m.kcal, 0);
  const time = mine[0]?.time;
  return (
    <Pressable onPress={() => onPress(type)} style={styles.slotCard}>
      {/* + 버튼 — 우상단 */}
      <View style={styles.slotAddCorner}>
        <Icon name="add" size={18} color={has ? Palette.gray400 : Palette.primary} />
      </View>

      {/* 아이콘 영역 */}
      <View style={styles.slotIconWrap}>
        <View style={[styles.slotIconCircle, { backgroundColor: v.tint }]}>
          {v.image ? (
            <Image source={v.image} style={{ width: 34, height: 34 }} resizeMode="contain" />
          ) : (
            <Icon name={v.icon} size={34} color={v.tint} />
          )}
        </View>
      </View>

      {/* 하단 텍스트 */}
      <View style={styles.slotInfo}>
        <Txt variant="body" weight="700" color={Palette.gray900}>{type}</Txt>
        {has ? (
          <>
            <Txt variant="label" color={Palette.gray500} numberOfLines={1}>{name}</Txt>
            <Txt variant="label" color={Palette.gray400}>{time} · {kcal} kcal</Txt>
          </>
        ) : (
          <Txt variant="label" color={Palette.gray400}>아직 기록 없음</Txt>
        )}
      </View>

      {/* 기록됨 뱃지 */}
      {has && (
        <View style={styles.slotBadge}>
          <Icon name="check" size={10} color={Palette.success} />
          <Txt variant="label" weight="600" color={Palette.success}>기록됨</Txt>
        </View>
      )}
    </Pressable>
  );
}

// ── 기록 모달 (전체 화면 + 탭) ──────────────────────────────
type RecTab = 'image' | 'text' | 'search' | 'favorites';
type RecStep = 'input' | 'analyzing' | 'review' | 'result';
type MacroTotals = { kcal: number; carb: number; protein: number; fat: number };
// 매크로 강조 컬러 — focusMacro(런타임 값) 기준. MACRO_DOT 대체.
function macroDot(key: 'protein' | 'carb' | 'fat', fm: 'protein' | 'carb' | null): string {
  return fm === key ? Palette.primary : Palette.gray300;
}

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
  { key: 'image', label: '스캔', icon: 'photo-camera' },
  { key: 'text', label: '텍스트', icon: 'edit' },
  { key: 'search', label: '검색', icon: 'search' },
  { key: 'favorites', label: '즐겨찾기', icon: 'star' },
];

function CameraViewContent({
  onCapture,
  onGallery,
  analyzeError,
}: {
  onCapture: (uri: string) => void;
  onGallery: () => void;
  analyzeError: string | null;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  async function takePicture() {
    if (Platform.OS === 'web') { onGallery(); return; }
    try {
      const photo = await cameraRef.current?.takePictureAsync();
      if (photo?.uri) onCapture(photo.uri);
    } catch {
      // 카메라 에러 무시
    }
  }

  const bottomBar = (
    <View style={styles.cameraBottomBar}>
      {analyzeError ? (
        <Txt variant="caption" color="#ff6b6b" style={styles.cameraErrorText}>{analyzeError}</Txt>
      ) : null}
      <View style={styles.cameraControls}>
        <View style={{ flex: 1 }} />
        <Pressable onPress={takePicture} style={styles.shutterBtn} />
        <View style={styles.galleryArea}>
          <Pressable onPress={onGallery} style={styles.galleryBtn}>
            <Icon name="photo-library" size={22} color="#fff" />
          </Pressable>
        </View>
      </View>
    </View>
  );

  // 웹: 검정 배경 플레이스홀더
  if (Platform.OS === 'web') {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Camera size={72} color="rgba(255,255,255,0.08)" strokeWidth={1} />
        </View>
        {bottomBar}
      </View>
    );
  }

  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#fff" size="large" />
    </View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.cameraDenied}>
        <Camera size={48} color="rgba(255,255,255,0.5)" strokeWidth={1.5} />
        <Txt variant="body" weight="600" color="#fff">카메라 권한이 필요해요</Txt>
        <Txt variant="caption" color="rgba(255,255,255,0.6)" style={styles.center}>
          음식을 촬영하려면 카메라 접근 권한을 허용해주세요
        </Txt>
        <Pressable onPress={requestPermission} style={styles.cameraPermBtn}>
          <Txt variant="body" weight="600" color="#fff">권한 허용</Txt>
        </Pressable>
        <Pressable onPress={onGallery} hitSlop={8}>
          <Txt variant="caption" color="rgba(255,255,255,0.7)">앨범에서 선택하기</Txt>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
      {bottomBar}
    </View>
  );
}

function RecordModal({
  visible,
  initialMealType,
  target,
  totals,
  focusMacro = null,
  burnedKcal = 0,
  onClose,
  onSave,
}: {
  visible: boolean;
  initialMealType?: MealType;
  target: MacroTotals; // 일일 목표 매크로
  totals: MacroTotals; // 저장 직전까지의 오늘 누적
  focusMacro?: 'protein' | 'carb' | null;
  burnedKcal?: number;
  onClose: () => void;
  onSave: (meal: Omit<Meal, 'id' | 'time'>, eatenAt: Date) => void;
}) {
  // 슬롯에서 열면 그 끼니로, 아니면 시간대 기본 끼니
  const mealType = initialMealType ?? currentMealType();
  const [tab, setTab] = useState<RecTab>('image');
  const [step, setStep] = useState<RecStep>('input');
  const [textInput, setTextInput] = useState('');
  const [gramsInput, setGramsInput] = useState(''); // 선택: 총 섭취량 (단위는 Claude가 음식에 따라 판단)
  const [searchInput, setSearchInput] = useState('');
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [optimisticFav, setOptimisticFav] = useState<boolean | null>(null);
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
  const [unit, setUnit] = useState<'인분' | 'g'>('인분');
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [isSearchPicked, setIsSearchPicked] = useState(false); // 검색으로 선택 시 g 전용
  const [showNutrDetail, setShowNutrDetail] = useState(false);
  const feedback = useMealFeedback();
  const feedbackRequested = useRef(false); // 리뷰 진입당 1회만 요청(편집 중 재호출 방지)

  // 오늘 운동 맥락 — 트레이너 피드백에 회복 관점 반영
  const feedbackContext = focusMacro === 'protein' ? '근력 운동 회복' : focusMacro === 'carb' ? '유산소 운동 회복' : undefined;

  // 수량 반영 스케일값 — 편집 중엔 draft 그대로, 아닐 때는 baseNutrition × multiplier
  // unit='인분': AI가 추정한 1인분 기준(×quantity). unit='g': quantity/100
  const unitMultiplier = unit === 'g' ? quantity / 100 : quantity;
  const scaledKcal    = baseNutrition && !editingReview ? Math.round(baseNutrition.kcal     * unitMultiplier) : (draft?.kcal     ?? 0);
  const scaledCarb    = baseNutrition && !editingReview ? Math.round(baseNutrition.carb     * unitMultiplier) : (draft?.carb     ?? 0);
  const scaledProtein = baseNutrition && !editingReview ? Math.round(baseNutrition.protein  * unitMultiplier) : (draft?.protein  ?? 0);
  const scaledFat     = baseNutrition && !editingReview ? Math.round(baseNutrition.fat      * unitMultiplier) : (draft?.fat      ?? 0);
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
      setIsSearchPicked(false);
      setQuantity(1);
      setUnit('인분');
    }
    setShowUnitPicker(false);
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
    setIsSearchPicked(false);
    setUnit('인분');
    setShowUnitPicker(false);
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
    setIsSearchPicked(false);
    setCapturedImageUri(null);
    setOptimisticFav(null);
    setMealTime(new Date());
    setUnit('인분');
    setShowUnitPicker(false);
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
    setIsSearchPicked(false);
    setCapturedImageUri(null);
    setOptimisticFav(null);
    setMealTime(new Date());
    setUnit('인분');
    setShowUnitPicker(false);
    feedbackRequested.current = false;
    feedback.reset();
  }

  // 텍스트 탭: Claude(analyze-meal Edge Function)로 실제 영양 추정
  async function analyzeText() {
    const text = textInput.trim();
    if (!text) return;
    const amount = parseInt(gramsInput, 10);
    const grams = Number.isFinite(amount) && amount > 0 ? amount : undefined;
    setAnalyzeError(null);
    setStep('analyzing');
    try {
      const r = await analyzeMeal.mutateAsync({ text, grams });
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
    setCapturedImageUri(picked.uri);
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

  // CameraView로 직접 촬영한 URI → Claude 비전 영양 추정
  async function analyzeFromUri(uri: string) {
    setAnalyzeError(null);
    setCapturedImageUri(uri);
    let picked;
    try {
      picked = await prepareImage(uri);
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : '사진을 처리하지 못했어요.');
      return;
    }
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
    setIsSearchPicked(true);
    setUnit('g');
    setQuantity(100);
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

  const favorites = useFoodFavorites();
  const favData: FoodFavorite[] = favorites.data ?? [];
  const isFavorited = (name: string) => favData.some((f) => f.name === name);
  const toggleFavorite = useToggleFavorite();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.recScreen} edges={['top', 'bottom', 'left', 'right']}>
        {/* 헤더 */}
        <View style={styles.recHeader}>
          <Pressable onPress={() => (step === 'review' ? leaveReview() : close())} hitSlop={8} style={styles.recHeaderBtn}>
            <Icon name={step === 'review' ? 'arrow-back' : 'close'} size={24} color={Palette.gray900} />
          </Pressable>
          <Txt variant="h2">
            {step === 'review' ? 'AI 분석 결과' : '식단 기록'}
          </Txt>
          <View style={styles.recHeaderBtn} />
        </View>

        {step === 'review' && draft ? (
          <ScrollView contentContainerStyle={styles.reviewBody} showsVerticalScrollIndicator={false}>
            {/* ① 끼니 */}
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
                        ? { backgroundColor: Palette.primary, borderColor: Palette.primary }
                        : { backgroundColor: Palette.bgSurface, borderColor: Palette.lineDefault },
                    ]}>
                    <Txt variant="body" weight="600" color={selected ? Palette.white : Palette.gray700}>{t}</Txt>
                  </Pressable>
                );
              })}
            </View>

            {/* ② 식사 시간 */}
            <Pressable style={styles.mealTimeRow} onPress={() => setShowTimePicker((v) => !v)}>
              <Icon name="clock" size={16} color={Palette.gray500} />
              <Txt variant="body" color={Palette.gray700} style={styles.flex1}>식사 시간</Txt>
              <Txt variant="body" weight="600" color={Palette.gray700}>{formatMealTime(mealTime)}</Txt>
              <Icon name={showTimePicker ? 'arrow-upward' : 'keyboard-arrow-down'} size={18} color={Palette.gray500} />
            </Pressable>

            {showTimePicker && Platform.OS !== 'web' && (
              <DateTimePicker
                value={mealTime}
                mode="time"
                is24Hour={true}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, selected) => {
                  if (Platform.OS === 'android') setShowTimePicker(false);
                  if (selected) setMealTime(selected);
                }}
              />
            )}

            {showTimePicker && Platform.OS === 'web' && (
              <View style={styles.timePicker}>
                {/* 시 */}
                <View style={styles.timePickerGroup}>
                  <Pressable
                    hitSlop={8}
                    onPress={() => setMealTime((prev) => { const n = new Date(prev); n.setHours((prev.getHours() + 23) % 24, prev.getMinutes()); return n; })}
                    style={styles.timePickerArrow}>
                    <Icon name="arrow-upward" size={18} color={Palette.gray700} />
                  </Pressable>
                  <Txt variant="h2" weight="700" color={Palette.gray900}>{String(mealTime.getHours()).padStart(2, '0')}</Txt>
                  <Pressable
                    hitSlop={8}
                    onPress={() => setMealTime((prev) => { const n = new Date(prev); n.setHours((prev.getHours() + 1) % 24, prev.getMinutes()); return n; })}
                    style={styles.timePickerArrow}>
                    <Icon name="arrow-downward" size={18} color={Palette.gray700} />
                  </Pressable>
                </View>
                <Txt variant="h2" color={Palette.gray400}>:</Txt>
                {/* 분 */}
                <View style={styles.timePickerGroup}>
                  <Pressable
                    hitSlop={8}
                    onPress={() => setMealTime((prev) => { const n = new Date(prev); n.setHours(prev.getHours(), ((prev.getMinutes() - 5 + 60) % 60)); return n; })}
                    style={styles.timePickerArrow}>
                    <Icon name="arrow-upward" size={18} color={Palette.gray700} />
                  </Pressable>
                  <Txt variant="h2" weight="700" color={Palette.gray900}>{String(mealTime.getMinutes()).padStart(2, '0')}</Txt>
                  <Pressable
                    hitSlop={8}
                    onPress={() => setMealTime((prev) => { const n = new Date(prev); n.setHours(prev.getHours(), (prev.getMinutes() + 5) % 60); return n; })}
                    style={styles.timePickerArrow}>
                    <Icon name="arrow-downward" size={18} color={Palette.gray700} />
                  </Pressable>
                </View>
                <Pressable onPress={() => setShowTimePicker(false)} style={styles.timePickerDone} hitSlop={8}>
                  <Txt variant="caption" weight="600" color={Palette.primary}>완료</Txt>
                </Pressable>
              </View>
            )}

            {/* ③ 통합 카드 — 음식 + 영양 */}
            <View style={[styles.reviewFoodCard, { marginTop: Spacing.lg }]}>
              <View style={styles.reviewFoodTop}>
                <View style={styles.reviewFoodImg}>
                  {capturedImageUri ? (
                    <Image source={{ uri: capturedImageUri }} style={styles.reviewFoodImgPhoto} />
                  ) : (
                    <Icon name="photo-library" size={28} color={Palette.primary} />
                  )}
                </View>
                <View style={styles.reviewFoodInfo}>
                  {editingReview ? (
                    <Input
                      value={draft.name}
                      onChangeText={(t) => setDraft({ ...draft, name: t })}
                      placeholder="음식 이름"
                      style={styles.reviewNameInput}
                      textStyle={styles.reviewNameInputText}
                    />
                  ) : (
                    <>
                      <Txt variant="body" weight="700">{draft.name}</Txt>
                      <Txt variant="caption" color={Palette.gray500}>인식 결과가 다르면 수정해 주세요</Txt>
                    </>
                  )}
                </View>
                <View style={styles.reviewActionBtns}>
                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      const alreadyFav = optimisticFav ?? isFavorited(draft.name);
                      setOptimisticFav(!alreadyFav);
                      toggleFavorite.mutate({
                        food: { name: draft.name, kcal: draft.kcal, carb: draft.carb, protein: draft.protein, fat: draft.fat, servingSize: null },
                      });
                    }}
                    style={styles.starBtn}>
                    <Icon name="star" size={20} color={(optimisticFav ?? isFavorited(draft.name)) ? Palette.primary : Palette.gray300} />
                  </Pressable>
                  <Pressable onPress={toggleEdit} hitSlop={8} style={styles.reviewEditBtnTop}>
                    <Icon name={editingReview ? 'check' : 'edit'} size={14} color={Palette.primary} />
                    <Txt variant="label" weight="700" color={Palette.primary}>{editingReview ? '완료' : '수정'}</Txt>
                  </Pressable>
                </View>
              </View>
              {!editingReview && (
                <>
                  <View style={[styles.reviewStepperRow, { justifyContent: 'flex-end' }]}>
                    <View style={styles.reviewStepper}>
                      <Pressable
                        onPress={() => setQuantity((q) => Math.max(unit === 'g' ? 10 : 1, q - (unit === 'g' ? 10 : 1)))}
                        style={styles.stepperBtn}
                        hitSlop={8}>
                        <Txt variant="h2" color={Palette.gray700}>-</Txt>
                      </Pressable>
                      <Txt variant="body" weight="700" style={styles.stepperNum}>{quantity}</Txt>
                      <Pressable
                        onPress={() => setQuantity((q) => q + (unit === 'g' ? 10 : 1))}
                        style={styles.stepperBtn}
                        hitSlop={8}>
                        <Txt variant="h2" color={Palette.gray700}>+</Txt>
                      </Pressable>
                    </View>
                    <View style={{ position: 'relative' }}>
                      {isSearchPicked ? (
                        <View style={styles.stepperUnit}>
                          <Txt variant="body" color={Palette.gray700}>g</Txt>
                        </View>
                      ) : (
                        <>
                          <Pressable onPress={() => setShowUnitPicker((v) => !v)} style={styles.stepperUnit}>
                            <Txt variant="body" color={Palette.gray700}>{unit}</Txt>
                            <Icon name={showUnitPicker ? 'arrow-upward' : 'keyboard-arrow-down'} size={18} color={Palette.gray500} />
                          </Pressable>
                          {showUnitPicker && (
                            <View style={[styles.unitDropdown, { position: 'absolute', top: 36, right: 0, zIndex: 999 }]}>
                              {(['인분', 'g'] as const).map((u) => (
                                <Pressable
                                  key={u}
                                  onPress={() => {
                                    if (u !== unit) {
                                      setQuantity(u === 'g'
                                        ? Math.max(10, Math.round(quantity * 100 / 10) * 10)
                                        : Math.max(1, Math.round(quantity / 100)));
                                      setUnit(u);
                                    }
                                    setShowUnitPicker(false);
                                  }}
                                  style={[styles.unitOption, u === unit && { backgroundColor: Palette.primaryLight }]}>
                                  <Txt variant="body" color={u === unit ? Palette.primary : Palette.gray700}>{u}</Txt>
                                </Pressable>
                              ))}
                            </View>
                          )}
                        </>
                      )}
                    </View>
                  </View>
                </>
              )}
              <View style={styles.sectionDivider} />
              <View style={styles.reviewNutrKcalRow}>
                {editingReview ? (
                  <Input
                    value={String(draft.kcal)}
                    onChangeText={(t) => setDraft({ ...draft, kcal: toInt(onlyDigits(t)) })}
                    keyboardType="number-pad"
                    style={styles.reviewKcalInput}
                    textStyle={styles.reviewKcalInputText}
                  />
                ) : (
                  <Txt variant="display" weight="700" color={Palette.gray900}>{scaledKcal}</Txt>
                )}
                <Txt variant="body" color={Palette.gray500}> kcal</Txt>
                {!editingReview && (
                  <View style={styles.dailyPctBadge}>
                    <Txt variant="label" weight="600" color={Palette.primary}>일일 목표 {goalPct}%</Txt>
                  </View>
                )}
              </View>
              {!editingReview && (
                <Txt variant="caption" color={Palette.gray500}>
                  오늘 목표까지 {remainingKcal.toLocaleString()}kcal 남았어요
                </Txt>
              )}
              <View style={styles.macroRow}>
                {(['carb', 'protein', 'fat'] as const).map((k) => {
                  const label = k === 'carb' ? '탄수화물' : k === 'protein' ? '단백질' : '지방';
                  const val = k === 'carb' ? scaledCarb : k === 'protein' ? scaledProtein : scaledFat;
                  return (
                    <MacroBox key={k} mkey={k} label={label} focusMacro={focusMacro}>
                      {editingReview ? (
                        <Input
                          value={String(draft[k])}
                          onChangeText={(t) => setDraft({ ...draft, [k]: toInt(onlyDigits(t)) })}
                          keyboardType="number-pad"
                          style={styles.reviewMacroInput}
                          textStyle={styles.reviewMacroInputText}
                        />
                      ) : (
                        <Txt variant="h2" weight="700" color={Palette.gray900}>{val}g</Txt>
                      )}
                    </MacroBox>
                  );
                })}
              </View>
            </View>

            <PrimaryButton label="저장하기" onPress={saveAndShowResult} />
          </ScrollView>
        ) : step === 'result' && draft ? (
          <ResultView
            draft={draft}
            target={target}
            base={resultBase}
            context={feedbackContext}
            feedback={feedback}
            burnedKcal={burnedKcal}
            onContinue={continueRecording}
            onDone={close}
          />
        ) : step === 'analyzing' ? (
          <View style={styles.analyzing}>
            <ActivityIndicator size="large" color={Palette.primary} />
            <Txt variant="body">AI가 음식을 분석하고 있어요</Txt>
            <Txt variant="caption" color={Palette.gray500}>
              음식 인식 · 칼로리 추정 · 탄단지 분석
            </Txt>
          </View>
        ) : (
          <>
            {/* 탭 */}
            <View style={styles.recTabBar}>
              {REC_TABS.map((t) => {
                const active = tab === t.key;
                const color = active ? Palette.primary : Palette.gray500;
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
              <CameraViewContent
                onCapture={analyzeFromUri}
                onGallery={() => analyzeFromImage('library')}
                analyzeError={analyzeError}
              />
            )}

            {tab === 'text' && (
              <View style={styles.tabForm}>
                <TextInput
                  value={textInput}
                  onChangeText={setTextInput}
                  placeholder={'먹은 음식을 입력하세요.\n(예: 치킨 2조각, 현미밥 한공기, 사과 1개)'}
                  placeholderTextColor={Palette.gray400}
                  style={styles.textArea}
                  multiline
                  autoFocus
                />
                <View style={styles.gramsRow}>
                  <Txt variant="label" color={Palette.gray500} style={styles.flex1}>
                    총 섭취량 (선택)
                  </Txt>
                  <Input
                    value={gramsInput}
                    onChangeText={(t) => setGramsInput(t.replace(/[^0-9]/g, ''))}
                    placeholder="예: 250"
                    keyboardType="number-pad"
                    style={styles.gramsInput}
                    textStyle={styles.gramsInputText}
                  />
                </View>
                {analyzeError && (
                  <Txt variant="caption" color={Palette.error}>
                    {analyzeError}
                  </Txt>
                )}
                <PrimaryButton label="AI 분석" disabled={!textInput.trim()} onPress={analyzeText} />
              </View>
            )}

            {tab === 'favorites' && (
              favData.length > 0 ? (
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  style={styles.tabForm}>
                  {favData.map((f) => (
                    <View key={f.id} style={styles.searchItem}>
                      <Pressable
                        onPress={() => pickFood({ ...f, servingSize: f.servingSize ?? null })}
                        style={styles.flex1}>
                        <Txt variant="body" weight="600">{f.name}</Txt>
                        <Txt variant="caption" color={Palette.gray500}>
                          탄 {f.carb}g · 단 {f.protein}g · 지 {f.fat}g
                          {f.servingSize ? ` · 1회 ${f.servingSize}` : ''}
                        </Txt>
                      </Pressable>
                      <Pressable
                        hitSlop={8}
                        onPress={() => toggleFavorite.mutate({ food: { ...f, servingSize: f.servingSize ?? null }, favorites: favData })}
                        style={styles.starBtn}>
                        <Icon name="star" size={18} color={Palette.primary} />
                      </Pressable>
                      <Pressable onPress={() => pickFood({ ...f, servingSize: f.servingSize ?? null })}>
                        <Txt variant="body" weight="600" color={Palette.primary}>{f.kcal} kcal</Txt>
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.photoArea}>
                  <View style={[styles.photoBtn, { backgroundColor: Palette.bgMuted }]}>
                    <Icon name="star" size={36} color={Palette.gray300} />
                  </View>
                  <Txt variant="body" weight="600" color={Palette.gray700}>
                    즐겨찾기한 음식이 없어요
                  </Txt>
                  <Txt variant="caption" color={Palette.gray500} style={{ textAlign: 'center' }}>
                    검색에서 음식을 찾은 후{'\n'}별표를 눌러 저장해보세요.
                  </Txt>
                </View>
              )
            )}

            {tab === 'search' && (
              <View style={styles.tabForm}>
                <View style={styles.searchBar}>
                  <Icon name="search" size={20} color={Palette.gray500} />
                  <TextInput
                    value={searchInput}
                    onChangeText={setSearchInput}
                    placeholder="음식 이름 검색"
                    placeholderTextColor={Palette.gray400}
                    style={styles.searchInput}
                    autoFocus
                  />
                </View>
                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  {searchResults.map((f, i) => (
                    <View key={`${f.name}-${i}`} style={styles.searchItem}>
                      <Pressable onPress={() => pickFood(f)} style={styles.flex1}>
                        <Txt variant="body" weight="600">
                          {f.name}
                        </Txt>
                        <Txt variant="caption" color={Palette.gray500}>
                          100g 기준 · 탄 {f.carb}g · 단 {f.protein}g · 지 {f.fat}g
                          {f.servingSize ? ` · 1회 ${f.servingSize}` : ''}
                        </Txt>
                      </Pressable>
                      <Pressable
                        hitSlop={8}
                        onPress={() => toggleFavorite.mutate({ food: f, favorites: favData })}
                        style={styles.starBtn}>
                        <Icon
                          name="star"
                          size={18}
                          color={isFavorited(f.name) ? Palette.primary : Palette.gray300}
                        />
                      </Pressable>
                      <Pressable onPress={() => pickFood(f)}>
                        <Txt variant="body" weight="600" color={Palette.primary}>
                          {f.kcal} kcal
                        </Txt>
                      </Pressable>
                    </View>
                  ))}
                  {search.isFetching && (
                    <View style={styles.searchEmpty}>
                      <ActivityIndicator color={Palette.primary} />
                    </View>
                  )}
                  {!search.isFetching && search.isError && (
                    <Txt variant="caption" color={Palette.error} style={styles.searchEmpty}>
                      검색 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.
                    </Txt>
                  )}
                  {!search.isFetching &&
                    !search.isError &&
                    debouncedQuery.length >= 2 &&
                    searchResults.length === 0 && (
                      <Txt variant="caption" color={Palette.gray500} style={styles.searchEmpty}>
                        검색 결과가 없어요.
                      </Txt>
                    )}
                  {debouncedQuery.length < 2 && (
                    <Txt variant="caption" color={Palette.gray500} style={styles.searchEmpty}>
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
  focusMacro = null,
  children,
}: {
  mkey: 'protein' | 'carb' | 'fat';
  label: string;
  focusMacro?: 'protein' | 'carb' | null;
  children: React.ReactNode;
}) {
  const focused = focusMacro === mkey;
  return (
    <View style={styles.macroCol}>
      <View style={styles.resultMacroHead}>
        <View style={[styles.resultDot, { backgroundColor: macroDot(mkey, focusMacro) }]} />
        <Txt variant="label" weight={focused ? '600' : '400'} color={focused ? Palette.primary : Palette.gray500}>
          {label}
        </Txt>
      </View>
      {children}
      {focused && focusMacro && (
        <Txt variant="label" color={Palette.primary}>
          {FOCUS_CAPTION[focusMacro]}
        </Txt>
      )}
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
                <Stop offset="0" stopColor={Palette.primary} stopOpacity={0.18} />
                <Stop offset="1" stopColor={Palette.primary} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {[0, 0.5, 1].map((g) => {
              const gy = PAD + g * (H - 2 * PAD);
              return <Line key={g} x1={0} y1={gy} x2={w} y2={gy} stroke={Palette.lineDefault} strokeWidth={1} />;
            })}
            <Path d={area} fill="url(#scoreFill)" />
            <Path d={line} stroke={Palette.primary} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            <Circle cx={x(n - 1)} cy={y(last.score)} r={4.5} fill={Palette.primary} stroke="#FFFFFF" strokeWidth={2} />
          </Svg>
        )}
      </View>
      <View style={styles.graphLabels}>
        {points.map((p, i) => (
          <Txt key={p.label} variant="label" color={i === n - 1 ? Palette.gray900 : Palette.gray500}>
            {p.label}
          </Txt>
        ))}
      </View>
    </View>
  );
}

function MacroRatioBar({ carb, protein, fat }: { carb: number; protein: number; fat: number }) {
  const carbKcal = carb * 4;
  const proteinKcal = protein * 4;
  const fatKcal = fat * 9;
  const total = carbKcal + proteinKcal + fatKcal;
  if (total === 0) return null;
  const cPct = Math.round((carbKcal / total) * 100);
  const pPct = Math.round((proteinKcal / total) * 100);
  const fPct = 100 - cPct - pPct;
  const segments = [
    { key: 'c', label: `탄${cPct}%`, pct: cPct, color: Palette.tintYellow },
    { key: 'p', label: `단${pPct}%`, pct: pPct, color: Palette.tintOrange },
    { key: 'f', label: `지${fPct}%`, pct: fPct, color: '#6675FF' },
  ];
  return (
    <View style={styles.ratioBarWrap}>
      <View style={styles.ratioBar}>
        {segments.map((s, i) => (
          <View
            key={s.key}
            style={[
              styles.ratioSegment,
              { flex: s.pct, backgroundColor: s.color },
              i === 0 && { borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
              i === segments.length - 1 && { borderTopRightRadius: 4, borderBottomRightRadius: 4 },
            ]}
          />
        ))}
      </View>
      <View style={styles.ratioLabels}>
        {segments.map((s) => (
          <Txt key={s.key} variant="label" weight="600" style={{ color: s.color }}>{s.label}</Txt>
        ))}
      </View>
    </View>
  );
}

function ResultView({
  draft,
  target,
  base,
  context,
  feedback,
  burnedKcal = 0,
  onContinue,
  onDone,
}: {
  draft: Omit<Meal, 'id' | 'time'>;
  target: MacroTotals;
  base: MacroTotals | null;
  context?: string;
  feedback: ReturnType<typeof useMealFeedback>;
  burnedKcal?: number;
  onContinue: () => void;
  onDone: () => void;
}) {
  const b = base ?? { kcal: 0, carb: 0, protein: 0, fat: 0 };
  const energyTarget = target.kcal + burnedKcal;
  const scoreOf = (kcal: number) => Math.max(0, Math.round((energyTarget > 0 ? kcal / energyTarget : 0) * 100));
  const after = scoreOf(b.kcal + draft.kcal);
  const delta = after - scoreOf(b.kcal);
  const totalKcal = b.kcal + draft.kcal;
  const status = scoreStatus(after);
  const coach = feedback.data ? splitCoach(feedback.data) : coachFallback(draft, context);

  return (
    <View style={styles.flex1}>
      <ScrollView contentContainerStyle={styles.reviewBody} showsVerticalScrollIndicator={false}>
        {/* 점수 카드 */}
        <View style={styles.scoreCard}>
          <Txt variant="caption" weight="600" color={Palette.gray500}>운동 효과 점수</Txt>
          <View style={styles.scoreRow}>
            <Txt variant="display" weight="700" color={Palette.gray900}>{after}점</Txt>
            {delta !== 0 && (
              <View style={[styles.scoreDeltaBadge, { backgroundColor: delta > 0 ? '#E8F9EF' : Palette.gray200 }]}>
                <Icon
                  name={delta > 0 ? 'arrow-upward' : 'arrow-downward'}
                  size={12}
                  color={delta > 0 ? Palette.success : Palette.gray500}
                />
                <Txt variant="label" weight="700" color={delta > 0 ? Palette.success : Palette.gray500}>
                  {delta > 0 ? '+' : ''}{delta}점
                </Txt>
              </View>
            )}
          </View>
          <Txt variant="label" weight="600" style={{ color: status.color }}>{status.label}</Txt>
          <Txt variant="caption" color={Palette.gray500}>{draft.name}</Txt>

          <View style={styles.sectionDivider} />

          <View style={styles.resultKcalRow}>
            <Txt variant="caption" color={Palette.gray500}>끼니 총 열량</Txt>
            <Txt variant="body" weight="700" color={Palette.gray900}>{draft.kcal} kcal</Txt>
          </View>
          <Txt variant="label" color={Palette.gray400}>{totalKcal} / {target.kcal} kcal</Txt>

          <View style={styles.resultMacroInline}>
            {([
              { key: 'c', label: '탄', val: draft.carb, color: Palette.tintYellow },
              { key: 'p', label: '단', val: draft.protein, color: Palette.tintOrange },
              { key: 'f', label: '지', val: draft.fat, color: '#6675FF' },
            ] as const).map((m) => (
              <View key={m.key} style={styles.resultMacroChip}>
                <View style={[styles.resultDot, { backgroundColor: m.color }]} />
                <Txt variant="caption" color={Palette.gray700}>{m.label} {m.val}g</Txt>
              </View>
            ))}
          </View>
          <MacroRatioBar carb={draft.carb} protein={draft.protein} fat={draft.fat} />
        </View>

        {/* 핏쌤 채팅 말풍선 */}
        <View style={styles.resultCoachWrap}>
          <View style={styles.resultCoachAvatarRow}>
            <View style={styles.resultCoachAvatar}>
              <Image source={COACH_CHARACTER} style={styles.resultCoachAvatarImg} resizeMode="contain" />
            </View>
            <Txt variant="label" color={Palette.gray500}>핏쌤</Txt>
          </View>
          {feedback.isPending ? (
            <View style={styles.resultCoachBubble}>
              <ActivityIndicator color={Palette.white} size="small" />
            </View>
          ) : (
            <View style={styles.resultCoachBubble}>
              <Txt variant="body" weight="700" color="#FFFFFF">{coach.title}</Txt>
              {coach.body ? (
                <Txt variant="caption" style={{ color: 'rgba(255,255,255,0.85)', lineHeight: 20 }}>{coach.body}</Txt>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>

      {/* 하단 고정 버튼 */}
      <View style={styles.resultBtns}>
        <Pressable onPress={onContinue} style={styles.resultSecondaryBtn}>
          <Txt variant="body" weight="600" color={Palette.gray700}>기록 계속하기</Txt>
        </Pressable>
        <Pressable
          onPress={onDone}
          style={({ pressed }) => [
            styles.resultPrimaryBtn,
            { backgroundColor: pressed ? Palette.primaryPressed : Palette.primary },
          ]}>
          <Txt variant="body" weight="600" color="#FFFFFF">완료</Txt>
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
            <Icon name={editing ? 'arrow-back' : 'close'} size={24} color={Palette.gray900} />
          </Pressable>
          <Txt variant="h2">{editing ? '기록 수정' : `${mealType ?? ''} 기록`}</Txt>
          <View style={styles.recHeaderBtn} />
        </View>

        {editing ? (
          <ScrollView contentContainerStyle={styles.reviewBody} showsVerticalScrollIndicator={false}>
            <View style={styles.editCol}>
              <Txt variant="label" color={Palette.gray500}>
                음식
              </Txt>
              <Input
                value={form.name}
                onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
                placeholder="음식 이름"
              />
            </View>
            <View style={styles.editCol}>
              <Txt variant="label" color={Palette.gray500}>
                칼로리 (kcal)
              </Txt>
              <Input
                value={form.kcal}
                onChangeText={(t) => setForm((f) => ({ ...f, kcal: onlyDigits(t) }))}
                keyboardType="number-pad"
                placeholder="0"
              />
            </View>
            <View style={styles.editRow}>
              {(['carb', 'protein', 'fat'] as const).map((k) => (
                <View key={k} style={[styles.editCol, styles.flex1]}>
                  <Txt variant="label" color={Palette.gray500}>
                    {k === 'carb' ? '탄수화물(g)' : k === 'protein' ? '단백질(g)' : '지방(g)'}
                  </Txt>
                  <Input
                    value={form[k]}
                    onChangeText={(t) => setForm((f) => ({ ...f, [k]: onlyDigits(t) }))}
                    keyboardType="number-pad"
                    placeholder="0"
                  />
                </View>
              ))}
            </View>

            <PrimaryButton label="저장하기" onPress={save} disabled={updateMeal.isPending} />
            <Pressable onPress={remove} disabled={deleteMeal.isPending} style={styles.deleteBtn} hitSlop={8}>
              <Icon name="delete-outline" size={18} color={Palette.error} />
              <Txt variant="caption" weight="600" color={Palette.error}>
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
                  <Txt variant="caption" color={Palette.gray500}>
                    {m.time} · 탄 {m.carb} · 단 {m.protein} · 지 {m.fat}
                  </Txt>
                </View>
                <Txt variant="body" weight="600" color={Palette.primary}>
                  {m.kcal} kcal
                </Txt>
                <Icon name="chevron-right" size={20} color={Palette.gray300} />
              </Pressable>
            ))}
            {mealType && (
              <Pressable onPress={() => onAddMore(mealType)} style={styles.addMoreBtn}>
                <Icon name="add" size={20} color={Palette.primary} />
                <Txt variant="body" weight="600" color={Palette.primary}>
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
        const color = isSel ? Palette.gray900 : Palette.gray500;
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
              <IconArrowChevron direction="left" size={24} color={Palette.gray700} />
            </Pressable>
            <Txt variant="h2">
              {view.y}년 {view.m + 1}월
            </Txt>
            <Pressable onPress={next} hitSlop={8} style={styles.calNav}>
              <IconArrowChevron size={24} color={Palette.gray700} />
            </Pressable>
          </View>
          <View style={styles.calWeekRow}>
            {DOW_KO.map((w) => (
              <Txt key={w} variant="label" color={Palette.gray500} style={styles.calWeekCell}>
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
                  <View style={[styles.calDay, isSel && { backgroundColor: Palette.primary }]}>
                    <Txt
                      variant="caption"
                      weight={isSel || isToday ? '700' : '400'}
                      color={isSel ? '#FFFFFF' : isToday ? Palette.primary : Palette.gray900}>
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
  // 기록 캘린더(화면 B) 식단 딥링크 — ?date=YYYY-MM-DD로 진입 시 해당 날짜로.
  const params = useLocalSearchParams<{ date?: string }>();
  const [selectedDate, setSelectedDate] = useState(() => params.date ?? isoOf(new Date()));
  useEffect(() => {
    if (params.date && params.date !== selectedDate) setSelectedDate(params.date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.date]);
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


  // 오늘 운동 로그 실연동 — 없으면 STEP_KCAL 폴백
  const workoutLog = useTodayWorkoutLog();
  const wl = workoutLog.data;
  const workoutCtx = wl?.context ?? { source: 'none' as const, goal: 'maintain' as const };
  const hasWorkout = wl?.hasWorkout ?? false;
  const burnedKcal = wl?.burnedKcal ?? STEP_KCAL;
  const workoutMin = wl?.durationMin ?? 0;
  const focusMacro: 'protein' | 'carb' | null = !workoutCtx.part
    ? null
    : workoutCtx.part === 'cardio'
    ? 'carb'
    : 'protein';

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
          workoutCtx.goal,
        )
      : null;
    const protein = profile ? proteinTargetFromProfile(profile.weight) : null;
    return generateGuide(workoutCtx, { kcal, protein });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, workoutCtx.goal, workoutCtx.part]);

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
  const energyTarget = calorieGoal + burnedKcal;
  const intakeRatio = energyTarget > 0 ? totals.kcal / energyTarget : 0;
  const energyStatus = balanceStatus(intakeRatio);

  // 헤더 한 줄 코멘트 — 운동 상태(운동 대비 섭취) + 식단 상태(매크로 균형)에 따라 변동
  const partLabel = workoutCtx.part ? PART_LABEL[workoutCtx.part] : null;
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
  const recContext = workoutCtx.part ? `${PART_LABEL[workoutCtx.part]} 운동 회복` : undefined;
  const recDeficits = deficitLines.map((d) => ({ label: d.label, g: nextMealG(d.g) }));
  const recommend = useRecommend(recDeficits, recContext);

  const dailyFbContext = workoutCtx.part ? `${PART_LABEL[workoutCtx.part]} 운동` : undefined;
  const dailyFeedback = useDailyFeedback(totals, target, meals, burnedKcal, dailyFbContext, selectedDate);

  function noLogTimeMsg(): string {
    const h = new Date().getHours();
    if (h >= 6 && h < 11) return '아침은 가볍게 삶은 계란 어떨까요?';
    if (h >= 11 && h < 14) return '점심은 드셔야죠! 어떤 걸 드신지 기록해주세요';
    if (h >= 18 && h < 22) return '저녁까지 아무것도 안 드셨나요? 바빠도 단백질 위주로 먹어봐요';
    return '오늘 첫 끼니를 기록하면 핏쌤이 분석해드려요';
  }

  function handleSave(meal: Omit<Meal, 'id' | 'time'>, eatenAt: Date) {
    addMeal.mutate({ ...meal, eatenAt });
  }

  const [showMyPanel, setShowMyPanel] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showCoach, setShowCoach] = useState(false);
  const [coachInitialMsg, setCoachInitialMsg] = useState<string | undefined>(undefined);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <GnbBar onMenu={() => setShowMyPanel(true)} onCalendar={() => setShowCalendar(true)} />
        <View style={styles.scrollWrap}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* ① 운동 맞춤 식단 가이드 — 게이지 + 매크로 + 버튼 */}
          <Card style={styles.guideCard}>
            <View style={styles.guideHead}>
              <SemiGauge ratio={intakeRatio} status={energyStatus} active={hasLog} />
              <View style={styles.guideTitleWrap}>
                <Txt variant="body" color={Palette.gray500}>
                  {stateHint}
                </Txt>
              </View>
            </View>
            <View style={styles.macroRow}>
              {MACRO_META.map((m) => (
                <MacroProgress
                  key={m.key}
                  label={m.label}
                  value={totals[m.key]}
                  goal={target[m.key]}
                  focused={focusMacro === m.key}
                  caption={focusMacro === m.key && focusMacro ? FOCUS_CAPTION[focusMacro] : undefined}
                />
              ))}
            </View>
            <View style={styles.guideBtnRow}>
              <Pressable
                style={styles.guideOutlineBtn}
                onPress={() => { setCoachInitialMsg('오늘 식단 추천해줘'); setShowCoach(true); }}>
                <Txt variant="body" weight="700" color={Palette.primary}>식단 추천</Txt>
              </Pressable>
              <Pressable
                onPress={() => openRecord()}
                style={({ pressed }) => [
                  styles.guideFillBtn,
                  { backgroundColor: pressed ? Palette.primaryPressed : Palette.primary },
                ]}>
                <Txt variant="body" weight="700" color="#FFFFFF">식단 등록</Txt>
                <Icon name="add" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </Card>

          {/* ② 핏쌤의 한 마디 — 오늘 식단 AI 피드백 */}
          <CoachTipCard>
            {!hasLog ? (
              <Txt variant="body" color={Palette.gray700}>{noLogTimeMsg()}</Txt>
            ) : dailyFeedback.isPending ? (
              <View style={styles.recLoading}>
                <ActivityIndicator size="small" color={Palette.primary} />
                <Txt variant="caption" color={Palette.gray500}>오늘 식단을 분석하고 있어요…</Txt>
              </View>
            ) : dailyFeedback.data ? (
              (() => {
                const { title, body } = splitCoach(dailyFeedback.data);
                return (
                  <>
                    {title ? <Txt variant="body" weight="700" color={Palette.gray900} numberOfLines={2}>{title}</Txt> : null}
                    {body ? <Txt variant="body" color={Palette.gray700}>{body}</Txt> : null}
                  </>
                );
              })()
            ) : null}
          </CoachTipCard>

          {/* ③ 오늘 어떤 거 드셨나요? */}
          <Txt variant="h2" weight="700" color={Palette.gray900} style={styles.sectionQHeader}>
            오늘 어떤 거 드셨나요?
          </Txt>

          {/* ④ 섭취 칼로리 + 끼니별 슬롯 */}
          <Card style={{ gap: 0 }}>
            <View style={styles.kcalHead}>
              <View style={styles.flex1}>
                <Txt variant="body" color={Palette.gray500}>
                  {over
                    ? `${(-remaining).toLocaleString()}kcal 초과예요`
                    : `${remaining.toLocaleString()}kcal 더 먹어도 돼요`}
                </Txt>
                <View style={styles.kcalBig}>
                  <Txt variant="h1" weight="700">
                    {totals.kcal.toLocaleString()}
                  </Txt>
                  <Txt variant="body" color={Palette.gray500}>
                    {' '}
                    / {calorieGoal.toLocaleString()}kcal
                  </Txt>
                  <Icon name="info" size={16} color={Palette.gray300} style={styles.infoIcon} />
                </View>
              </View>
            </View>
            <CalorieBar consumed={totals.kcal} goal={calorieGoal} burned={burnedKcal} />
            {isLoading ? (
              <View style={styles.listState}>
                <ActivityIndicator color={Palette.primary} />
                <Txt variant="caption" color={Palette.gray500}>
                  기록을 불러오는 중…
                </Txt>
              </View>
            ) : isError ? (
              <View style={styles.listState}>
                <Txt variant="caption" color={Palette.gray500}>
                  기록을 불러오지 못했어요.
                </Txt>
                <Pressable onPress={() => refetch()} hitSlop={8}>
                  <Txt variant="caption" weight="600" color={Palette.primary}>
                    다시 시도
                  </Txt>
                </Pressable>
              </View>
            ) : (
              <View style={styles.slotGrid}>
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

      {/* FAB — AI 코치 */}
      <Pressable
        onPress={() => setShowCoach(true)}
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
        accessibilityLabel="AI 코치 열기">
        <Image source={require('../../assets/images/Chat_floting.png')} style={{ width: 62, height: 62 }} resizeMode="contain" />
      </Pressable>

      <RecordModal
        visible={modalOpen}
        initialMealType={modalMealType}
        target={target}
        totals={totals}
        focusMacro={focusMacro}
        burnedKcal={burnedKcal}
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
      <Modal
        visible={showCalendar}
        animationType="slide"
        presentationStyle={sheetPresentation}
        onRequestClose={() => setShowCalendar(false)}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <MonthCalendar onClose={() => setShowCalendar(false)} />
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showMyPanel}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMyPanel(false)}>
        <MyPanel onClose={() => setShowMyPanel(false)} />
      </Modal>

      <Modal
        visible={showCoach}
        animationType="slide"
        presentationStyle={sheetPresentation}
        onRequestClose={() => { setShowCoach(false); setCoachInitialMsg(undefined); }}>
        <CoachChat
          onClose={() => { setShowCoach(false); setCoachInitialMsg(undefined); }}
          initialMessage={coachInitialMsg}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.bgBase },
  safeArea: { flex: 1, width: '100%', maxWidth: 800, alignSelf: 'center', backgroundColor: Palette.bgBase },

  // 날짜 스트립 (하단 선 없음, 아래 영역과 24px 간격)
  dateStrip: { flexGrow: 0, backgroundColor: Palette.bgBase },
  dateStripContent: { paddingHorizontal: Spacing.sm, alignItems: 'center' },

  // 오늘 운동 요약 (날짜 바로 아래, 아주 작게)
  workoutBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.bgMuted,
    borderRadius: Radius.button,
    paddingVertical: Spacing.sm,
  },
  workoutLead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md },
  workoutCell: { flex: 1, alignItems: 'center' },
  workoutDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: Palette.lineStrong, marginVertical: 4 },

  // 스크롤 영역 + 상단 페이드
  scrollWrap: { flex: 1, position: 'relative' },
  fadeTop: { position: 'absolute', top: 0, left: 0, right: 0, height: Spacing.md, zIndex: 2 },
  dateItem: {
    width: DATE_ITEM_W,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingVertical: Spacing.sm,
  },

  // 달력 팝업
  calBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  calCard: { width: '100%', maxWidth: 360, backgroundColor: Palette.bgSurface, borderRadius: Radius.modal, padding: Spacing.lg, gap: Spacing.md },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calNav: { padding: Spacing.xs },
  calWeekRow: { flexDirection: 'row' },
  calWeekCell: { width: `${100 / 7}%`, textAlign: 'center' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xs },
  calDay: { width: 36, height: 36, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  // paddingTop = FadeTop 높이(Spacing.md) → 첫 콘텐츠가 그라데이션 아래에서 시작(가림 방지)
  scroll: { paddingHorizontal: ScreenPadding, paddingTop: GNB_HEIGHT, paddingBottom: NAV_HEIGHT + Spacing.xxl + Spacing.md },
  flex1: { flex: 1 },

  card: {
    backgroundColor: Palette.bgSurface,
    borderRadius: Radius.card,
    borderWidth: 0.5,
    borderColor: Palette.lineDefault,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...Elevation.level1,
  },

  // 가이드 헤더
  aiHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  guideCard: { padding: Spacing.lg, gap: Spacing.md },
  // 가이드 카드 ↔ 이 카드 사이 여백 8px (스크롤 gap 16 - 8)
  aiRecCard: { marginTop: -Spacing.sm },
  // 가이드 카드 헤더 — 게이지 + '오늘의 식단' 타이틀을 상단 중앙 정렬 (여백 넉넉히)
  guideHead: { alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.sm, paddingBottom: 0 },
  // 타이틀 ↔ 코멘트는 바짝 붙임
  guideTitleWrap: { alignItems: 'center', gap: 2 },

  // 반원형 게이지
  gaugeWrap: { position: 'relative', alignItems: 'center', justifyContent: 'flex-end' },
  gaugeLabel: { position: 'absolute', bottom: 2, left: 0, right: 0, alignItems: 'center' },

  // 목표 매크로
  macroRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  // 각 매크로를 테두리만(배경 없음) 박스로
  macroCol: {
    flex: 1,
    gap: 2,
    borderWidth: 1,
    borderColor: Palette.lineDefault,
    borderRadius: Radius.small,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  macroValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  macroBar: { marginTop: Spacing.xs },
  rangeBarWrap: { position: 'relative', height: 6 },
  rangeBarTrack: { position: 'absolute', left: 0, right: 0, height: 6, borderRadius: Radius.full, backgroundColor: Palette.gray100 },
  rangeBarFill: { position: 'absolute', left: 0, height: 6, borderRadius: Radius.full },
  rangeBarGoalLine: { position: 'absolute', right: 0, top: -2, bottom: -2, width: 2, borderRadius: 1, backgroundColor: Palette.gray400 },
  rangeLabels: { position: 'relative', height: 14, marginTop: 2 },

  // progress
  track: { height: 6, borderRadius: Radius.full, backgroundColor: Palette.gray100, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.full },

  sectionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Palette.lineDefault, marginTop: Spacing.lg },

  // 트레이너 AI 피드백 (리뷰 화면)
  coachCard: {
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.card,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  coachHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  coachAvatar: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: Palette.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachLoading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  coachTag: { backgroundColor: Palette.bgSurface, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  resultCoachWrap: { gap: Spacing.xs, marginTop: Spacing.sm },
  resultCoachAvatarRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  resultCoachAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: Palette.primaryLight, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  resultCoachAvatarImg: { width: 28, height: 28 },
  resultCoachBubble: { backgroundColor: Palette.primary, borderRadius: Radius.card, borderTopLeftRadius: Radius.small, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs },

  // 메모 남기기 (결과 화면)
  memoSection: { gap: Spacing.xs },
  memoBox: { backgroundColor: Palette.bgMuted, borderRadius: Radius.card, padding: Spacing.md, minHeight: 110 },
  memoInput: { flex: 1, minHeight: 64, ...Typography.body, color: Palette.gray900, textAlignVertical: 'top' },
  memoCounter: { alignSelf: 'flex-end', marginTop: Spacing.xs },

  // 저장 후 결과 화면 — 운동 효과 점수 상승 (카드 + 그래프)
  scoreCard: {
    backgroundColor: Palette.bgSurface,
    borderRadius: Radius.card,
    borderWidth: 0.5,
    borderColor: Palette.lineDefault,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Elevation.level1,
  },
  scoreHero: { alignItems: 'center', gap: Spacing.xs },
  scoreHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  scoreDelta: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  scoreDeltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 3,
    borderRadius: Radius.button,
  },
  resultKcalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultMacroInline: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  resultMacroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ratioBarWrap: { gap: Spacing.xs },
  ratioBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  ratioSegment: { height: 8 },
  ratioLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  graphWrap: { gap: Spacing.xs },
  graphLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  resultSection: { gap: 2 },
  kcalContrib: { gap: 2 },
  nextMealSection: { gap: Spacing.sm },
  nextMealRow: { flexDirection: 'row', gap: Spacing.sm },
  nextMealCard: {
    flex: 1,
    backgroundColor: Palette.bgMuted,
    borderRadius: Radius.card,
    padding: Spacing.md,
    gap: Spacing.xs,
    alignItems: 'center',
  },
  nextMealIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.card,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  resultMacroHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  resultDot: { width: 8, height: 8, borderRadius: 4 },
  resultBtns: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: ScreenPadding,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.lineDefault,
  },
  resultSecondaryBtn: {
    flex: 1,
    height: 52,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Palette.lineDefault,
    backgroundColor: Palette.bgSurface,
  },
  resultPrimaryBtn: { flex: 1, height: 52, borderRadius: Radius.button, alignItems: 'center', justifyContent: 'center' },

  // 끼니 상세/수정 모달
  slotDetailBody: { paddingHorizontal: ScreenPadding, paddingTop: Spacing.sm, paddingBottom: Spacing.xxl },
  slotEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.lineDefault,
  },
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Palette.primary,
    backgroundColor: Palette.primaryLight,
  },
  editCol: { gap: Spacing.xs },
  editRow: { flexDirection: 'row', gap: Spacing.sm },
  editInput: {
    height: 48,
    borderRadius: Radius.button,
    backgroundColor: Palette.bgMuted,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    color: Palette.gray900,
  },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.md, marginTop: Spacing.xs },

  // 코칭 — 부족 영양소 + 추천 식품 칩
  deficitList: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  deficitRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  recLoading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  comboList: { gap: Spacing.sm },
  comboChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.button,
    backgroundColor: Palette.bgMuted,
  },
  foodChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xs },
  foodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: 12,
    paddingRight: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Palette.lineStrong,
    backgroundColor: 'transparent',
  },
  chipAdd: { marginLeft: 2 },

  // 칼로리
  kcalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  kcalBig: { flexDirection: 'row', alignItems: 'flex-end', marginTop: Spacing.xs },
  infoIcon: { marginLeft: Spacing.xs, marginBottom: 3 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Palette.gray900,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  // 칼로리 그라데이션 바
  calBarWrap: { position: 'relative', marginTop: Spacing.sm },
  calTrack: { height: 12, borderRadius: Radius.full, backgroundColor: Palette.gray100, overflow: 'hidden' },
  calMarker: {
    position: 'absolute',
    top: -2,
    width: 0,
    height: 16,
    borderLeftWidth: 1,
    borderStyle: 'dashed',
    borderColor: Palette.gray300,
  },
  calLabels: { position: 'relative', height: 16, marginTop: Spacing.xs },
  calLabelAnchor: { position: 'absolute' },
  // '활동 전'은 마커에서 왼쪽으로(우측정렬), '활동 후'는 오른쪽 끝 → 겹침 방지
  calLabelCentered: { width: 40, textAlign: 'right', marginLeft: -40, paddingRight: 4 },
  calLabelRight: { position: 'absolute', right: 0 },

  // list
  listHead: { marginTop: Spacing.xs, marginLeft: Spacing.xs, marginBottom: -Spacing.sm },
  listHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    marginHorizontal: Spacing.xs,
    marginBottom: -Spacing.sm,
  },
  addMealBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  slotList: { gap: Spacing.sm },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.card,
  },
  slotCard: {
    width: '48.5%',
    backgroundColor: Palette.bgSurface,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Palette.lineDefault,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  slotAddCorner: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: Palette.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotIconWrap: { justifyContent: 'flex-start', alignItems: 'flex-start' },
  slotIconCircle: {
    width: 56,
    height: 56,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotInfo: { gap: 2 },
  slotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Palette.successLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  // 섹션 위 여백 32px (스크롤 gap 16 + marginTop 16)
  kcalTitle: { marginTop: Spacing.md, marginLeft: Spacing.xs, marginBottom: -Spacing.sm },
  listCard: { paddingVertical: 0 },
  listState: { alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Palette.lineDefault },
  mealRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, paddingVertical: Spacing.md },
  mealLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  mealRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  mealTag: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.small, backgroundColor: Palette.gray100 },
  mealInfo: { flex: 1, gap: 2 },
  mealMacros: { paddingBottom: Spacing.md, paddingLeft: Spacing.xs },

  // FAB

  // 모달
  // 기록 모달 (전체 화면 + 탭)
  recScreen: { flex: 1, backgroundColor: Palette.bgBase, width: '100%', maxWidth: 800, alignSelf: 'center' },
  recHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ScreenPadding,
    paddingVertical: Spacing.md,
  },
  recHeaderBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  recTabBar: {
    flexDirection: 'row',
    paddingHorizontal: ScreenPadding,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.lineDefault,
  },
  recTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    position: 'relative',
  },
  recTabIndicator: {
    position: 'absolute',
    bottom: -StyleSheet.hairlineWidth,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Palette.primary,
  },
  photoArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingHorizontal: ScreenPadding },
  photoBtn: {
    width: 96,
    height: 96,
    borderRadius: Radius.card,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  photoBtnRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  photoAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Palette.primary,
    backgroundColor: Palette.primaryLight,
  },
  tabForm: { flex: 1, paddingHorizontal: ScreenPadding, paddingTop: Spacing.lg, gap: Spacing.md },
  textArea: {
    minHeight: 120,
    borderRadius: Radius.card,
    backgroundColor: Palette.bgMuted,
    padding: Spacing.md,
    fontSize: 18,
    lineHeight: 26,
    color: Palette.gray900,
    textAlignVertical: 'top',
  },
  gramsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  gramsInput: { width: 96 },
  gramsInputText: { textAlign: 'right' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 48,
    borderRadius: Radius.button,
    backgroundColor: Palette.bgSurface,
    paddingHorizontal: Spacing.md,
  },
  searchInput: { flex: 1, fontSize: 16, color: Palette.gray900 },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.lineDefault,
  },
  searchEmpty: { textAlign: 'center', paddingVertical: Spacing.xl, alignItems: 'center' },
  starBtn: { padding: Spacing.xs },

  analyzing: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xxl },

  // 카메라 화면
  cameraBottomBar: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingTop: Spacing.lg,
    gap: Spacing.lg,
  },
  cameraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ScreenPadding,
    paddingBottom: Spacing.lg,
  },
  shutterBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  galleryArea: { flex: 1, alignItems: 'flex-end' },
  galleryBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(60,60,60,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraDenied: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingHorizontal: ScreenPadding * 2,
  },
  cameraPermBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.button,
    backgroundColor: Palette.primary,
    marginTop: Spacing.sm,
  },
  cameraErrorText: { textAlign: 'center', paddingHorizontal: ScreenPadding, paddingBottom: Spacing.sm },

  // 리뷰 화면 — 여백 넉넉히
  reviewBody: { paddingHorizontal: ScreenPadding, paddingTop: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.sm },
  reviewCard: {
    backgroundColor: Palette.bgMuted,
    borderRadius: Radius.card,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    alignItems: 'center',
  },
  center: { textAlign: 'center' },
  estimateRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  reviewKcal: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm, marginTop: Spacing.xs },
  reviewKcalNum: { fontSize: 44, lineHeight: 52 },
  // 리뷰 값 직접 편집
  reviewEditBtn: { position: 'absolute', top: Spacing.md, right: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: 2, zIndex: 1 },
  reviewNameInput: { minWidth: 160 },
  reviewNameInputText: { fontSize: 20, fontWeight: '700', color: Palette.gray900, textAlign: 'center' },
  reviewKcalInput: { minWidth: 96 },
  reviewKcalInputText: { fontSize: 32, fontWeight: '700', color: Palette.primary, textAlign: 'center' },
  reviewMacroInput: { minWidth: 56 },
  reviewMacroInputText: { fontSize: 16, fontWeight: '600', color: Palette.gray900, textAlign: 'center' },

  // 리뷰 화면 재설계 — 음식 카드
  reviewFoodCard: {
    backgroundColor: Palette.bgSurface,
    borderRadius: Radius.card,
    borderWidth: 0.5,
    borderColor: Palette.lineDefault,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Elevation.level1,
  },
  reviewFoodTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  reviewFoodImg: {
    width: 64,
    height: 64,
    borderRadius: Radius.small,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  reviewFoodImgPhoto: {
    width: 64,
    height: 64,
  },
  reviewFoodInfo: { flex: 1, gap: 4 },
  reviewFoodNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  reviewAiBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: Radius.small,
    backgroundColor: Palette.primaryLight,
  },
  reviewActionBtns: { flexDirection: 'column', alignItems: 'flex-end', gap: Spacing.xs },
  reviewEditBtnTop: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: Spacing.xs },
  reviewStepperRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  reviewStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Palette.lineDefault,
    borderRadius: Radius.button,
    overflow: 'hidden',
  },
  stepperBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepperNum: { minWidth: 36, textAlign: 'center' },
  stepperUnit: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: Palette.lineDefault,
    borderRadius: Radius.button,
    gap: 2,
  },

  // 리뷰 화면 재설계 — 영양 카드
  reviewNutrCard: {
    backgroundColor: Palette.bgSurface,
    borderRadius: Radius.card,
    borderWidth: 0.5,
    borderColor: Palette.lineDefault,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...Elevation.level1,
  },
  reviewNutrKcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs, flexWrap: 'wrap' },
  dailyPctBadge: {
    marginLeft: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: Palette.primaryLight,
  },
  nutriDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    paddingTop: Spacing.xs,
  },

  // 리뷰 화면 재설계 — AI 피드백 버블
  reviewFeedbackBubble: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.card,
    padding: Spacing.md,
  },

  // 리뷰 화면 재설계 — 식사 시간 행
  mealTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: Palette.lineDefault,
    borderRadius: Radius.button,
    backgroundColor: Palette.bgSurface,
  },

  chipRow: { flexDirection: 'row', gap: Spacing.sm },
  mealChip: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.full, borderWidth: 1 },

  primaryBtn: { height: 52, borderRadius: Radius.button, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },

  timePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.lineDefault,
    borderRadius: Radius.button,
    backgroundColor: Palette.bgSurface,
  },
  timePickerGroup: { alignItems: 'center', gap: Spacing.xs },
  timePickerArrow: { padding: Spacing.xs },
  timePickerDone: {
    position: 'absolute',
    right: Spacing.md,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Palette.primaryLight,
  },
  nutriDetailSection: {
    backgroundColor: Palette.bgSurface,
    borderRadius: Radius.card,
    borderWidth: 0.5,
    borderColor: Palette.lineDefault,
    padding: Spacing.lg,
    gap: 0,
    ...Elevation.level1,
  },
  nutriDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.lineDefault,
  },
  nutriDetailToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  unitDropdown: {
    alignSelf: 'flex-end',
    minWidth: 72,
    backgroundColor: Palette.bgSurface,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Palette.lineDefault,
    overflow: 'hidden',
    ...Elevation.level1,
  },
  unitOption: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    right: ScreenPadding,
    bottom: BottomTabInset + Spacing.md,
    width: 62,
    height: 62,
  },
  guideBtnRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  guideOutlineBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Palette.primary,
    backgroundColor: 'transparent',
  },
  guideFillBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  sectionQHeader: {
    fontSize: 18,
    marginHorizontal: Spacing.xs,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs + Spacing.sm,
  },
});