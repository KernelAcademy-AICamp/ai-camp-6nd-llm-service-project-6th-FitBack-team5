// Supabase Edge Function: 회원권 영수증 OCR (Claude Vision)
// 영수증 사진(base64) → 구조화 필드 추출 { name, cost, startDate }.
// 배포: supabase functions deploy receipt-ocr
// 시크릿: ANTHROPIC_API_KEY (coach/food-search와 공유)
// 호출: POST {SUPABASE_URL}/functions/v1/receipt-ocr  body: { image(base64), mediaType }

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (req: Request) => Response | Promise<Response>): void };

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

const SYSTEM =
  '너는 헬스장·PT·필라테스 등 운동 회원권 영수증/결제내역 이미지에서 정보를 추출하는 도구다. ' +
  '확실한 값만 추출하고, 불확실하면 해당 필드를 비운다(추측 금지).';

const EXTRACT_TOOL = {
  name: 'extract_receipt',
  description: '영수증에서 회원권 등록 필드를 추출한다.',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '회원권명/상품명/상호명 (예: 강남 PT 30회). 없으면 생략.' },
      cost: { type: 'number', description: '결제 금액(숫자만, 원). 없으면 생략.' },
      startDate: { type: 'string', description: '시작일 또는 결제일 YYYY-MM-DD. 없으면 생략.' },
    },
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  try {
    const { image, mediaType } = await req.json();
    if (!image || typeof image !== 'string') return json({ error: 'image(base64)가 필요합니다.' }, 400);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        system: SYSTEM,
        tools: [EXTRACT_TOOL],
        tool_choice: { type: 'tool', name: 'extract_receipt' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: image } },
              { type: 'text', text: '이 영수증에서 회원권명·결제금액·시작일을 추출해줘.' },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return json({ error: `Claude ${res.status}: ${(await res.text()).slice(0, 200)}` }, 502);
    const claude = await res.json();
    const block = Array.isArray(claude?.content)
      ? claude.content.find((c: { type?: string }) => c?.type === 'tool_use')
      : null;
    const out = (block?.input ?? {}) as { name?: unknown; cost?: unknown; startDate?: unknown };

    return json({
      name: typeof out.name === 'string' ? out.name.slice(0, 40) : undefined,
      cost: typeof out.cost === 'number' ? Math.round(out.cost) : undefined,
      startDate: typeof out.startDate === 'string' ? out.startDate : undefined,
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
