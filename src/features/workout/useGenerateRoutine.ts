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

import Anthropic from '@anthropic-ai/sdk';
import { useMutation } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import {
  fetchExercisesByIds,
  filterCandidates,
  type CandidateRow,
  type ExerciseRow,
} from './exercises';
import { generateRepScripts } from './rep-scripts';

const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
const client = apiKey
  ? new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  : null;

export interface RoutineInput {
  goal: string;
  place: string;
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

const outputSchema = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: '루틴 제목 한 줄. 컨디션·시간이 한눈에 들어오게.',
    },
    intro: {
      type: 'string',
      description: '왜 이 루틴인지 한 문장. 친근한 톤, 이모지 1개.',
    },
    exerciseIds: {
      type: 'array',
      description:
        '후보 목록의 ID 만 사용. 워밍업 1 → 메인 → 마무리 1 순서로 배치.',
      items: { type: 'string' },
    },
  },
  required: ['title', 'intro', 'exerciseIds'],
  additionalProperties: false,
} as const;

const systemPrompt = `당신은 친근하고 전문적인 AI 운동 코치입니다.
사용자 조건과 후보 운동 목록을 보고 최적의 루틴을 조합합니다.

원칙:
- 후보 목록에 없는 운동은 절대 추천하지 마세요. id 를 정확히 그대로 반환합니다.
- 운동 순서: 워밍업 1개 → 메인 → 마무리 1개.
- **워밍업과 마무리는 반드시 부위(body_region)가 '스트레칭' 인 운동에서만 골라야 합니다.**
  · 워밍업: 부위='스트레칭' AND phase 에 'warmup' 포함
  · 마무리: 부위='스트레칭' AND phase 에 'cooldown' 포함
  · 스트레칭이 아닌 운동(상체/하체/코어/전신)은 워밍업/마무리에 절대 사용 금지.
- 메인 운동은 신체 부위(상체/하체/코어/전신)가 골고루 자극되도록 다른 부위에서 섞어 고르세요.
- 같은 부위 운동을 2개 이상 연속 배치하지 마세요.
- **다양성 원칙**: 사용자 조건이 같아도 호출마다 운동 조합이 달라야 합니다.
  · 항상 "가장 무난한" 운동만 고르지 말고, 후보 풀의 덜 흔한 옵션도 적극 시도하세요.
  · 사용자 프롬프트의 "다양성 시드" 값이 다르면, 가능한 한 다른 운동 조합을 만드세요.
- title 은 짧고 명료하게.
- intro 는 짧고 친근하게 한 문장, 이모지 1개.`;

/** Fisher-Yates 셔플 — 후보 순서 편향을 제거하기 위한 매 호출 무작위화. */
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildCandidatesList(candidates: CandidateRow[]): string {
  return candidates
    .map(
      (c) =>
        `${c.id} | ${c.name} | 부위:${c.body_region ?? '-'} | phase:${c.phase_tags.join(',')} | intensity:${c.intensity}`,
    )
    .join('\n');
}

function buildUserPrompt(
  input: RoutineInput,
  candidates: CandidateRow[],
  count: number,
): string {
  // 매 호출마다 다른 6자 토큰 → LLM 에게 "이번 호출은 이전과 다르다"는 신호.
  const seed = Math.random().toString(36).slice(2, 8);
  // 후보 순서도 매번 다르게 — LLM 이 위쪽 항목을 우선 고르는 편향을 완화.
  const shuffled = shuffle(candidates);

  const easierNote = input.easier
    ? `\n\n중요: 사용자가 "더 쉬운 루틴으로 바꾸기"를 눌렀습니다. 후보 중에서도 intensity 가 낮은 운동을 우선 선택해 부담을 한 단계 낮춰주세요.`
    : '';

  return `다양성 시드: ${seed}

사용자 조건:
- 목표: ${input.goal}
- 장소: ${input.place}
- 장비: ${input.equipment}
- 컨디션: ${input.condition}
- 불편한 부위: ${input.bodyPart}
- 운동 시간: ${input.duration}

총 ${count}개 운동을 골라주세요 (워밍업 1, 메인 ${count - 2}, 마무리 1).

후보 운동 목록 (id | 이름 | 부위 | phase | intensity):
${buildCandidatesList(shuffled)}${easierNote}`;
}

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
  if (!client) {
    throw new Error(
      '.env에 EXPO_PUBLIC_ANTHROPIC_API_KEY를 설정한 뒤 dev server를 재시작하세요.',
    );
  }

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 512,
    system: systemPrompt,
    messages: [
      { role: 'user', content: buildUserPrompt(input, candidates, count) },
    ],
    output_config: {
      format: { type: 'json_schema', schema: outputSchema },
    },
  });

  if (response.stop_reason === 'max_tokens') {
    throw new Error(
      'AI 응답이 중간에 끊겼어요. 잠시 후 다시 시도해주세요.',
    );
  }

  const block = response.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') {
    throw new Error('AI 가 빈 응답을 보냈어요. 잠시 후 다시 시도해주세요.');
  }

  try {
    return JSON.parse(block.text) as LlmResult;
  } catch {
    throw new Error('AI 응답 형식이 올바르지 않아요. 잠시 후 다시 시도해주세요.');
  }
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
