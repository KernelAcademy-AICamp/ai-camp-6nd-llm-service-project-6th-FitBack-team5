/**
 * 식단 가이드/달성률 도메인 — 명세 §4 데이터 모델 · §5 AI 연동 포인트.
 *
 * MVP: AI 호출을 인터페이스(generateGuide / computeDietResult)로 먼저 분리하고
 * mock 응답으로 화면을 완성한다. 추후 실제 모델을 이 함수 안에서 연결한다.
 *
 * 용어 규칙(명세 §1-3): 사용자 노출 명칭은 "가이드". "타겟" 금지.
 */

export type Goal = 'gain' | 'cut' | 'maintain';
export type WorkoutPart = 'lower' | 'upper' | 'full' | 'cardio';
export type Intensity = 'low' | 'mid' | 'high';

export interface WorkoutContext {
  source: 'planned' | 'recent' | 'none';
  goal: Goal;
  part?: WorkoutPart;
  intensity?: Intensity;
  plannedAt?: string; // ISO
}

export interface MacroTarget {
  protein: number;
  carb: number;
  fat: number;
  kcal: number;
}

export interface GuideResult {
  contextLabel: string; // "오늘 하체 운동 예정"
  target: MacroTarget;
  recommendedFoods: string[];
}

export interface MealItem {
  name: string;
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
}

export interface Coaching {
  state: string; // 현재 상태
  nextAction: string; // 구체적 다음 행동 (항상 포함)
  foods?: string[];
}

export interface DietResult {
  target: MacroTarget;
  consumed: MacroTarget;
  achievement: { protein: number; carb: number; fat: number }; // 0~1+
  coaching: Coaching;
}

export type MacroKey = 'protein' | 'carb' | 'fat';
export const MACRO_KEYS: MacroKey[] = ['protein', 'carb', 'fat'];
export const MACRO_LABEL: Record<MacroKey, string> = {
  protein: '단백질',
  carb: '탄수화물',
  fat: '지방',
};

const GOAL_LABEL: Record<Goal, string> = {
  gain: '증량',
  cut: '감량',
  maintain: '유지',
};
export const PART_LABEL: Record<WorkoutPart, string> = {
  lower: '하체',
  upper: '상체',
  full: '전신',
  cardio: '유산소',
};

function kcalOf(protein: number, carb: number, fat: number): number {
  return protein * 4 + carb * 4 + fat * 9;
}

// 회원 신체 정보 (profiles 테이블에서 가져옴)
export interface BodyProfile {
  age: number | null;
  gender: 'M' | 'F' | null;
  height: number | null; // cm
  weight: number | null; // kg
  exerciseLevel: 'beginner' | 'intermediate' | 'advanced' | null;
}

// 운동 수준 → 활동계수 (Mifflin 표준: 비활동 1.2 / 가벼움 1.375 / 보통 1.55)
const ACTIVITY_FACTOR: Record<string, number> = {
  beginner: 1.2,
  intermediate: 1.375,
  advanced: 1.55,
};

// 회원 정보 기반 목표 칼로리 — Mifflin-St Jeor BMR × 활동계수 × 목표보정.
// 신체 정보가 부족하면 null (호출부에서 goal 기준 기본값으로 폴백).
export function calorieTargetFromProfile(p: BodyProfile, goal: Goal): number | null {
  if (p.age == null || p.height == null || p.weight == null) return null;
  const genderOffset = p.gender === 'F' ? -161 : 5; // 미지정 시 남성 기준
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + genderOffset;
  const factor = ACTIVITY_FACTOR[p.exerciseLevel ?? ''] ?? 1.2;
  const tdee = bmr * factor;
  const goalMul: Record<Goal, number> = { maintain: 1, cut: 0.85, gain: 1.1 };
  return Math.round(tdee * goalMul[goal]);
}

// 회원 체중 기반 단백질 목표 — 체중 × 1.5g (PRD). 체중 없으면 null.
export function proteinTargetFromProfile(weightKg: number | null): number | null {
  if (weightKg == null) return null;
  return Math.round(weightKg * 1.5);
}

// 목표별 기준 칼로리 (회원 정보 없을 때 폴백, 가데이터)
const BASE_KCAL: Record<Goal, number> = {
  maintain: 1300,
  gain: 1600,
  cut: 1100,
};

// ── Step 2: 가이드 생성 ─────────────────────────────────────
// opts.kcal·opts.protein(회원 정보 기반)이 주어지면 그 값을, 없으면 기본값으로 폴백.
// 단백질은 체중 기반(체중×1.5g)을 우선 쓰고, 남은 칼로리를 탄수:지방 = 4:3으로 분배.
export function generateGuide(
  ctx: WorkoutContext,
  opts?: { kcal?: number | null; protein?: number | null },
): GuideResult {
  let kcal = opts?.kcal ?? BASE_KCAL[ctx.goal];

  // 부위/강도로 칼로리 보정
  if (ctx.part === 'lower' || ctx.part === 'upper') kcal += 50;
  else if (ctx.part === 'full') kcal += 80;
  else if (ctx.part === 'cardio') kcal += 50;
  if (ctx.intensity === 'high') kcal += 100;
  else if (ctx.intensity === 'low') kcal -= 50;

  // 단백질: 회원 체중 기반 값 우선. 없으면 칼로리의 30%로 폴백.
  const protein = Math.round(opts?.protein ?? (kcal * 0.3) / 4);
  // 남은 칼로리를 탄수:지방 = 4:3(칼로리)으로 분배 (탄·단 4kcal/g, 지 9kcal/g)
  const remainKcal = Math.max(0, kcal - protein * 4);
  const carb = Math.round((remainKcal * (4 / 7)) / 4);
  const fat = Math.round((remainKcal * (3 / 7)) / 9);
  const target: MacroTarget = { protein, carb, fat, kcal: kcalOf(protein, carb, fat) };

  // 컨텍스트 한 줄 (명세 §3 Step2)
  const contextLabel =
    ctx.source === 'none' || !ctx.part
      ? `목표: ${GOAL_LABEL[ctx.goal]} 기준 추천`
      : `오늘 ${PART_LABEL[ctx.part]} 운동 예정`;

  // 추천 식품 — 목표/부위에 맞는 3~5개
  const foodPool: Record<Goal, string[]> = {
    maintain: ['닭가슴살', '현미밥', '바나나', '그릭요거트', '계란'],
    gain: ['닭가슴살', '소고기', '현미밥', '고구마', '견과류'],
    cut: ['닭가슴살', '두부', '브로콜리', '그릭요거트', '오트밀'],
  };
  const recommendedFoods = foodPool[ctx.goal].slice(0, ctx.part === 'cardio' ? 3 : 4);

  return { contextLabel, target, recommendedFoods };
}

// ── Step 5·6: 섭취 비교 + 코칭 (mock) ───────────────────────
export function computeDietResult(target: MacroTarget, consumed: MacroTarget): DietResult {
  const achievement = {
    protein: consumed.protein / target.protein,
    carb: consumed.carb / target.carb,
    fat: consumed.fat / target.fat,
  };
  return { target, consumed, achievement, coaching: buildCoaching(target, consumed) };
}

// 코칭은 항상 [현재 상태] → [구체적 다음 행동]으로 끝낸다 (명세 §3 Step6 · design.md §12).
function buildCoaching(target: MacroTarget, consumed: MacroTarget): Coaching {
  const proteinGap = target.protein - consumed.protein;

  // 단백질이 가장 중요한 회복 지표 — 부족하면 우선 보충 제안
  if (proteinGap >= 10) {
    const yogurt = Math.max(1, Math.round(proteinGap / 12)); // 그릭요거트 1개 ≈ 단백질 12g
    return {
      state: `단백질 ${proteinGap}g 부족`,
      nextAction: `그릭요거트 ${yogurt}개 또는 닭가슴살 100g 더 드세요`,
      foods: ['그릭요거트', '닭가슴살'],
    };
  }

  // 탄수 과잉 — 다음 끼니 가볍게
  if (consumed.carb > target.carb * 1.15) {
    return {
      state: '탄수화물 충분',
      nextAction: '다음 끼니는 단백질 위주로 가볍게 채워보세요',
      foods: ['두부', '계란'],
    };
  }

  // 충분 — 추가 섭취 불필요
  return {
    state: '오늘 섭취량 충분',
    nextAction: '추가 섭취 없이 회복할 수 있어요',
  };
}

// ── mock 입력값 (Step 1 컨텍스트는 이번 범위 밖 → 기본값 사용) ──
export const MOCK_CONTEXT: WorkoutContext = {
  source: 'planned',
  goal: 'maintain',
  part: 'lower',
  intensity: 'mid',
};

// 오늘 먹은 양 (mock) — 단백질이 목표보다 부족하도록 구성해 코칭이 행동 제안을 하도록
export const MOCK_CONSUMED: MacroTarget = {
  protein: 72,
  carb: 205,
  fat: 58,
  kcal: kcalOf(72, 205, 58),
};
