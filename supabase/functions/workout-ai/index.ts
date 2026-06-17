// Supabase Edge Function: 운동 AI 통합 프록시 (Claude).
// body.action 으로 분기하여 한 함수에서 두 기능 처리.
//   - action='generate-routine': 사용자 조건 + 후보 목록 → ID 4~6개 + title/intro
//   - action='workout-feedback': 운동 기록 → summary/nextAdjustment/encouragement
//
// 배포: supabase functions deploy workout-ai
// 시크릿: supabase secrets set ANTHROPIC_API_KEY=<console.anthropic.com 키>
// 호출:  POST {SUPABASE_URL}/functions/v1/workout-ai
//   body: { action: 'generate-routine' | 'workout-feedback', ...payload }
//
// deno 런타임 — 앱(tsc) 빌드 대상이 아니라 tsconfig 에서 제외됨.

import Anthropic from 'npm:@anthropic-ai/sdk';

declare const Deno: {
  env: { get(k: string): string | undefined };
  serve(h: (req: Request) => Response | Promise<Response>): void;
};

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '' });

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

// ── generate-routine ─────────────────────────────────────────

interface RoutineInput {
  goal: string;
  place: string;
  equipment: string;
  condition: string;
  bodyPart: string;
  duration: string;
  easier?: boolean;
}

interface CandidateRow {
  id: string;
  name: string;
  body_region: string | null;
  phase_tags: string[];
  intensity: number;
}

const routineSchema = {
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

const routineSystemPrompt = `당신은 친근하고 전문적인 AI 운동 코치입니다.
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

function buildRoutineUserPrompt(
  input: RoutineInput,
  candidates: CandidateRow[],
  count: number,
): string {
  const seed = Math.random().toString(36).slice(2, 8);
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

async function handleGenerateRoutine(payload: Record<string, unknown>): Promise<Response> {
  const { input, candidates, count } = payload;
  if (
    !input ||
    typeof input !== 'object' ||
    !Array.isArray(candidates) ||
    typeof count !== 'number'
  ) {
    return json({ error: 'input/candidates/count required' }, 400);
  }

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 512,
    system: routineSystemPrompt,
    messages: [
      {
        role: 'user',
        content: buildRoutineUserPrompt(
          input as RoutineInput,
          candidates as CandidateRow[],
          count,
        ),
      },
    ],
    output_config: {
      format: { type: 'json_schema', schema: routineSchema },
    },
  } as Parameters<typeof client.messages.create>[0]);

  if (response.stop_reason === 'max_tokens') {
    return json({ error: 'AI 응답이 중간에 끊겼어요. 잠시 후 다시 시도해주세요.' }, 502);
  }
  const block = response.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') {
    return json({ error: 'AI 가 빈 응답을 보냈어요. 잠시 후 다시 시도해주세요.' }, 502);
  }
  try {
    return json(JSON.parse(block.text));
  } catch {
    return json({ error: 'AI 응답 형식이 올바르지 않아요. 잠시 후 다시 시도해주세요.' }, 502);
  }
}

// ── workout-feedback ─────────────────────────────────────────

type Difficulty = 'easy' | 'good' | 'hard';
type CompletionStatus = 'completed' | 'partial' | 'missed';

const feedbackSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: '오늘 운동의 한 줄 요약. 평가 톤 금지.' },
    nextAdjustment: { type: 'string', description: '다음 운동을 위한 조정 한 문장.' },
    encouragement: { type: 'string', description: '짧고 따뜻한 격려 한 문장.' },
  },
  required: ['summary', 'nextAdjustment', 'encouragement'],
  additionalProperties: false,
} as const;

const feedbackSystemPrompt = `당신은 친근한 홈트 AI 코치입니다.
운동 기록을 받아 다음 운동 조정 방향을 JSON으로만 반환합니다.
반드시 아래 형식만 반환하고 다른 텍스트는 포함하지 마세요:
{"summary":string,"nextAdjustment":string,"encouragement":string}
각 필드는 한 문장 이내 한국어.`;

function isDifficulty(v: unknown): v is Difficulty {
  return v === 'easy' || v === 'good' || v === 'hard';
}
function isCompletion(v: unknown): v is CompletionStatus {
  return v === 'completed' || v === 'partial' || v === 'missed';
}

async function handleWorkoutFeedback(payload: Record<string, unknown>): Promise<Response> {
  const { difficulty, painAreas, completionStatus, memo, routineTitle, exerciseCount, calories } = payload;

  // completionStatus 는 필수 — 완료 페이지 진입 즉시 호출됨. 나머지는 선택(리뷰 전이라 비어있을 수 있음).
  if (!isCompletion(completionStatus)) {
    return json({ error: 'completionStatus invalid' }, 400);
  }
  const difficultyLabel = isDifficulty(difficulty) ? difficulty : '미입력';
  const pains: string[] = Array.isArray(painAreas)
    ? painAreas.filter((p): p is string => typeof p === 'string')
    : [];
  const memoStr = typeof memo === 'string' ? memo : '';
  const titleStr = typeof routineTitle === 'string' ? routineTitle : '오늘의 운동';
  const countStr = typeof exerciseCount === 'number' ? exerciseCount : '?';
  const calStr = typeof calories === 'number' ? `${calories} kcal` : '미상';

  const userPrompt = `운동 루틴: ${titleStr}
운동 개수: ${countStr}
완료 여부: ${completionStatus}
추정 칼로리: ${calStr}
난이도: ${difficultyLabel}
통증 부위: ${pains.join(', ') || '없음'}
메모: ${memoStr.trim() || '없음'}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: feedbackSystemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    output_config: {
      format: { type: 'json_schema', schema: feedbackSchema },
    },
  } as Parameters<typeof client.messages.create>[0]);

  if (response.stop_reason === 'max_tokens') {
    return json({ error: 'AI 응답이 중간에 끊겼습니다.' }, 502);
  }
  const block = response.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') {
    return json({ error: 'AI 응답이 비었습니다.' }, 502);
  }
  try {
    return json(JSON.parse(block.text));
  } catch {
    return json({ error: 'AI 응답 형식이 올바르지 않습니다.' }, 502);
  }
}

// ── 라우터 ───────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  try {
    const body = await req.json();
    const action = body?.action;
    switch (action) {
      case 'generate-routine':
        return await handleGenerateRoutine(body);
      case 'workout-feedback':
        return await handleWorkoutFeedback(body);
      default:
        return json({ error: `unknown action: ${String(action)}` }, 400);
    }
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
