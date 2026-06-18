// Supabase Edge Function: AI 코치 (Claude 프록시) — 회원권 데이터를 개인화된 해석+행동으로.
// 배포: supabase functions deploy coach
// 시크릿: supabase secrets set ANTHROPIC_API_KEY=<console.anthropic.com 키>
// 호출: POST {SUPABASE_URL}/functions/v1/coach  (body: 집계 데이터 JSON)
//
// deno 런타임 — 앱(tsc) 빌드 대상이 아니라 tsconfig에서 제외됨. Anthropic 공식 SDK 사용.
import Anthropic from 'npm:@anthropic-ai/sdk';

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (req: Request) => Response | Promise<Response>): void };

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '' });

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

// FitBack Voice & Tone(docs/design-system.md §12)을 그대로 코치 규칙으로.
const SYSTEM = `당신은 FitBack의 AI 운동 코치다. 사용자를 평가하거나 훈련시키는 트레이너가 아니라,
현재 상태를 객관적으로 알려주고 다음 행동을 제안하는 코치다.

원칙:
- 평가하지 않는다. 데이터를 보여준다. 다음 행동을 제안한다.
- 죄책감·공포감을 유발하지 않는다. 손실은 사실로만 전달하고, 항상 해결책(행동)을 함께 제시한다.
- 응원·본전 프레이밍을 쓴다. 예: "한 번 더 가면 회당 비용이 내려가요", "지금 가면 이번 달 ROI가 올라가요".
- 수치와 행동을 함께, 짧고 명확하게. 과장 금지, 이모지 금지.
- 주어진 데이터에 근거해서만 말한다. 데이터에 없는 사실을 지어내지 않는다.
- 한국어로, 친근하지만 가볍지 않게.
- AI 문체 금지: "진행해주세요" "제공해드립니다" 같은 번역투, "물론이죠" "정말로" 같은 상투어,
  "대단해요!" 같은 빈 감탄 금지. 데이터에서 나온 구체적인 한 마디로 대체한다.
- 문장 길이를 획일화하지 않는다. 짧은 것과 긴 것을 자연스럽게 섞는다.

출력은 반드시 JSON 스키마에 맞춰:
- headline: 한 줄 요약 (이번 주 핵심 한마디, 20자 이내)
- insight: 데이터 기반 해석 한 문장, 30자 이내 (방문 패턴/페이스/손익 중 가장 의미 있는 것)
- action: 구체적인 다음 행동 1문장 (가능하면 수치 포함: "이번 주 N회", "회당 N원")`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    headline: { type: 'string' },
    insight: { type: 'string' },
    action: { type: 'string' },
  },
  required: ['headline', 'insight', 'action'],
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  try {
    const payload = await req.json();
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: SYSTEM,
      // deno 런타임 통과용 — 최신 SDK의 output_config 구조화 출력
      // deno-lint-ignore no-explicit-any
      output_config: { format: { type: 'json_schema', schema: SCHEMA } } as any,
      messages: [
        {
          role: 'user',
          content: `다음은 한 사용자의 회원권/방문/운동 데이터다. 이번 주 추천을 만들어줘.\n\n${JSON.stringify(payload)}`,
        },
      ],
    });
    const text = msg.content.find((b) => b.type === 'text');
    const out = text && 'text' in text ? JSON.parse(text.text) : null;
    if (!out) return json({ error: 'empty response' }, 502);
    return json(out);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
