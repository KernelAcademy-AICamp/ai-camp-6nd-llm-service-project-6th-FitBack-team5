import Anthropic from '@anthropic-ai/sdk';
import { useMutation } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

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
}

/**
 * Claude가 직접 반환하는 운동 데이터 (템플릿 형태).
 * earlyReps/middleReps/finalReps 는 `{count}` placeholder 포함 템플릿.
 */
interface RawRoutineExercise {
  name: string;
  detail: string;
  description: string;
  caution: string;
  /** 세트 기반 초반 2회용 템플릿 (정확히 2개, 시간 기반은 빈 배열) */
  earlyReps: string[];
  /** 세트 기반 중반용 템플릿 (정확히 5개, 시간 기반은 빈 배열) */
  middleReps: string[];
  /** 세트 기반 마지막 3회용 템플릿 (정확히 3개, 시간 기반은 빈 배열) */
  finalReps: string[];
  /** 시간 기반 순차 cue (≈ totalSeconds÷12개, 세트 기반은 []) */
  timeScripts: string[];
  /** 시간 기반 절반 시점 격려 한 문장 (세트 기반은 "") */
  halfwayEncouragement: string;
}

/**
 * 후처리 완료된 운동 데이터. repScripts 는 generateRepScripts() 로 펼친 결과.
 * 길이 = reps. 각 항목은 한글 카운트 + 동작 가이드가 합쳐진 완성 멘트.
 */
export interface RoutineExercise extends RawRoutineExercise {
  /** session 에서 repScripts[rep - 1] 로 그대로 발화 */
  repScripts: string[];
}

interface RawRoutine {
  title: string;
  meta: string;
  intro: string;
  exercises: RawRoutineExercise[];
}

export interface Routine {
  id: string;
  title: string;
  meta: string;
  intro: string;
  exercises: RoutineExercise[];
}

/** "12회 × 3세트" → 12, "2분" 또는 매칭 실패 → null */
function parseRepsFromDetail(detail: string): number | null {
  const m = detail.match(/(\d+)\s*회\s*[×x*]\s*(\d+)\s*세트/);
  if (!m) return null;
  const reps = parseInt(m[1], 10);
  return Number.isFinite(reps) && reps > 0 ? reps : null;
}

function expandRoutine(raw: RawRoutine): Routine {
  return {
    id: Crypto.randomUUID(),
    ...raw,
    exercises: raw.exercises.map((ex) => {
      const reps = parseRepsFromDetail(ex.detail);
      const repScripts =
        reps && ex.earlyReps.length + ex.middleReps.length + ex.finalReps.length > 0
          ? generateRepScripts({
              exerciseId: ex.name,
              exerciseName: ex.name,
              reps,
              secondsPerRep: 0,
              earlyReps: ex.earlyReps,
              middleReps: ex.middleReps,
              finalReps: ex.finalReps,
            })
          : [];
      return { ...ex, repScripts };
    }),
  };
}

const routineSchema = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: '루틴 제목. 사용자 컨디션·부위·시간이 한눈에 들어오게. 예: "무릎 부담을 줄인 전신 홈트"',
    },
    meta: {
      type: 'string',
      description: '시간·난이도·장비를 가운뎃점으로 연결. 예: "15분 · 초보자용 · 매트 사용"',
    },
    intro: {
      type: 'string',
      description: '왜 이 루틴인지 한 문장. AI 코치 톤, 압박 금지. 예: "오늘은 보통 컨디션이므로 짧고 부담 없는 루틴을 추천해요."',
    },
    exercises: {
      type: 'array',
      description: '운동 4~6개. 워밍업 → 메인 → 마무리 순서',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '운동 이름. 예: "글루트 브릿지"' },
          detail: {
            type: 'string',
            description: '시간 기반은 "2분", 세트 기반은 "12회 × 3세트" 형식만 사용',
          },
          description: {
            type: 'string',
            description:
              '자세와 동작을 한두 문장으로 설명. 음성 코치가 그대로 읽을 문장. 예: "엉덩이를 천천히 들어올려요. 어깨와 무릎이 일직선이 되도록 유지하세요."',
          },
          caution: {
            type: 'string',
            description:
              '주의할 점 한 문장. 예: "허리를 과도하게 꺾지 말고 엉덩이에 힘을 주세요." 특별히 주의할 게 없으면 빈 문자열.',
          },
          earlyReps: {
            type: 'array',
            description:
              '초반 적응 2회용 멘트 템플릿. 정확히 2개. 각 멘트는 `{count}`로 시작 (코드가 "하나"/"둘" 등으로 치환). 자세 안내 위주. 예: ["{count}, 엉덩이를 천천히 들어올려요. 허리가 꺾이지 않게 조심해요.", "{count}, 같은 동작이에요. 발바닥으로 바닥을 밀고 천천히 내려와요."]. 시간 기반(N분)은 빈 배열 [].',
            items: { type: 'string' },
          },
          middleReps: {
            type: 'array',
            description:
              '중반용 멘트 템플릿. 정확히 5개. 각 멘트는 `{count}`로 시작. 호흡/자세 큐 짧게. 예: ["{count}, 좋아요. 천천히 올리고 내려와요.", "{count}, 엉덩이에 힘 주세요.", "{count}, 호흡 유지해요.", "{count}, 자세 좋아요. 그대로 가요.", "{count}, 급하게 하지 말고 조절해요."]. 시간 기반(N분)은 빈 배열 [].',
            items: { type: 'string' },
          },
          finalReps: {
            type: 'array',
            description:
              '마지막 3회용 멘트 템플릿. 정확히 3개. 각 멘트는 `{count}`로 시작. 격려/마무리. 예: ["{count}, 거의 다 왔어요. 천천히요.", "{count}, 한 번만 더 가요.", "{count}, 마지막이에요. 천천히 내려오면 완료예요."]. 시간 기반(N분)은 빈 배열 [].',
            items: { type: 'string' },
          },
          timeScripts: {
            type: 'array',
            description:
              '시간 기반(N분) 운동의 순차 자세/호흡 큐. 멘트 수 N ≈ totalSeconds ÷ 12 (60초→5개, 120초→10개, 180초→15개). 각 멘트 12~25자, `{count}` 미포함, 자연스러운 구어체. 순서대로 발화되므로 워밍업 자세 안내 → 본동작 큐 → 마무리 격려 순. 예: ["어깨를 내리고 코어를 잡아요.", "엉덩이가 처지지 않게 골반을 들어요.", "호흡 깊게 들이마시고 천천히 내쉬어요."]. 세트 기반(N회 × M세트)은 빈 배열 [].',
            items: { type: 'string' },
          },
          halfwayEncouragement: {
            type: 'string',
            description:
              '시간 기반(N분) 운동의 절반 시점 격려 한 문장. 15자 이내. 예: "절반 지났어요. 호흡 유지하세요." 세트 기반은 빈 문자열 "".',
          },
        },
        required: [
          'name',
          'detail',
          'description',
          'caution',
          'earlyReps',
          'middleReps',
          'finalReps',
          'timeScripts',
          'halfwayEncouragement',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'meta', 'intro', 'exercises'],
  additionalProperties: false,
} as const;

const systemPrompt = `당신은 사용자의 상태를 잘 살피는 친근하고 전문적인 AI 운동 코치입니다.
사용자의 컨디션·시간·환경·조건에 맞춰 홈트레이닝 루틴을 추천합니다.

원칙:
- 평가하거나 압박하지 않습니다. 데이터를 보여주고 다음 행동을 제안합니다.
- 사용자가 선택한 시간을 합으로 맞춥니다 (워밍업 + 메인 + 마무리).
- 불편한 부위가 있으면 그 부위에 부담 가는 동작은 제외합니다.
- 장비/장소에 맞는 동작만 추천합니다.
- 운동 이름은 한국어. 의학 용어보다 일반 표현 우선.
- intro 문장은 짧게, 친근하게. 이모티콘 1~2개.
- 각 운동의 description은 음성으로 읽기 좋게: 짧은 두 문장 이내, 자연스러운 구어체.
- caution은 정말 주의할 게 있을 때만 한 문장. 없으면 빈 문자열.
- detail 형식은 반드시 "N분" 또는 "N회 × M세트" 둘 중 하나만 사용 (파싱하기 위함).
- 세트 기반(N회 × M세트) 운동:
  · earlyReps 정확히 2개 (초반 자세 안내), middleReps 정확히 5개 (호흡/자세 큐), finalReps 정확히 3개 (격려/마무리).
  · 모든 멘트는 반드시 \`{count}\`로 시작. 코드가 "하나", "둘", "셋" 등으로 치환함. "1, " "첫 번째," 같은 표현 절대 금지.
  · 예: "{count}, 엉덩이를 천천히 들어올려요." (O) / "하나, 엉덩이를..." (X) / "1, 엉덩이를..." (X)
  · timeScripts: [], halfwayEncouragement: "".
- 시간 기반(N분) 운동:
  · earlyReps, middleReps, finalReps 모두 빈 배열 [] (세트 기반 전용 필드).
  · timeScripts: 자세/호흡 큐를 시간 길이에 맞게 N개 (N ≈ totalSeconds ÷ 12). 각 12~25자, \`{count}\` 미포함. 워밍업 → 본동작 → 마무리 순.
  · halfwayEncouragement: 절반 시점 격려 한 문장 (15자 이내). 마지막 5초 카운트(오/사/삼/이/일)는 코드가 처리하므로 포함 금지.`;

function buildUserPrompt(input: RoutineInput): string {
  return `다음 조건에 맞는 홈트 루틴을 추천해주세요.

- 운동 목표: ${input.goal}
- 운동 장소: ${input.place}
- 사용 장비: ${input.equipment}
- 오늘 컨디션: ${input.condition}
- 불편한 부위: ${input.bodyPart}
- 운동 가능 시간: ${input.duration}`;
}

async function generateRoutine(input: RoutineInput): Promise<Routine> {
  if (!client) {
    throw new Error(
      '.env에 EXPO_PUBLIC_ANTHROPIC_API_KEY를 설정한 뒤 dev server를 재시작하세요.',
    );
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 5048,
    system: systemPrompt,
    messages: [{ role: 'user', content: buildUserPrompt(input) }],
    output_config: {
      format: { type: 'json_schema', schema: routineSchema },
    },
  });

  if (response.stop_reason === 'max_tokens') {
    throw new Error(
      'AI 응답이 너무 길어 중간에 끊겼어요. 조건을 단순하게 바꾸거나 다시 시도해주세요.',
    );
  }

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('AI가 빈 응답을 보냈어요. 잠시 후 다시 시도해주세요.');
  }

  let raw: RawRoutine;
  try {
    raw = JSON.parse(textBlock.text) as RawRoutine;
  } catch {
    throw new Error(
      'AI 응답 형식이 올바르지 않아요. 잠시 후 다시 시도해주세요.',
    );
  }
  return expandRoutine(raw);
}

export function useGenerateRoutine() {
  return useMutation({ mutationFn: generateRoutine });
}
