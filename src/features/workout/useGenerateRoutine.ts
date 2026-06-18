/**
 * AI 운동 루틴 생성.
 *
 * 흐름:
 *   1) filterCandidates(): DB 에서 사용자 조건에 맞는 후보 15~25개 추리기
 *   2) LLM 에 후보 목록 + 사용자 의도 전달 → ID 4~6개 + title/intro 반환
 *   3) fetchExercisesByIds(): 선택된 ID 들의 전체 데이터 조회
 *   4) 컨디션 배율로 reps/duration 조정 + min/max 로 clamp
 *   5) form_cues 를 generateRepScripts 에 넘겨 운동 특화 코칭 완성
 *
 * LLM 출력은 ID 만 받으므로 출력 토큰이 종전 대비 ~95% 감소 → 20초 → ~2초.
 */

import { useMutation } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { supabase } from '@/lib/supabase';

import {
  fetchExercisesByIds,
  filterCandidates,
  type CandidateRow,
  type ExerciseRow,
} from './exercises';
import { generateRepScripts } from './rep-scripts';

export interface RoutineInput {
  goal: string;
  equipment: string;
  condition: string;
  bodyPart: string;
  duration: string;
  /** "더 쉬운 루틴으로 바꾸기" 진입점에서 true. 강도 상한·reps 배율·LLM 프롬프트를 한 단계 더 낮춤. */
  easier?: boolean;
}

export interface RoutineExercise {
  name: string;
  /** "12회 × 3세트" 또는 "2분"/"90초" — 화면 표시 및 complete.tsx 가 분 추출에 사용. */
  detail: string;
  description: string;
  caution: string;
  earlyReps: string[];
  middleReps: string[];
  finalReps: string[];
  timeScripts: string[];
  halfwayEncouragement: string;
  /** session.tsx 에서 repScripts[rep-1] 로 발화. form_cues 가 섞인 완성본. */
  repScripts: string[];
  /** TTS 톤 분기용. body_region 이 '스트레칭' 이면 명상 톤(stretch), 아니면 코치 톤(main). */
  isStretch: boolean;
}

export interface Routine {
  id: string;
  title: string;
  /** "15분 · 보통 컨디션 · 매트" — complete.tsx 가 /N분/ 정규식으로 시간 추출. */
  meta: string;
  intro: string;
  exercises: RoutineExercise[];
}

const CONDITION_REPS_MULTIPLIER: Record<string, number> = {
  좋음: 1.2,
  보통: 1.0,
  피곤해요: 0.7,
};

/** easier=true 일 때 condition 배율에 추가로 곱하는 계수. */
const EASIER_REPS_MULTIPLIER = 0.8;

const DURATION_EX_COUNT: Record<string, number> = {
  '10분': 4,
  '15분': 5,
  '20분': 6,
};

/** 세트 기반 운동의 1세트당 절대 상한. DB의 max_reps 와 별개로 항상 강제. */
const HARD_REPS_CEILING = 25;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ── LLM 호출 ─────────────────────────────────────────────────
// 프롬프트·schema·shuffle 은 모두 Edge Function (supabase/functions/generate-routine) 에 있음.
// 키는 서버 secret(ANTHROPIC_API_KEY) 으로만 존재. 클라이언트는 후보·조건만 넘기고 결과 ID 를 받는다.

interface LlmResult {
  title: string;
  intro: string;
  exerciseIds: string[];
}

async function pickExercisesFromLLM(
  input: RoutineInput,
  candidates: CandidateRow[],
  count: number,
): Promise<LlmResult> {
  const { data, error } = await supabase.functions.invoke<
    LlmResult & { error?: string }
  >('workout-ai', {
    body: { action: 'generate-routine', input, candidates, count },
  });

  if (error || !data) {
    throw new Error(
      data?.error ??
        error?.message ??
        'AI 루틴 생성에 실패했어요. 잠시 후 다시 시도해주세요.',
    );
  }
  if (data.error) {
    throw new Error(data.error);
  }
  if (
    typeof data.title !== 'string' ||
    typeof data.intro !== 'string' ||
    !Array.isArray(data.exerciseIds)
  ) {
    throw new Error('AI 응답 형식이 올바르지 않아요. 잠시 후 다시 시도해주세요.');
  }
  return { title: data.title, intro: data.intro, exerciseIds: data.exerciseIds };
}

// ── Routine 조립 ─────────────────────────────────────────────

interface ScaledDetail {
  detail: string;
  reps: number | null;
}

function buildDetail(row: ExerciseRow, condMul: number): ScaledDetail {
  if (row.default_sets !== null && row.default_reps !== null) {
    const scaled = Math.round(row.default_reps * condMul);
    // 상한은 DB max_reps 와 전역 ceiling 중 작은 쪽.
    const upper = Math.min(row.max_reps ?? scaled, HARD_REPS_CEILING);
    const reps = clamp(scaled, row.min_reps ?? scaled, upper);
    return {
      detail: `${reps}회 × ${row.default_sets}세트`,
      reps,
    };
  }
  if (row.default_duration_sec !== null) {
    const scaled = Math.round(row.default_duration_sec * condMul);
    const sec = clamp(
      scaled,
      row.min_duration_sec ?? scaled,
      row.max_duration_sec ?? scaled,
    );
    const detail =
      sec >= 60 && sec % 60 === 0 ? `${sec / 60}분` : `${sec}초`;
    return { detail, reps: null };
  }
  return { detail: '?', reps: null };
}

function buildRoutineExercise(row: ExerciseRow, condMul: number): RoutineExercise {
  const { detail, reps } = buildDetail(row, condMul);

  const repScripts =
    reps !== null &&
    reps > 0 &&
    row.middle_reps.length + row.form_cues.length > 0
      ? generateRepScripts({
          exerciseId: row.id,
          exerciseName: row.name,
          reps,
          secondsPerRep: 0,
          earlyReps: row.early_reps,
          middleReps: row.middle_reps,
          finalReps: row.final_reps,
          formCues: row.form_cues,
        })
      : [];

  return {
    name: row.name,
    detail,
    description: row.description_text,
    caution: row.caution_text,
    earlyReps: row.early_reps,
    middleReps: row.middle_reps,
    finalReps: row.final_reps,
    timeScripts: row.time_scripts,
    halfwayEncouragement: row.halfway_encouragement,
    repScripts,
    isStretch: row.body_region === '스트레칭',
  };
}

// ── Main flow ────────────────────────────────────────────────

async function generateRoutine(input: RoutineInput): Promise<Routine> {
  // 1. DB 후보 필터
  const candidates = await filterCandidates(input);
  if (candidates.length < 4) {
    throw new Error(
      '조건에 맞는 운동이 너무 적어요. 컨디션이나 장비 조건을 조금 완화해보세요.',
    );
  }

  // 2. LLM 으로 운동 선택
  const count = DURATION_EX_COUNT[input.duration] ?? 5;
  const llmResult = await pickExercisesFromLLM(input, candidates, count);

  // 3. 선택된 ID 들의 전체 데이터 조회 + LLM 반환 순서대로 정렬
  const candidateIds = new Set(candidates.map((c) => c.id));
  const validIds = llmResult.exerciseIds.filter((id) => candidateIds.has(id));
  if (validIds.length === 0) {
    throw new Error('AI 가 후보 외 운동을 골랐어요. 다시 시도해주세요.');
  }

  const rows = await fetchExercisesByIds(validIds);
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const orderedRows = validIds
    .map((id) => rowById.get(id))
    .filter((r): r is ExerciseRow => !!r);

  // 4. 컨디션 배율 적용 + RoutineExercise 조립
  const baseMul = CONDITION_REPS_MULTIPLIER[input.condition] ?? 1.0;
  const condMul = input.easier ? baseMul * EASIER_REPS_MULTIPLIER : baseMul;
  const exercises = orderedRows.map((row) => buildRoutineExercise(row, condMul));

  const meta = `${input.duration} · ${input.condition} 컨디션 · ${input.equipment}`;

  return {
    id: Crypto.randomUUID(),
    title: llmResult.title,
    meta,
    intro: llmResult.intro,
    exercises,
  };
}

export function useGenerateRoutine() {
  return useMutation({ mutationFn: generateRoutine });
}
