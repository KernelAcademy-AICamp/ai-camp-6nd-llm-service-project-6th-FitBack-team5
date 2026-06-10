import { MaterialIcons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useProfile } from '@/features/auth/useProfile';
import {
  MOCK_CONTEXT,
  calorieTargetFromProfile,
  generateGuide,
  proteinTargetFromProfile,
} from '@/features/diet/guide';
import {
  MEAL_TYPES,
  useAddMeal,
  useMeals,
  type InputMethod,
  type Meal,
  type MealType,
} from '@/features/diet/useMeals';

/**
 * 식단 탭 — design.md 디자인 시스템 적용. UI 가안 구현본.
 *
 * 핵심 가치: "추천 대비 회복 목표 달성률"이 1순위 정보 (얼마나 먹었나가 아님).
 * 구성: ① 운동 맞춤 식단 가이드(회복 달성률 + 목표 매크로 + 운동 대비 섭취 상태)
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

const BURNED_KCAL = 420; // 운동 소모 칼로리 (운동 데이터 연계, 가데이터)

// 탄단지 표시 정의 (순서: 단 → 탄 → 지). 목표 값은 가이드(guide.target)에서 가져온다.
const MACRO_META = [
  { key: 'protein', label: '단백질' },
  { key: 'carb', label: '탄수화물' },
  { key: 'fat', label: '지방' },
] as const;

const FAKE_RESULTS: Omit<Meal, 'id' | 'mealType' | 'time' | 'inputMethod'>[] = [
  { name: '현미밥 + 고등어구이', kcal: 620, carb: 78, protein: 32, fat: 18 },
  { name: '된장찌개 + 공깃밥', kcal: 480, carb: 72, protein: 16, fat: 10 },
  { name: '불고기 정식', kcal: 720, carb: 60, protein: 38, fat: 28 },
  { name: '연어 포케볼', kcal: 540, carb: 55, protein: 34, fat: 16 },
];

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
      <Txt variant="label" color={D.gray500}>
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

// 부족 ← 적정 → 과다 밸런스 미터. 식단 기록 전(showMarker=false)에는 마커를 숨긴다.
function BalanceMeter({ ratio, showMarker }: { ratio: number; showMarker: boolean }) {
  const pos = Math.min(Math.max(ratio / 1.5, 0), 1) * 100;
  return (
    <View style={styles.meterWrap}>
      <View style={styles.meterTrackWrap}>
        <View style={styles.meterTrack} />
        {showMarker && <View style={[styles.meterMarker, { left: `${pos}%` }]} />}
      </View>
      <View style={styles.meterLabels}>
        <Txt variant="label" color={D.gray500}>부족</Txt>
        <Txt variant="label" color={D.gray500}>적정</Txt>
        <Txt variant="label" color={D.gray500}>과다</Txt>
      </View>
    </View>
  );
}

// 반원형 게이지 — SVG 반원 아크. 0~100% → 좌→우 채움.
function SemiGauge({ pct }: { pct: number }) {
  const W = 104;
  const SW = 9; // 아크 두께
  const r = (W - SW) / 2;
  const cx = W / 2;
  const cy = r + SW / 2;
  const H = cy + SW / 2;
  const p = Math.min(Math.max(pct, 0), 100) / 100;
  const theta = Math.PI * (1 - p); // 좌(π) → 우(0)
  const ex = cx + r * Math.cos(theta);
  const ey = cy - r * Math.sin(theta);
  const track = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const prog = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
  return (
    <View style={[styles.gaugeWrap, { width: W, height: H }]}>
      <Svg width={W} height={H}>
        <Path d={track} stroke={D.gray100} strokeWidth={SW} fill="none" strokeLinecap="round" />
        {p > 0 && (
          <Path d={prog} stroke={D.primary} strokeWidth={SW} fill="none" strokeLinecap="round" />
        )}
      </Svg>
      <View style={styles.gaugeLabel}>
        <Txt variant="h1">{Math.round(pct)}%</Txt>
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

function MealRow({ item }: { item: Meal }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => setOpen((o) => !o)}>
      <View style={styles.mealRow}>
        <View style={styles.mealLeft}>
          <View style={styles.mealTag}>
            <Txt variant="label" color={D.gray700}>
              {item.mealType}
            </Txt>
          </View>
          <View style={styles.mealInfo}>
            <Txt variant="body" numberOfLines={1}>
              {item.name}
            </Txt>
            <Txt variant="caption" color={D.gray500}>
              {item.time}
            </Txt>
          </View>
        </View>
        <View style={styles.mealRight}>
          <Txt variant="body" weight="600">
            {item.kcal} kcal
          </Txt>
          <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={20} color={D.gray300} />
        </View>
      </View>
      {open && (
        <View style={styles.mealMacros}>
          <Txt variant="caption" color={D.gray500}>
            탄 {item.carb}g · 단 {item.protein}g · 지 {item.fat}g
          </Txt>
        </View>
      )}
    </Pressable>
  );
}

// ── 기록 플로우 모달 ────────────────────────────────────────
type RecordStep = 'method' | 'text' | 'analyzing' | 'review';

function MethodButton({
  icon,
  title,
  desc,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  title: string;
  desc: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.methodBtn, pressed && { backgroundColor: D.primaryLight }]}>
      <View style={styles.methodIconBox}>
        <MaterialIcons name={icon} size={24} color={D.primary} />
      </View>
      <View style={styles.methodText}>
        <Txt variant="body" weight="600">
          {title}
        </Txt>
        <Txt variant="caption" color={D.gray500}>
          {desc}
        </Txt>
      </View>
      <MaterialIcons name="chevron-right" size={24} color={D.gray300} />
    </Pressable>
  );
}

function RecordModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (meal: Omit<Meal, 'id' | 'time'>) => void;
}) {
  const [step, setStep] = useState<RecordStep>('method');
  const [textInput, setTextInput] = useState('');
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState<Omit<Meal, 'id' | 'time'> | null>(null);

  function close() {
    setStep('method');
    setTextInput('');
    setDraft(null);
    onClose();
  }

  function analyze(method: InputMethod, nameHint?: string) {
    setStep('analyzing');
    const picked = FAKE_RESULTS[nameHint ? nameHint.length % FAKE_RESULTS.length : 0];
    const result: Omit<Meal, 'id' | 'time'> = {
      mealType: currentMealType(),
      name: nameHint?.trim() || picked.name,
      kcal: picked.kcal,
      carb: picked.carb,
      protein: picked.protein,
      fat: picked.fat,
      inputMethod: method,
    };
    setTimeout(() => {
      setDraft(result);
      setStep('review');
    }, 1200);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Txt variant="h2">{step === 'review' ? 'AI 분석 결과' : '식단 기록'}</Txt>
            <Pressable onPress={close} hitSlop={12} style={styles.closeBtn}>
              <MaterialIcons name="close" size={24} color={D.gray500} />
            </Pressable>
          </View>

          {step === 'method' && (
            <View style={styles.methodList}>
              <Txt variant="caption" color={D.gray500}>
                어떻게 기록할까요?
              </Txt>
              <MethodButton icon="photo-camera" title="사진 촬영" desc="음식을 촬영하면 AI가 인식해요." onPress={() => analyze('image')} />
              <MethodButton icon="photo-library" title="갤러리 업로드" desc="저장된 사진을 불러와요." onPress={() => analyze('image')} />
              <MethodButton icon="edit" title="텍스트 입력" desc="음식명을 직접 입력해요." onPress={() => setStep('text')} />
            </View>
          )}

          {step === 'text' && (
            <View style={styles.methodList}>
              <Txt variant="caption" color={D.gray500}>
                무엇을 드셨어요?
              </Txt>
              <TextInput
                value={textInput}
                onChangeText={setTextInput}
                placeholder="예: 김치찌개, 공깃밥"
                placeholderTextColor={D.gray300}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                style={[
                  styles.input,
                  focused && { borderColor: D.primary, borderWidth: 1.5, backgroundColor: D.primaryLight },
                ]}
                autoFocus
                onSubmitEditing={() => textInput.trim() && analyze('manual', textInput)}
              />
              <PrimaryButton label="AI 분석" disabled={!textInput.trim()} onPress={() => analyze('manual', textInput)} />
            </View>
          )}

          {step === 'analyzing' && (
            <View style={styles.analyzing}>
              <ActivityIndicator size="large" color={D.primary} />
              <Txt variant="body">AI가 음식을 분석하고 있어요</Txt>
              <Txt variant="caption" color={D.gray500}>
                음식 인식 · 칼로리 추정 · 탄단지 분석
              </Txt>
            </View>
          )}

          {step === 'review' && draft && (
            <ScrollView contentContainerStyle={styles.reviewBody} showsVerticalScrollIndicator={false}>
              <View style={styles.reviewCard}>
                <Txt variant="h2" style={styles.center}>
                  {draft.name}
                </Txt>
                <View style={styles.estimateRow}>
                  <MaterialIcons name="info-outline" size={14} color={D.gray500} />
                  <Txt variant="caption" color={D.gray500}>
                    추정값이에요. 확인 후 저장하세요.
                  </Txt>
                </View>
                <View style={styles.reviewKcal}>
                  <Txt variant="display" color={D.primary} style={{ fontSize: 44, lineHeight: 52 }}>
                    {draft.kcal}
                  </Txt>
                  <Txt variant="caption" color={D.gray500}>
                    kcal
                  </Txt>
                </View>
                <View style={styles.reviewMacros}>
                  <ReviewMacro label="탄수화물" value={draft.carb} />
                  <ReviewMacro label="단백질" value={draft.protein} />
                  <ReviewMacro label="지방" value={draft.fat} />
                </View>
              </View>

              <Txt variant="caption" color={D.gray500}>
                끼니
              </Txt>
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
                      <Txt variant="caption" weight="600" color={selected ? D.primary : D.gray700}>
                        {t}
                      </Txt>
                    </Pressable>
                  );
                })}
              </View>

              <PrimaryButton label="저장하기" onPress={() => draft && (onSave(draft), close())} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function ReviewMacro({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.reviewMacro}>
      <Txt variant="body" weight="600">
        {value} g
      </Txt>
      <Txt variant="label" color={D.gray500}>
        {label}
      </Txt>
    </View>
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
            {isSel && <MaterialIcons name="keyboard-arrow-down" size={16} color={color} />}
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
              <MaterialIcons name="chevron-left" size={24} color={D.gray700} />
            </Pressable>
            <Txt variant="h2">
              {view.y}년 {view.m + 1}월
            </Txt>
            <Pressable onPress={next} hitSlop={8} style={styles.calNav}>
              <MaterialIcons name="chevron-right" size={24} color={D.gray700} />
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
  const [modalOpen, setModalOpen] = useState(false);

  const isToday = selectedDate === isoOf(new Date());
  const selDate = parseIso(selectedDate);
  const dateLabel = `${selDate.getMonth() + 1}월 ${selDate.getDate()}일 ${DOW_KO[selDate.getDay()]}요일`;

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

  // 회복 목표 달성률 — 단·탄·지 달성률 평균(%)
  const recoveryPct = Math.round(
    ((totals.protein / target.protein + totals.carb / target.carb + totals.fat / target.fat) / 3) * 100,
  );

  const calorieGoal = target.kcal;
  const remaining = calorieGoal - totals.kcal;
  const over = remaining < 0;
  const net = totals.kcal - BURNED_KCAL;
  const netRatio = net / calorieGoal;
  const energyStatus = balanceStatus(netRatio);
  const proteinRemain = Math.max(0, target.protein - totals.protein);
  const proteinDone = proteinRemain === 0;

  // 사용자 상태별 추천 (첫 식사 → 단백질 / 유산소 → 탄수화물 / 근력 → 단백질)
  const coach = ((): { headline: string; foods: string[] } => {
    if (proteinDone)
      return { headline: '오늘 단백질 목표를 채웠어요. 충분히 회복할 수 있어요.', foods: [] };
    if (!hasLog)
      return { headline: '첫 식사는 가벼운 단백질 식단 추천드려요', foods: ['닭가슴살', '그릭요거트', '계란'] };
    if (MOCK_CONTEXT.part === 'cardio')
      return { headline: '유산소 운동엔 탄수화물로 에너지를 채워보세요', foods: ['현미밥', '바나나', '고구마'] };
    return { headline: '근력 운동 회복엔 단백질 식단 추천드려요', foods: ['닭가슴살', '소고기', '두부'] };
  })();

  function handleSave(meal: Omit<Meal, 'id' | 'time'>) {
    addMeal.mutate(meal);
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <DateStrip
          selected={selectedDate}
          onSelect={setSelectedDate}
          onOpenCalendar={() => setCalendarOpen(true)}
        />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Txt variant="h1">{isToday ? '오늘의 식단' : '식단 기록'}</Txt>
            <Txt variant="caption" color={D.gray500}>
              {dateLabel}
            </Txt>
          </View>

          {/* ① 운동 맞춤 식단 가이드 — 회복 달성률 + 목표 매크로 + 운동 대비 섭취 상태 */}
          <Card>
            <View style={styles.aiHead}>
              <MaterialIcons name="auto-awesome" size={16} color={D.primary} />
              <Txt variant="label" weight="600" color={D.primary}>
                운동 맞춤 식단 가이드
              </Txt>
            </View>

            <View style={styles.guideHeadRow}>
              <View style={styles.flex1}>
                <Txt variant="h2">회복 목표 달성률</Txt>
                <Txt variant="caption" color={D.gray500}>
                  {hasLog ? '꾸준히 채워가고 있어요' : '오늘 식단을 기록해주세요.'}
                </Txt>
              </View>
              <SemiGauge pct={recoveryPct} />
            </View>

            {/* 목표 매크로 (단 → 탄 → 지) */}
            <View style={styles.macroRow}>
              {MACRO_META.map((m) => (
                <MacroProgress key={m.key} label={m.label} value={totals[m.key]} goal={target[m.key]} />
              ))}
            </View>

            <View style={styles.sectionDivider} />

            {/* 운동 대비 섭취 상태 */}
            <View style={styles.statusHead}>
              <Txt variant="caption" color={D.gray700}>
                운동 대비 섭취 상태
              </Txt>
              {hasLog ? (
                <View style={[styles.statusPill, { backgroundColor: `${energyStatus.color}1A` }]}>
                  <Txt variant="label" weight="700" color={energyStatus.color}>
                    {energyStatus.label}
                  </Txt>
                </View>
              ) : (
                <View style={[styles.statusPill, { backgroundColor: D.gray100 }]}>
                  <Txt variant="label" weight="700" color={D.gray500}>
                    등록 전
                  </Txt>
                </View>
              )}
            </View>
            <BalanceMeter ratio={netRatio} showMarker={hasLog} />
            <Txt variant="caption" color={D.gray500}>
              {hasLog ? energyStatus.desc : '식단을 기록하면 운동 대비 섭취 상태를 알려드려요.'}
            </Txt>
          </Card>

          {/* ② 코칭 — 사용자 상태별 추천 문구 + 추천 식품 */}
          <Card>
            <Txt variant="body" weight="600">
              {coach.headline}
            </Txt>
            {coach.foods.length > 0 && (
              <>
                <Txt variant="caption" color={D.gray500}>
                  식단으로 추천드려요
                </Txt>
                <View style={styles.foodChipWrap}>
                  {coach.foods.map((f) => (
                    <View key={f} style={styles.foodChip}>
                      <MaterialIcons name="add" size={14} color={D.gray500} />
                      <Txt variant="label" weight="600" color={D.gray700}>
                        {f}
                      </Txt>
                    </View>
                  ))}
                </View>
              </>
            )}
          </Card>

          {/* ③ 오늘 섭취 칼로리 */}
          <Card>
            <View style={styles.kcalHead}>
              <Txt variant="caption" color={D.gray500}>
                오늘 섭취 칼로리
              </Txt>
              <Txt variant="caption" color={over ? D.warning : D.gray500}>
                {over
                  ? `${(-remaining).toLocaleString()} 칼로리 초과`
                  : `${remaining.toLocaleString()} 칼로리 남았어요`}
              </Txt>
            </View>
            <View style={styles.kcalBig}>
              <Txt variant="h1">{totals.kcal.toLocaleString()}</Txt>
              <Txt variant="caption" color={D.gray500}>
                {' '}
                / {calorieGoal.toLocaleString()} kcal
              </Txt>
            </View>
            <ProgressBar ratio={totals.kcal / calorieGoal} color={over ? D.warning : D.primary} />
          </Card>

          {/* ④ 오늘 기록 */}
          <Txt variant="label" color={D.gray500} style={styles.listHead}>
            오늘 기록 {meals.length}
          </Txt>
          <Card style={hasLog ? styles.listCard : undefined}>
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
            ) : !hasLog ? (
              <View style={styles.listState}>
                <MaterialIcons name="pause-circle-outline" size={36} color={D.gray300} />
                <Txt variant="body" weight="600" style={styles.center}>
                  오늘 가이드대로 첫 끼를 기록해보세요
                </Txt>
                <Txt variant="caption" color={D.gray500} style={styles.center}>
                  한 끼만 기록해도 회복 달성률이 올라가요
                </Txt>
              </View>
            ) : (
              meals.map((m, i) => (
                <View key={m.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <MealRow item={m} />
                </View>
              ))
            )}
          </Card>
        </ScrollView>

        {/* 식단 기록 (화면 내 유일한 Primary CTA) */}
        <Pressable
          onPress={() => setModalOpen(true)}
          style={({ pressed }) => [styles.fab, { backgroundColor: pressed ? D.primaryPressed : D.primary }]}>
          <MaterialIcons name="add" size={22} color="#FFFFFF" />
          <Txt variant="body" weight="600" color="#FFFFFF">
            식단 기록
          </Txt>
        </Pressable>
      </SafeAreaView>

      <RecordModal visible={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} />
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
  dateStrip: { flexGrow: 0, backgroundColor: D.bgBase, marginBottom: S.md },
  dateStripContent: { paddingHorizontal: S.sm, alignItems: 'center' },
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
  scroll: { paddingHorizontal: SIDE, paddingTop: 0, paddingBottom: NAV_HEIGHT + S.xxl + S.md, gap: S.md },
  header: { gap: S.xs, marginBottom: S.xs },
  flex1: { flex: 1 },

  card: {
    backgroundColor: D.surface,
    borderRadius: R.card,
    borderWidth: 0.5,
    borderColor: D.line,
    padding: S.md,
    gap: S.sm,
    ...LEVEL1,
  },

  // 가이드 헤더
  aiHead: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  guideHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: S.sm },

  // 반원형 게이지
  gaugeWrap: { position: 'relative', alignItems: 'center', justifyContent: 'flex-end' },
  gaugeLabel: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },

  // 목표 매크로
  macroRow: { flexDirection: 'row', gap: S.sm, marginTop: S.xs },
  macroCol: { flex: 1, gap: 2 },
  macroValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  macroBar: { marginTop: S.xs },

  // progress
  track: { height: 6, borderRadius: R.full, backgroundColor: D.gray100, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: R.full },

  sectionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: D.line, marginVertical: S.xs },

  // 운동 대비 섭취 상태
  statusHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusPill: { paddingHorizontal: S.sm, paddingVertical: 2, borderRadius: R.full },

  // 밸런스 미터
  meterWrap: { gap: S.xs, marginTop: S.xs },
  meterTrackWrap: { position: 'relative', justifyContent: 'center' },
  meterTrack: { height: 10, borderRadius: R.full, backgroundColor: D.gray100 },
  meterMarker: {
    position: 'absolute',
    top: -3,
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: D.primary,
    transform: [{ translateX: -2 }],
  },
  meterLabels: { flexDirection: 'row', justifyContent: 'space-between' },

  // 코칭 — 추천 식품 칩
  foodChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, marginTop: S.xs },
  foodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: S.xs,
    borderRadius: R.full,
    borderWidth: 1,
    borderColor: D.lineStrong,
    backgroundColor: 'transparent',
  },

  // 칼로리
  kcalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kcalBig: { flexDirection: 'row', alignItems: 'baseline' },

  // list
  listHead: { marginTop: S.xs, marginLeft: S.xs },
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
  fab: {
    position: 'absolute',
    bottom: NAV_HEIGHT + S.md,
    right: SIDE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.xs,
    height: 52,
    paddingHorizontal: S.lg,
    borderRadius: R.full,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  // 모달
  backdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: D.surface,
    borderTopLeftRadius: R.modal,
    borderTopRightRadius: R.modal,
    padding: S.lg,
    paddingBottom: S.xxl,
    gap: S.md,
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
    maxHeight: '88%',
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  closeBtn: { padding: S.xs },

  methodList: { gap: S.md },
  methodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    padding: S.md,
    borderRadius: R.card,
    borderWidth: 0.5,
    borderColor: D.line,
    backgroundColor: D.surface,
  },
  methodIconBox: {
    width: 44,
    height: 44,
    borderRadius: R.small,
    backgroundColor: D.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodText: { flex: 1, gap: 2 },

  input: {
    height: 52,
    borderRadius: R.small,
    backgroundColor: D.muted,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: S.md,
    fontSize: 16,
    color: D.gray900,
  },

  analyzing: { alignItems: 'center', gap: S.sm, paddingVertical: S.xxl },

  reviewBody: { gap: S.sm },
  reviewCard: {
    backgroundColor: D.muted,
    borderRadius: R.card,
    padding: S.md,
    gap: S.sm,
    alignItems: 'center',
  },
  center: { textAlign: 'center' },
  estimateRow: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  reviewKcal: { flexDirection: 'row', alignItems: 'baseline', gap: S.sm, marginTop: S.xs },
  reviewMacros: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: S.sm },
  reviewMacro: { alignItems: 'center', gap: 2 },

  chipRow: { flexDirection: 'row', gap: S.sm },
  mealChip: { flex: 1, alignItems: 'center', paddingVertical: S.sm, borderRadius: R.full, borderWidth: 1 },

  primaryBtn: { height: 52, borderRadius: R.button, alignItems: 'center', justifyContent: 'center', marginTop: S.sm },
});
