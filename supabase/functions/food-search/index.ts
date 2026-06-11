// Edge Function: food-search (식단 기능용 통합 함수)
// Supabase에 'food-search' 이름으로 배포됨. 검색+분석을 body.action 으로 분기한다.
//   action='search'        : { query }            → 식품영양성분DB 검색 결과 리스트(100g 기준)
//   action='analyze'       : { text, grams? }      → 자연어 식단 → Claude 추출 + DB 정확일치 보정 → 합산
//   action='analyze-image' : { image(base64), mediaType } → 음식 사진 → Claude 비전 → 동일 파이프라인
//
// 데이터: 공공데이터포털 식품의약품안전처_식품영양성분DB정보(15127578)
//   엔드포인트 apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02
//   필드(100g=SERVING_SIZE 기준): FOOD_NM_KR, AMT_NUM1=열량, AMT_NUM3=단백질, AMT_NUM4=지방, AMT_NUM6=탄수화물
//
// 배포:    npx supabase functions deploy food-search
// secrets: npx supabase secrets set FOOD_SAFETY_API_KEY=... ANTHROPIC_API_KEY=...
//
// 앱 호출:
//   supabase.functions.invoke('food-search', { body: { action: 'search', query: '닭가슴살' } })
//   supabase.functions.invoke('food-search', { body: { action: 'analyze', text: '치킨 2조각, 현미밥 한공기' } })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// ── 공통 ────────────────────────────────────────────────
const F = { kcal: 'AMT_NUM1', protein: 'AMT_NUM3', fat: 'AMT_NUM4', carb: 'AMT_NUM6' } as const;

function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/,/g, '').replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

// 응답 래핑(response/body/items)을 유연하게 처리
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

// getFoodNtrCpntDbInq02 호출 → 행 배열. 키/네트워크 문제는 throw.
async function fetchFoodRows(key: string, query: string, rows: number): Promise<Record<string, unknown>[]> {
  const url =
    `https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02` +
    `?serviceKey=${encodeURIComponent(key)}&type=json&pageNo=1&numOfRows=${rows}` +
    `&FOOD_NM_KR=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!(res.headers.get('content-type') ?? '').includes('json')) {
    const detail = await res.text();
    throw new Error(`NON_JSON(${res.status}): ${detail.slice(0, 200)}`);
  }
  return extractItems(await res.json()).filter((r) => typeof r.FOOD_NM_KR === 'string');
}

// ── action: search ──────────────────────────────────────
interface FoodSearchResult {
  name: string; kcal: number; carb: number; protein: number; fat: number; servingSize: string | null;
}
async function handleSearch(key: string, query: string) {
  if (!query) return json({ results: [] });
  try {
    const rows = await fetchFoodRows(key, query, 25);
    const results: FoodSearchResult[] = rows.map((r) => ({
      name: str(r.FOOD_NM_KR),
      kcal: Math.round(num(r[F.kcal])),
      carb: num(r[F.carb]),
      protein: num(r[F.protein]),
      fat: num(r[F.fat]),
      servingSize: str(r.SERVING_SIZE) || null,
    }));
    results.sort((a, b) => a.name.length - b.name.length); // 기본 식품 우선
    return json({ results });
  } catch (e) {
    return json({ error: 'food DB 조회 실패', detail: String(e instanceof Error ? e.message : e) }, 502);
  }
}

// ── action: analyze ─────────────────────────────────────
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
            name: { type: 'string', description: '핵심 식품명(간결하게, 예: "닭가슴살", "현미밥")' },
            grams: { type: 'number', description: '추정 섭취량(g). 분량 표현 있으면 반영. 없으면: 낱개로 세는 음식(방울토마토·사과·계란·바나나 등)은 1개 분량, 무게로 먹는 음식(밥·고기·채소·면 등)은 100g 기준.' },
            kcal: { type: 'number', description: '이 섭취량 기준 열량(kcal) 추정' },
            carb: { type: 'number', description: '이 섭취량 기준 탄수화물(g) 추정' },
            protein: { type: 'number', description: '이 섭취량 기준 단백질(g) 추정' },
            fat: { type: 'number', description: '이 섭취량 기준 지방(g) 추정' },
          },
          required: ['name', 'grams', 'kcal', 'carb', 'protein', 'fat'],
        },
      },
    },
    required: ['items'],
  },
} as const;
const SYSTEM =
  'You are FitBack, a Korean nutrition parser. 사용자가 준 식단(텍스트 또는 음식 사진)을 음식 단위로 분해하라. ' +
  '각 음식의 섭취량을 g으로 추정한다. 분량 표현(2조각, 한공기, 250g 등)이 있으면 그대로 반영하고(한공기≈210g), ' +
  '분량 표현이 없으면 기본값을 적용: 낱개로 세는 음식(방울토마토·사과·계란·바나나·만두 등)은 "1개" 분량으로, ' +
  '무게로 먹는 음식(밥·고기·채소·면·국 등)은 "100g" 기준으로 추정하라. ' +
  '그 섭취량 기준 영양값도 정확히 추정하라. name은 간결한 핵심 식품명으로. 반드시 extract_items 도구를 호출하라.';

// 식품DB에서 100g당 영양 조회 — 정확일치일 때만 채택(부분일치는 가공식품 오매칭).
async function lookupPer100g(key: string, name: string) {
  try {
    const rows = await fetchFoodRows(key, name, 10);
    const row = rows.find((r) => String(r.FOOD_NM_KR).trim() === name.trim());
    if (!row) return null;
    return { kcal: num(row[F.kcal]), carb: num(row[F.carb]), protein: num(row[F.protein]), fat: num(row[F.fat]) };
  } catch {
    return null;
  }
}

// Claude 호출(텍스트/이미지 공통) → extract_items 결과 배열. 실패 시 throw.
async function claudeExtract(anthropicKey: string, content: unknown): Promise<Record<string, unknown>[]> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: 'tool', name: 'extract_items' },
      messages: [{ role: 'user', content }],
    }),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const claude = await res.json();
  const block = Array.isArray(claude?.content) ? claude.content.find((c: { type?: string }) => c?.type === 'tool_use') : null;
  const items = block?.input?.items;
  if (!Array.isArray(items) || items.length === 0) throw new Error('NO_ITEMS');
  return items;
}

// extract_items 결과 → DB 정확일치 보정 → 합산한 응답 페이로드
async function buildAnalysis(foodKey: string | undefined, rawItems: Record<string, unknown>[], fallbackName: string) {
  const items = rawItems.map((r) => ({
    name: str(r.name),
    grams: Math.max(0, num(r.grams)),
    kcal: Math.max(0, num(r.kcal)),
    carb: Math.max(0, num(r.carb)),
    protein: Math.max(0, num(r.protein)),
    fat: Math.max(0, num(r.fat)),
  }));
  const resolved = await Promise.all(
    items.map(async (it) => {
      const per100 = foodKey && it.name ? await lookupPer100g(foodKey, it.name) : null;
      if (per100) {
        const f = it.grams / 100;
        return { name: it.name, grams: it.grams, source: 'db' as const, kcal: per100.kcal * f, carb: per100.carb * f, protein: per100.protein * f, fat: per100.fat * f };
      }
      return { name: it.name, grams: it.grams, source: 'estimate' as const, kcal: it.kcal, carb: it.carb, protein: it.protein, fat: it.fat };
    }),
  );
  const sum = resolved.reduce((a, r) => ({ kcal: a.kcal + r.kcal, carb: a.carb + r.carb, protein: a.protein + r.protein, fat: a.fat + r.fat }), { kcal: 0, carb: 0, protein: 0, fat: 0 });
  return {
    name: resolved.map((r) => r.name).filter(Boolean).join(' + ') || fallbackName,
    kcal: Math.round(sum.kcal),
    carb: Math.round(sum.carb),
    protein: Math.round(sum.protein),
    fat: Math.round(sum.fat),
    items: resolved.map((r) => ({ name: r.name, grams: Math.round(r.grams), source: r.source })),
  };
}

async function handleAnalyze(anthropicKey: string, foodKey: string | undefined, text: string, grams?: number) {
  if (!text) return json({ error: 'text 가 필요합니다' }, 400);
  const userMsg = grams && grams > 0
    ? `먹은 음식: ${text}\n사용자가 알려준 총 섭취량은 ${grams}g 이다. items의 grams 합이 이 값이 되도록 분배하고, 영양값도 그에 맞춰라.`
    : `먹은 음식: ${text}`;
  try {
    const raw = await claudeExtract(anthropicKey, userMsg);
    return json(await buildAnalysis(foodKey, raw, text));
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    return json({ error: msg === 'NO_ITEMS' ? '음식을 분해하지 못했어요' : '분석 실패', detail: msg }, 502);
  }
}

async function handleAnalyzeImage(anthropicKey: string, foodKey: string | undefined, image: string, mediaType?: string) {
  if (!image) return json({ error: 'image 가 필요합니다' }, 400);
  const content = [
    { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: image } },
    { type: 'text', text: '이 사진에 보이는 음식을 분석해 extract_items로 채워라. 사진에 음식이 없으면 빈 목록.' },
  ];
  try {
    const raw = await claudeExtract(anthropicKey, content);
    return json(await buildAnalysis(foodKey, raw, '사진 분석'));
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    return json({ error: msg === 'NO_ITEMS' ? '사진에서 음식을 인식하지 못했어요' : '분석 실패', detail: msg }, 502);
  }
}

// ── action: recommend ───────────────────────────────────
const RECOMMEND_TOOL = {
  name: 'recommend_foods',
  description: '부족한 영양소를 채울 한국식 음식을 개별로 추천한다.',
  input_schema: {
    type: 'object',
    properties: {
      foods: {
        type: 'array',
        description: '추천 음식 4~6개',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '음식명 (간결하게, 예: "닭가슴살", "고구마")' },
            amount: { type: 'number', description: '분량 수치' },
            unit: { type: 'string', description: '단위 (g, 개, 컵, 공기 등)' },
          },
          required: ['name', 'amount', 'unit'],
        },
      },
    },
    required: ['foods'],
  },
} as const;
const RECOMMEND_SYSTEM =
  'You are FitBack, a Korean nutrition coach. 부족한 영양소를 효율적으로 채울 한국식 음식 4~6개를 개별로 추천하라. ' +
  '서로 다른 음식으로 다양하게, 각 음식에 현실적인 분량을 붙여라. 운동 회복 맥락이 있으면 반영. 반드시 recommend_foods 도구를 호출하라.';

async function handleRecommend(anthropicKey: string, deficits: { label?: string; g?: number }[], context?: string) {
  const lines = (Array.isArray(deficits) ? deficits : [])
    .filter((d) => d && d.label && num(d.g) > 0)
    .map((d) => `${d.label} ${Math.round(num(d.g))}g`)
    .join(', ');
  if (!lines) return json({ foods: [] });
  const userMsg = `부족한 영양소: ${lines}.${context ? ` 맥락: ${context}.` : ''} 이를 채울 음식을 개별로 추천해줘.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: RECOMMEND_SYSTEM,
      tools: [RECOMMEND_TOOL],
      tool_choice: { type: 'tool', name: 'recommend_foods' },
      messages: [{ role: 'user', content: userMsg }],
    }),
  });
  if (!res.ok) return json({ error: 'Claude API error', status: res.status, detail: await res.text() }, 502);
  const claude = await res.json();
  const block = Array.isArray(claude?.content) ? claude.content.find((c: { type?: string }) => c?.type === 'tool_use') : null;
  const rawFoods = block?.input?.foods;
  if (!Array.isArray(rawFoods)) return json({ foods: [] });

  const foods = rawFoods
    .map((f: Record<string, unknown>) => ({ name: str(f.name), amount: Math.round(num(f.amount)), unit: str(f.unit) || 'g' }))
    .filter((f: { name: string }) => f.name);
  return json({ foods });
}

// ── action: feedback ────────────────────────────────────
// 방금 기록한 음식 + 운동 맥락 → 트레이너 톤의 짧은 피드백(2~3문장).
const FEEDBACK_SYSTEM =
  'You are FitBack, an experienced Korean personal trainer (퍼스널 트레이너) who actively manages this member. ' +
  '회원이 방금 기록한 한 끼의 영양값과 오늘 운동을 보고, 실제 PT가 회원을 관리하듯 구체적이고 솔직하게 코칭하라.\n' +
  '규칙:\n' +
  '1) 잘한 점은 인정하되, 부족하거나 과한 점은 솔직히 짚어라. 무조건 칭찬만 하지 마라.\n' +
  '2) 단백질·탄수·지방 수치를 직접 근거로 들어 말하라. 예: "단백질 25g은 회복엔 살짝 부족해요". (한 끼 단백질 30g 안팎을 회복 기준으로 본다)\n' +
  '3) 다음 끼니에 무엇을 더하거나 줄일지 실제 음식(닭가슴살·계란·고구마·현미밥 등)으로 구체적으로 제안하라.\n' +
  '4) 오늘 운동 맥락이 있으면 반드시 회복 관점과 연결하라.\n' +
  '5) 친근한 존댓말("~예요/~해요/~보세요"), 3~5문장. 이모지·마크다운 없이 순수 문장만.\n' +
  '6) 죄책감·공포 유발 대신 동기부여로 마무리하라.\n' +
  '출력 형식: 첫 줄에 16자 이내의 한 줄 요약을 쓰고, 줄바꿈(\\n) 후 상세 코칭 3~5문장을 이어 써라.';

async function handleFeedback(
  anthropicKey: string,
  meal: { name?: string; kcal?: number; carb?: number; protein?: number; fat?: number; mealType?: string },
  context?: string,
) {
  const name = str(meal?.name);
  if (!name) return json({ feedback: '' });
  const userMsg =
    `회원이 기록한 끼니: ${str(meal.mealType) || '식사'}\n` +
    `음식: ${name}\n` +
    `영양: ${Math.round(num(meal.kcal))}kcal · 탄 ${Math.round(num(meal.carb))}g · 단 ${Math.round(num(meal.protein))}g · 지 ${Math.round(num(meal.fat))}g\n` +
    `${context ? `오늘 운동: ${context}\n` : ''}` +
    `이 끼니에 대해 트레이너로서 짧게 피드백해줘.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: FEEDBACK_SYSTEM,
      messages: [{ role: 'user', content: userMsg }],
    }),
  });
  if (!res.ok) return json({ error: 'Claude API error', status: res.status, detail: await res.text() }, 502);
  const claude = await res.json();
  const feedback = str(claude?.content?.[0]?.text);
  return json({ feedback });
}

// ── 라우터 ──────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const FOOD_SAFETY_API_KEY = Deno.env.get('FOOD_SAFETY_API_KEY');
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

  let payload: {
    action?: string; query?: string; text?: string; grams?: number;
    image?: string; mediaType?: string; deficits?: { label?: string; g?: number }[]; context?: string;
    meal?: { name?: string; kcal?: number; carb?: number; protein?: number; fat?: number; mealType?: string };
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (payload.action === 'search') {
    if (!FOOD_SAFETY_API_KEY) return json({ error: 'Missing FOOD_SAFETY_API_KEY secret' }, 500);
    return handleSearch(FOOD_SAFETY_API_KEY, (payload.query ?? '').trim());
  }
  if (payload.action === 'analyze') {
    if (!ANTHROPIC_API_KEY) return json({ error: 'Missing ANTHROPIC_API_KEY secret' }, 500);
    return handleAnalyze(ANTHROPIC_API_KEY, FOOD_SAFETY_API_KEY, (payload.text ?? '').trim(), payload.grams);
  }
  if (payload.action === 'analyze-image') {
    if (!ANTHROPIC_API_KEY) return json({ error: 'Missing ANTHROPIC_API_KEY secret' }, 500);
    return handleAnalyzeImage(ANTHROPIC_API_KEY, FOOD_SAFETY_API_KEY, payload.image ?? '', payload.mediaType);
  }
  if (payload.action === 'recommend') {
    if (!ANTHROPIC_API_KEY) return json({ error: 'Missing ANTHROPIC_API_KEY secret' }, 500);
    return handleRecommend(ANTHROPIC_API_KEY, payload.deficits ?? [], payload.context);
  }
  if (payload.action === 'feedback') {
    if (!ANTHROPIC_API_KEY) return json({ error: 'Missing ANTHROPIC_API_KEY secret' }, 500);
    return handleFeedback(ANTHROPIC_API_KEY, payload.meal ?? {}, payload.context);
  }
  return json({ error: "body.action 은 'search' | 'analyze' | 'analyze-image' | 'recommend' | 'feedback' 여야 합니다" }, 400);
});
