import Anthropic from '@anthropic-ai/sdk';
import { useMutation } from '@tanstack/react-query';

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

export interface RoutineExercise {
  name: string;
  detail: string;
}

export interface Routine {
  title: string;
  meta: string;
  intro: string;
  exercises: RoutineExercise[];
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
            description: '시간 또는 세트. 예: "2분", "12회 × 3세트"',
          },
        },
        required: ['name', 'detail'],
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
- intro 문장은 짧게, 친근하게. 이모티콘 1~2개.`;

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
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: buildUserPrompt(input) }],
    output_config: {
      format: { type: 'json_schema', schema: routineSchema },
    },
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude가 빈 응답을 반환했습니다.');
  }

  return JSON.parse(textBlock.text) as Routine;
}

export function useGenerateRoutine() {
  return useMutation({ mutationFn: generateRoutine });
}
