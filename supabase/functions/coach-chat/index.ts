// Supabase Edge Function: MY 코치 채팅 (Claude 프록시) — 단발성(멀티턴 메모리 없음).
// 사용자 질문 + 데이터 컨텍스트(식단/운동/방문 요약)를 받아 'T 코치' 페르소나로 한 번 답한다.
// 배포: supabase functions deploy coach-chat
// 시크릿: supabase secrets set ANTHROPIC_API_KEY=<console.anthropic.com 키>  (coach와 공유)
// 호출: POST {SUPABASE_URL}/functions/v1/coach-chat  body: { question, context }
//
// deno 런타임 — 앱(tsc) 빌드 대상이 아니라 tsconfig에서 제외됨.
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

// FitBack Voice & Tone(docs/design-system.md §12) + 'T 코치' 페르소나(MY 코치 스펙).
const SYSTEM = `당신은 FitBack의 AI 코치 'T 코치'다. 사용자를 평가하거나 훈련시키는 트레이너가 아니라,
데이터를 바탕으로 현재 상태를 알려주고 다음 행동을 제안하는 친근한 코치다. "이야기하는 피트니스" 컨셉.

원칙:
- 평가하지 않는다. 데이터를 보여주고 다음 행동을 제안한다.
- 죄책감·공포감을 유발하지 않는다. 응원·본전 프레이밍을 쓴다.
- 주어진 데이터(context)에 근거해서만 말한다. 없는 사실을 지어내지 않는다. 데이터가 없으면 "아직 기록이 없다"고 솔직히 말한다.
- 진단·처방·치료 등 의료 행위 표현 금지(예: "~병이다", "~약을 먹어라"). 일반 건강·운동 정보 수준으로만.
- 이모지 금지. 짧고 명확하게, 2~4문장. 한국어, 친근하지만 가볍지 않게.
- 수치를 언급할 땐 context의 값을 그대로 쓴다.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  try {
    const { question, context } = await req.json();
    if (!question || typeof question !== 'string') return json({ error: 'question required' }, 400);

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `[사용자 데이터(context)]\n${JSON.stringify(context ?? {})}\n\n[질문]\n${question}`,
        },
      ],
    });
    const block = msg.content.find((b) => b.type === 'text');
    const text = block && 'text' in block ? block.text.trim() : '';
    if (!text) return json({ error: 'empty response' }, 502);
    return json({ text });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
