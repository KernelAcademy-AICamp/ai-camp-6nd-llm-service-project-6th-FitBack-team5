import { MaterialIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
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

/**
 * 식단 탭 (프로토타입, 가데이터) — design.md 디자인 시스템 적용
 *
 * 플로우: 식단 기록 → AI 음식 분석 → 데이터 저장 → 운동 데이터 연계
 *        → AI 통합 분석 → AI 코칭 → 대시보드 반영
 *
 * 식단은 운동 데이터와 결합되어 AI 코칭을 제공하기 위한 보조 기능이다.
 */

// ── design.md 토큰 ─────────────────────────────────────────
const D = {
  // Primary
  primary: '#6675FF',
  primaryPressed: '#4957D8',
  primaryLight: '#EEF1FF',
  // Background
  bgBase: '#FAF9F7',
  surface: '#FFFFFF',
  muted: '#F3F4F6',
  // Semantic
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  // Neutral
  gray900: '#111827',
  gray700: '#374151',
  gray500: '#6B7280',
  gray300: '#D1D5DB',
  gray100: '#F3F4F6',
  // Line
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
type MealType = '아침' | '점심' | '저녁' | '간식';
const MEAL_TYPES: MealType[] = ['아침', '점심', '저녁', '간식'];
type InputMethod = 'image' | 'voice' | 'manual';

interface Meal {
  id: string;
  mealType: MealType;
  name: string;
  kcal: number;
  carb: number;
  protein: number;
  fat: number;
  time: string;
  inputMethod: InputMethod;
}

// 목표 (PRD: 칼로리 = 체중 × 활동계수, 단백질 = 체중 × 1.5g)
// 탄·지방 목표는 칼로리를 탄 50% / 단 20% / 지 30%로 배분해 산출 (탄·지 4·9kcal/g)
const CALORIE_GOAL = 1860;
const CARB_GOAL = 233; // ≈ CALORIE_GOAL × 0.5 / 4
const PROTEIN_GOAL = 93; // ≈ 체중 × 1.5g (PRD)
const FAT_GOAL = 62; // ≈ CALORIE_GOAL × 0.3 / 9
const BURNED_KCAL = 420; // 운동 데이터 연계 (가데이터)

// ── 운동 데이터 연계 (가데이터) ─────────────────────────────
// 플로우 4단계: 운동 데이터(운동량·부위·목표·빈도)를 식단과 결합.
// 실제 운동 데이터 연동 전까지 UI 표현용 가데이터.
const WORKOUT_LINK: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  value: string;
  sub: string;
}[] = [
  { icon: 'local-fire-department', label: '운동량', value: `${BURNED_KCAL}`, sub: 'kcal 소모' },
  { icon: 'fitness-center', label: '근력 사용', value: '5,200kg', sub: '총 볼륨' },
];

// 탄단지 표시 정의 (순서: 탄 → 단 → 지)
const MACROS = [
  { key: 'carb', label: '탄수화물', short: '탄', goal: CARB_GOAL, color: D.warning },
  { key: 'protein', label: '단백질', short: '단', goal: PROTEIN_GOAL, color: D.primary },
  { key: 'fat', label: '지방', short: '지', goal: FAT_GOAL, color: D.success },
] as const;

const initialMeals: Meal[] = [
  { id: '1', mealType: '아침', name: '시리얼 + 우유 + 바나나', kcal: 380, carb: 62, protein: 12, fat: 8, time: '08:10', inputMethod: 'manual' },
  { id: '2', mealType: '점심', name: '닭가슴살 샐러드', kcal: 420, carb: 18, protein: 45, fat: 14, time: '12:30', inputMethod: 'image' },
  { id: '3', mealType: '간식', name: '아메리카노 + 견과류', kcal: 180, carb: 8, protein: 5, fat: 15, time: '15:00', inputMethod: 'manual' },
];

const FAKE_RESULTS: Omit<Meal, 'id' | 'mealType' | 'time' | 'inputMethod'>[] = [
  { name: '현미밥 + 고등어구이', kcal: 620, carb: 78, protein: 32, fat: 18 },
  { name: '된장찌개 + 공깃밥', kcal: 480, carb: 72, protein: 16, fat: 10 },
  { name: '불고기 정식', kcal: 720, carb: 60, protein: 38, fat: 28 },
  { name: '연어 포케볼', kcal: 540, carb: 55, protein: 34, fat: 16 },
];

const METHOD_ICON: Record<InputMethod, React.ComponentProps<typeof MaterialIcons>['name']> = {
  image: 'photo-camera',
  voice: 'mic',
  manual: 'edit',
};

function currentMealType(): MealType {
  return '저녁'; // 가데이터: 시간대 기본 끼니 (라이브 시각 미사용)
}


// ── 공통 컴포넌트 ───────────────────────────────────────────
function ProgressBar({ ratio, color = D.primary }: { ratio: number; color?: string }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { backgroundColor: color, width: `${Math.min(Math.max(ratio, 0), 1) * 100}%` }]} />
    </View>
  );
}

function MacroBar({
  label,
  value,
  goal,
  color,
}: {
  label: string;
  value: number;
  goal: number;
  color: string;
}) {
  const pct = Math.round((value / goal) * 100);
  return (
    <View style={styles.macroItem}>
      <View style={styles.macroHead}>
        <Txt variant="body" weight="600">
          {label}
        </Txt>
        <Txt variant="caption" color={D.gray500}>
          {value} / {goal} g · {pct}%
        </Txt>
      </View>
      <ProgressBar ratio={value / goal} color={color} />
    </View>
  );
}

// 부족 ← 적정 → 과다 밸런스 미터 (순섭취/목표 비율을 0~1.5 구간에 매핑)
function BalanceMeter({ ratio }: { ratio: number }) {
  const pos = Math.min(Math.max(ratio / 1.5, 0), 1) * 100;
  return (
    <View style={styles.meterWrap}>
      <View style={styles.meterTrackWrap}>
        <View style={styles.meterTrack}>
          <View style={[styles.meterSeg, { flex: 60, backgroundColor: '#F3D6D3' }]} />
          <View style={[styles.meterSeg, { flex: 10, backgroundColor: '#CDE9D8' }]} />
          <View style={[styles.meterSeg, { flex: 30, backgroundColor: '#F4E5C3' }]} />
        </View>
        <View style={[styles.meterMarker, { left: `${pos}%` }]} />
      </View>
      <View style={styles.meterLabels}>
        <Txt variant="label" color={D.gray500}>부족</Txt>
        <Txt variant="label" color={D.gray500}>적정</Txt>
        <Txt variant="label" color={D.gray500}>과다</Txt>
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
  return (
    <View style={styles.mealRow}>
      <View style={styles.mealLeft}>
        <View style={styles.mealTag}>
          <Txt variant="label" color={D.gray700}>
            {item.mealType}
          </Txt>
        </View>
        <MaterialIcons name={METHOD_ICON[item.inputMethod]} size={18} color={D.gray500} />
        <View style={styles.mealInfo}>
          <Txt variant="body" numberOfLines={1}>
            {item.name}
          </Txt>
          <Txt variant="caption" color={D.gray500}>
            {item.time} · 탄 {item.carb} · 단 {item.protein} · 지 {item.fat} g
          </Txt>
        </View>
      </View>
      <Txt variant="body" weight="600">
        {item.kcal} kcal
      </Txt>
    </View>
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
                        styles.chip,
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

// ── 화면 ────────────────────────────────────────────────────
export default function DietScreen() {
  const [meals, setMeals] = useState<Meal[]>(initialMeals);
  const [modalOpen, setModalOpen] = useState(false);

  const totals = useMemo(
    () =>
      meals.reduce(
        (a, m) => ({ kcal: a.kcal + m.kcal, carb: a.carb + m.carb, protein: a.protein + m.protein, fat: a.fat + m.fat }),
        { kcal: 0, carb: 0, protein: 0, fat: 0 },
      ),
    [meals],
  );

  const remaining = CALORIE_GOAL - totals.kcal;
  const over = remaining < 0;
  const net = totals.kcal - BURNED_KCAL;
  const proteinPct = Math.round((totals.protein / PROTEIN_GOAL) * 100);
  const netRatio = net / CALORIE_GOAL;

  const feedback = useMemo(() => {
    if (totals.protein < PROTEIN_GOAL * 0.9) {
      return `오늘 운동 소모 ${BURNED_KCAL}kcal, 단백질은 목표의 ${proteinPct}%예요. 닭가슴살 1인분이면 채울 수 있어요.`;
    }
    if (over) {
      return '오늘은 운동량보다 조금 더 먹었어요. 내일 아침 가볍게 시작하면 균형이 맞아요.';
    }
    return '운동이랑 식단 밸런스가 좋아요. 최근 2주 중 제일 좋은 흐름이에요.';
  }, [totals.protein, proteinPct, over]);

  function handleSave(meal: Omit<Meal, 'id' | 'time'>) {
    setMeals((prev) => [...prev, { ...meal, id: `${prev.length + 1}-${meal.name}`, time: '지금' }]);
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Txt variant="h1">오늘의 식단</Txt>
            <Txt variant="caption" color={D.gray500}>
              6월 9일 월요일
            </Txt>
          </View>

          {/* 오늘 섭취 칼로리 */}
          <Card>
            <View style={styles.kcalHead}>
              <View>
                <Txt variant="caption" color={D.gray500}>
                  오늘 섭취 칼로리
                </Txt>
                <View style={styles.kcalBig}>
                  <Txt variant="display" color={D.primary}>
                    {totals.kcal.toLocaleString()}
                  </Txt>
                  <Txt variant="caption" color={D.gray500}>
                    / {CALORIE_GOAL.toLocaleString()} kcal
                  </Txt>
                </View>
              </View>
              <View style={styles.remainBox}>
                <Txt variant="h2" color={over ? D.warning : D.gray900}>
                  {over ? `+${-remaining}` : remaining}
                </Txt>
                <Txt variant="label" color={D.gray500}>
                  {over ? '초과' : '남음'}
                </Txt>
              </View>
            </View>
            <ProgressBar ratio={totals.kcal / CALORIE_GOAL} color={over ? D.warning : D.primary} />
          </Card>

          {/* 탄단지 균형 */}
          <Card>
            <View style={styles.macroCardHead}>
              <Txt variant="label" color={D.gray500}>
                탄단지 균형
              </Txt>
              <Txt variant="label" color={D.gray500}>
                목표 대비
              </Txt>
            </View>
            {MACROS.map((m) => (
              <MacroBar
                key={m.key}
                label={m.label}
                value={totals[m.key]}
                goal={m.goal}
                color={m.color}
              />
            ))}
          </Card>

          {/* ★ 핵심: 운동 데이터 연계 + 운동 대비 식단 통합 분석 (플로우 4~5단계) */}
          <Card>
            {/* 운동 데이터 연계 */}
            <View style={styles.workoutHeadLeft}>
              <MaterialIcons name="link" size={16} color={D.primary} />
              <Txt variant="label" weight="600" color={D.gray700}>
                운동 데이터 연계
              </Txt>
            </View>
            <View style={styles.workoutGrid}>
              {WORKOUT_LINK.map((w) => (
                <View key={w.label} style={styles.workoutItem}>
                  <View style={styles.workoutIconBox}>
                    <MaterialIcons name={w.icon} size={16} color={D.primary} />
                  </View>
                  <View style={styles.workoutText}>
                    <Txt variant="body" weight="600" numberOfLines={1}>
                      {w.value}
                    </Txt>
                    <Txt variant="label" color={D.gray500} numberOfLines={1}>
                      {w.label}
                    </Txt>
                  </View>
                </View>
              ))}
            </View>

            {/* 연계 → 분석 구분 */}
            <View style={styles.sectionDivider} />

            {/* 운동 대비 식단 통합 분석 */}
            <View style={styles.scoreHeadLeft}>
              <Txt variant="label" color={D.gray500}>
                운동 대비 식단
              </Txt>
            </View>

            <BalanceMeter ratio={netRatio} />

            <View style={styles.factorGroup}>
              <View style={styles.factorLine}>
                <Txt variant="caption" color={D.gray700}>
                  에너지 밸런스
                </Txt>
                <Txt variant="caption" color={D.gray500}>
                  순섭취 {net > 0 ? '+' : ''}
                  {net} / {CALORIE_GOAL.toLocaleString()} kcal
                </Txt>
              </View>
              <View style={styles.factorLine}>
                <Txt variant="caption" color={D.gray700}>
                  단백질 회복
                </Txt>
                <Txt variant="caption" color={D.gray500}>
                  {totals.protein} / {PROTEIN_GOAL} g · {proteinPct}%
                </Txt>
              </View>
            </View>

            {/* 코치 피드백 */}
            <View style={styles.aiCard}>
              <View style={styles.aiHead}>
                <MaterialIcons name="auto-awesome" size={18} color={D.primary} />
                <Txt variant="caption" weight="600" color={D.primary}>
                  코치
                </Txt>
              </View>
              <Txt variant="body" color={D.gray700} style={styles.aiText}>
                {feedback}
              </Txt>
            </View>
          </Card>

          {/* 오늘 기록 */}
          <Txt variant="label" color={D.gray500} style={styles.listHead}>
            오늘 기록 {meals.length}
          </Txt>
          <Card style={styles.listCard}>
            {meals.map((m, i) => (
              <View key={m.id}>
                {i > 0 && <View style={styles.divider} />}
                <MealRow item={m} />
              </View>
            ))}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: D.bgBase },
  safeArea: { flex: 1, width: '100%', maxWidth: 800, alignSelf: 'center' },
  scroll: { paddingHorizontal: SIDE, paddingTop: S.md, paddingBottom: NAV_HEIGHT + S.xxl + S.md, gap: S.md },
  header: { gap: S.xs, marginBottom: S.xs },

  card: {
    backgroundColor: D.surface,
    borderRadius: R.card,
    borderWidth: 0.5,
    borderColor: D.line,
    padding: S.md,
    gap: S.sm,
    ...LEVEL1,
  },

  // 칼로리
  kcalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  kcalBig: { flexDirection: 'row', alignItems: 'baseline', gap: S.sm, marginTop: S.xs },
  remainBox: { alignItems: 'flex-end' },

  // progress
  track: { height: 8, borderRadius: R.full, backgroundColor: D.gray100, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: R.full },

  // macro
  macroHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  macroCardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  macroItem: { gap: S.xs, marginTop: S.xs },

  // 운동 데이터 연계
  workoutHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  workoutGrid: { flexDirection: 'row', gap: S.sm, marginTop: S.xs },
  workoutItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: S.sm },
  workoutIconBox: {
    width: 30,
    height: 30,
    borderRadius: R.full,
    backgroundColor: D.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutText: { gap: 0 },
  sectionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: D.line, marginVertical: S.sm },

  // 운동 대비 식단
  scoreHeadLeft: { gap: S.xs },

  // 밸런스 미터
  meterWrap: { gap: S.xs, marginTop: S.sm },
  meterTrackWrap: { position: 'relative', justifyContent: 'center' },
  meterTrack: { flexDirection: 'row', height: 10, borderRadius: R.full, overflow: 'hidden', gap: 2 },
  meterSeg: { height: '100%' },
  meterMarker: {
    position: 'absolute',
    top: -3,
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: D.gray700,
    transform: [{ translateX: -2 }],
  },
  meterLabels: { flexDirection: 'row', justifyContent: 'space-between' },

  // 점수 요인
  factorGroup: { gap: S.xs, marginTop: S.xs },
  factorLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  // AI card
  aiCard: {
    backgroundColor: D.primaryLight,
    borderRadius: R.card,
    padding: S.md,
    gap: S.sm,
  },
  aiHead: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  aiText: { lineHeight: 24 },

  // list
  listHead: { marginTop: S.xs, marginLeft: S.xs },
  listCard: { paddingVertical: 0 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: D.line },
  mealRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: S.sm, paddingVertical: S.md },
  mealLeft: { flexDirection: 'row', alignItems: 'center', gap: S.sm, flex: 1 },
  mealTag: { paddingHorizontal: S.sm, paddingVertical: 2, borderRadius: R.small, backgroundColor: D.gray100 },
  mealInfo: { flex: 1, gap: 2 },

  // FAB — 하단 네비바(약 64px) 위로 띄워서 따로 분리, 우하단 플로팅
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
  chip: { flex: 1, alignItems: 'center', paddingVertical: S.sm, borderRadius: R.full, borderWidth: 1 },

  primaryBtn: { height: 52, borderRadius: R.button, alignItems: 'center', justifyContent: 'center', marginTop: S.sm },
});
