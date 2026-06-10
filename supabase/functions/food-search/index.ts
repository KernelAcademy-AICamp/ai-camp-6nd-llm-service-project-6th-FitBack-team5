// Edge Function: food-search
// 공공데이터포털 식품의약품안전처_식품영양성분DB정보(15127578) API로 음식명 검색
//   엔드포인트: apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02
//   영양값은 식품 100g(SERVING_SIZE) 기준.
// API 키는 Edge Function 환경에서만 읽으므로 클라이언트에 노출되지 않는다.
//
// 배포:    npx supabase functions deploy food-search
// secrets: npx supabase secrets set FOOD_SAFETY_API_KEY=<data.go.kr 인증키>
//
// 앱에서 호출:
//   supabase.functions.invoke('food-search', { body: { query: '닭가슴살' } })
//   // data.results: FoodSearchResult[]  (각 값은 식품 100g 기준)

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

interface FoodSearchResult {
  name: string;
  kcal: number;
  carb: number;
  protein: number;
  fat: number;
  servingSize: string | null;
}

// 식품영양성분DB AMT_NUM 매핑 (SERVING_SIZE=100g 기준)
const F = { kcal: 'AMT_NUM1', protein: 'AMT_NUM3', fat: 'AMT_NUM4', carb: 'AMT_NUM6' } as const;

// "4,720.000" 같은 천단위 콤마/단위 문자 제거 후 숫자화
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

// 응답 래핑(response/body/items)이 버전마다 달라 유연하게 items 배열을 찾는다.
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

function toResult(r: Record<string, unknown>): FoodSearchResult | null {
  const name = str(r.FOOD_NM_KR);
  if (!name) return null;
  return {
    name,
    kcal: Math.round(num(r[F.kcal])),
    carb: num(r[F.carb]),
    protein: num(r[F.protein]),
    fat: num(r[F.fat]),
    servingSize: str(r.SERVING_SIZE) || null,
  };
}

// getFoodNtrCpntDbInq02 호출 → 정규화 결과. 키/네트워크 문제는 throw.
export async function searchFoodDb(key: string, query: string, rows = 25): Promise<FoodSearchResult[]> {
  const url =
    `https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02` +
    `?serviceKey=${encodeURIComponent(key)}&type=json&pageNo=1&numOfRows=${rows}` +
    `&FOOD_NM_KR=${encodeURIComponent(query)}`;

  const res = await fetch(url);
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('json')) {
    // 키 미승인/오류 시 text/plain "Unexpected errors" 또는 XML returnReasonCode
    const detail = await res.text();
    throw new Error(`NON_JSON(${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  const results = extractItems(data)
    .map(toResult)
    .filter((r): r is FoodSearchResult => r !== null);
  // 기본 식품(짧은 이름)이 먼저 보이도록 이름 길이순 정렬
  results.sort((a, b) => a.name.length - b.name.length);
  return results;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const FOOD_SAFETY_API_KEY = Deno.env.get('FOOD_SAFETY_API_KEY');
  if (!FOOD_SAFETY_API_KEY) return json({ error: 'Missing FOOD_SAFETY_API_KEY secret' }, 500);

  let payload: { query?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const query = (payload.query ?? '').trim();
  if (!query) return json({ results: [] });

  try {
    const results = await searchFoodDb(FOOD_SAFETY_API_KEY, query);
    return json({ results });
  } catch (e) {
    return json({ error: 'food DB 조회 실패', detail: String(e instanceof Error ? e.message : e) }, 502);
  }
});
