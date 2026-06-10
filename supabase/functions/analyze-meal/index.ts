// Edge Function: analyze-meal (DB 근거 보강)
// 자연어 식단 설명을 Claude로 "음식 + 섭취량(g)"으로 분해한 뒤,
// 각 음식을 식품안전나라 식품영양성분 DB(I2790)에서 조회해 실측값을 섭취량만큼 스케일·합산한다.
// DB에 없는 음식만 Claude의 추정값으로 폴백 → 숫자를 지어내지 않고 가능한 한 실측에 근거.
//
// 배포:    npx supabase functions deploy analyze-meal
// secrets: npx supabase secrets set ANTHROPIC_API_KEY=... FOOD_SAFETY_API_KEY=...
//
// 앱에서 호출:
//   supabase.functions.invoke('analyze-meal', { body: { text: '닭가슴살 200g, 현미밥 한공기' } })
//   // data: { name, kcal, carb, protein, fat, items: [{name, grams, source}] }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

// Claude가 채울 구조: 음식별 섭취량(g) + DB 미스 대비 폴백 추정값(섭취량 기준).
const EXTRACT_TOOL = {
  name: 'extract_items',
  description: '식단 설명을 음식 단위로 분해하고, 각 음식의 섭취량과 영양 추정값을 채운다.',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        description: '먹은 음식 목록',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'DB 검색용 핵심 식품명(간결하게, 예: "닭가슴살", "현미밥", "바나나")' },
            grams: { type: 'number', description: '추정 섭취량(g). 분량 표현을 반영, 없으면 1인분 기준' },
            kcal: { type: 'number', description: '이 섭취량 기준 열량(kcal) 폴백 추정' },
            carb: { type: 'number', description: '이 섭취량 기준 탄수화물(g) 폴백 추정' },
            protein: { type: 'number', description: '이 섭취량 기준 단백질(g) 폴백 추정' },
            fat: { type: 'number', description: '이 섭취량 기준 지방(g) 폴백 추정' },
          },
          required: ['name', 'grams', 'kcal', 'carb', 'protein', 'fat'],
        },
      },
    },
    required: ['items'],
  },
} as const;

const SYSTEM =
  'You are FitBack, a Korean nutrition parser. 사용자의 식단 설명을 음식 단위로 분해하라. ' +
  '각 음식의 섭취량을 g으로 추정하고(한공기≈210g, 1조각/1개 등 상식적으로), ' +
  'DB 조회 실패에 대비한 폴백 영양값도 그 섭취량 기준으로 채워라. ' +
  'name은 DB에서 찾기 쉬운 핵심 식품명으로 간결하게. 반드시 extract_items 도구를 호출하라.';

interface Item {
  name: string;
  grams: number;
  kcal: number;
  carb: number;
  protein: number;
  fat: number;
}

// 식품영양성분DB(getFoodNtrCpntDbInq02)에서 음식명으로 100g당 영양 조회.
//   AMT_NUM1=열량, AMT_NUM3=단백질, AMT_NUM4=지방, AMT_NUM6=탄수화물 (SERVING_SIZE=100g 기준)
// 여러 매칭 중 이름이 가장 짧은(=기본형) 식품을 고른다. 실패/미스는 null.
function extractItems(data: unknown): Record<string, unknown>[] {
  const root = (data as { response?: unknown })?.response ?? data;
  const body = (root as { body?: unknown })?.body ?? root;
  const items = (body as { items?: unknown })?.items;
  if (Array.isArray(items)) return items as Record<string, unknown>[];
  const inner = (items as { item?: unknown })?.item;
  if (Array.isArray(inner)) return inner as Record<string, unknown>[];
  if (inner && typeof inner === 'object') return [inner as Record<string, unknown>];
  return [];
}

async function lookupPer100g(
  key: string,
  name: string,
): Promise<{ kcal: number; carb: number; protein: number; fat: number } | null> {
  try {
    const url =
      `https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02` +
      `?serviceKey=${encodeURIComponent(key)}&type=json&pageNo=1&numOfRows=10` +
      `&FOOD_NM_KR=${encodeURIComponent(name)}`;
    const res = await fetch(url);
    if (!(res.headers.get('content-type') ?? '').includes('json')) return null;
    const rows = extractItems(await res.json()).filter((r) => typeof r.FOOD_NM_KR === 'string');
    if (rows.length === 0) return null;
    // 이 DB는 가공·외식 식품이 많아 부분일치는 엉뚱한 값을 주입한다.
    // → "정확히 같은 이름"일 때만 DB 채택, 아니면 null(=Claude 추정 폴백).
    const row = rows.find((r) => String(r.FOOD_NM_KR).trim() === name.trim());
    if (!row) return null;
    return {
      kcal: num(row.AMT_NUM1),
      carb: num(row.AMT_NUM6),
      protein: num(row.AMT_NUM3),
      fat: num(row.AMT_NUM4),
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  const FOOD_SAFETY_API_KEY = Deno.env.get('FOOD_SAFETY_API_KEY');
  if (!ANTHROPIC_API_KEY) return json({ error: 'Missing ANTHROPIC_API_KEY secret' }, 500);

  let payload: { text?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const text = (payload.text ?? '').trim();
  if (!text) return json({ error: 'body.text 가 필요합니다' }, 400);

  // 1) Claude로 음식·섭취량 분해 (+ 폴백 추정)
  let claudeRes: Response;
  try {
    claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SYSTEM,
        tools: [EXTRACT_TOOL],
        tool_choice: { type: 'tool', name: 'extract_items' },
        messages: [{ role: 'user', content: `먹은 음식: ${text}` }],
      }),
    });
  } catch (e) {
    return json({ error: 'Claude fetch failed', detail: String(e) }, 502);
  }
  if (!claudeRes.ok) {
    const detail = await claudeRes.text();
    return json({ error: 'Claude API error', status: claudeRes.status, detail }, 502);
  }

  const claude = await claudeRes.json();
  const block = Array.isArray(claude?.content)
    ? claude.content.find((c: { type?: string }) => c?.type === 'tool_use')
    : null;
  const rawItems = block?.input?.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return json({ error: 'Claude가 음식을 분해하지 못했어요', detail: claude }, 502);
  }

  const items: Item[] = rawItems.map((r: Record<string, unknown>) => ({
    name: typeof r.name === 'string' ? r.name.trim() : '',
    grams: Math.max(0, num(r.grams)),
    kcal: Math.max(0, num(r.kcal)),
    carb: Math.max(0, num(r.carb)),
    protein: Math.max(0, num(r.protein)),
    fat: Math.max(0, num(r.fat)),
  }));

  // 2) 각 음식을 I2790에서 조회 → 섭취량만큼 스케일. 미스는 Claude 폴백 사용.
  const resolved = await Promise.all(
    items.map(async (it) => {
      const per100 = FOOD_SAFETY_API_KEY && it.name ? await lookupPer100g(FOOD_SAFETY_API_KEY, it.name) : null;
      if (per100) {
        const f = it.grams / 100;
        return {
          name: it.name,
          grams: it.grams,
          source: 'db' as const,
          kcal: per100.kcal * f,
          carb: per100.carb * f,
          protein: per100.protein * f,
          fat: per100.fat * f,
        };
      }
      return { name: it.name, grams: it.grams, source: 'estimate' as const, kcal: it.kcal, carb: it.carb, protein: it.protein, fat: it.fat };
    }),
  );

  // 3) 합산
  const sum = resolved.reduce(
    (a, r) => ({ kcal: a.kcal + r.kcal, carb: a.carb + r.carb, protein: a.protein + r.protein, fat: a.fat + r.fat }),
    { kcal: 0, carb: 0, protein: 0, fat: 0 },
  );
  const name = resolved.map((r) => r.name).filter(Boolean).join(' + ') || text;

  return json({
    name,
    kcal: Math.round(sum.kcal),
    carb: Math.round(sum.carb),
    protein: Math.round(sum.protein),
    fat: Math.round(sum.fat),
    items: resolved.map((r) => ({ name: r.name, grams: Math.round(r.grams), source: r.source })),
  });
});
