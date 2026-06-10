// Edge Function: food-search
// 식약처(식품영양성분 DB) API로 음식명 검색 → 정규화된 결과 리스트 반환.
// API 키는 Edge Function 환경에서만 읽으므로 클라이언트에 노출되지 않는다.
//
// 로컬 실행:  npx supabase functions serve food-search --env-file .env
// 배포:       npx supabase functions deploy food-search
// secrets:    npx supabase secrets set FOOD_SAFETY_API_KEY=...
//
// 앱에서 호출:
//   const { data, error } = await supabase.functions.invoke('food-search', {
//     body: { query: '닭가슴살', page: 1 },
//   });
//   // data.results: FoodSearchResult[]

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

// 식약처 응답 1건 → 앱 모델. 필드명은 API 버전에 따라 다를 수 있어 여러 후보를 시도한다.
interface FoodSearchResult {
  name: string;
  kcal: number;
  carb: number;
  protein: number;
  fat: number;
  servingSize: string | null;
}

// 문자열/숫자 혼재 + 빈 값('-', '') 방어. 숫자만 추출.
function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

// 여러 후보 키 중 첫 번째로 존재하는 값을 꺼낸다 (legacy/신규 API 필드명 차이 흡수).
function pick(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
  }
  return undefined;
}

function normalize(row: Record<string, unknown>): FoodSearchResult | null {
  // 식품명: legacy DESC_KOR / 신규 FOOD_NM_KR
  const name = str(pick(row, ['DESC_KOR', 'FOOD_NM_KR', 'desc_kor', 'foodNmKr']));
  if (!name) return null;
  return {
    name,
    // 열량: legacy NUTR_CONT1 / 신규 AMT_NUM1, ENERC
    kcal: num(pick(row, ['NUTR_CONT1', 'AMT_NUM1', 'ENERC', 'enerc'])),
    // 탄수화물: legacy NUTR_CONT2 / 신규 AMT_NUM6, CHOCDF
    carb: num(pick(row, ['NUTR_CONT2', 'AMT_NUM6', 'CHOCDF', 'chocdf'])),
    // 단백질: legacy NUTR_CONT3 / 신규 AMT_NUM3, PROT
    protein: num(pick(row, ['NUTR_CONT3', 'AMT_NUM3', 'PROT', 'prot'])),
    // 지방: legacy NUTR_CONT4 / 신규 AMT_NUM4, FATCE
    fat: num(pick(row, ['NUTR_CONT4', 'AMT_NUM4', 'FATCE', 'fatce'])),
    servingSize: str(pick(row, ['SERVING_SIZE', 'Z10500', 'servingSize'])) || null,
  };
}

// data.go.kr JSON은 래핑 구조가 버전마다 다르다. body.items 위치를 유연하게 찾는다.
function extractItems(data: unknown): Record<string, unknown>[] {
  const root = (data as { response?: unknown })?.response ?? data;
  const body = (root as { body?: unknown })?.body ?? root;
  const items = (body as { items?: unknown })?.items;
  if (Array.isArray(items)) return items as Record<string, unknown>[];
  // 단건일 때 { items: { item: {...} } } 형태가 오기도 함
  const inner = (items as { item?: unknown })?.item;
  if (Array.isArray(inner)) return inner as Record<string, unknown>[];
  if (inner && typeof inner === 'object') return [inner as Record<string, unknown>];
  return [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const FOOD_SAFETY_API_KEY = Deno.env.get('FOOD_SAFETY_API_KEY');
  if (!FOOD_SAFETY_API_KEY) {
    return json({ error: 'Missing FOOD_SAFETY_API_KEY secret' }, 500);
  }

  let payload: { query?: string; page?: number };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const query = (payload.query ?? '').trim();
  if (!query) return json({ results: [] });
  const page = Math.max(1, Math.floor(payload.page ?? 1));

  const url =
    `https://apis.data.go.kr/1471000/FoodNtrIrdntInfoService1/getFoodNtrItdntList1` +
    `?serviceKey=${encodeURIComponent(FOOD_SAFETY_API_KEY)}` +
    `&desc_kor_nm=${encodeURIComponent(query)}` +
    `&type=json&numOfRows=20&pageNo=${page}`;

  let raw: unknown;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const detail = await res.text();
      return json({ error: 'food-safety API error', status: res.status, detail }, 502);
    }
    // 키 오류 등은 200으로 XML을 돌려주기도 하므로 content-type을 확인
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('json')) {
      const detail = await res.text();
      return json({ error: 'food-safety API returned non-JSON (키/파라미터 확인)', detail }, 502);
    }
    raw = await res.json();
  } catch (e) {
    return json({ error: 'food-safety fetch failed', detail: String(e) }, 502);
  }

  const results = extractItems(raw)
    .map(normalize)
    .filter((r): r is FoodSearchResult => r !== null);

  return json({ results });
});
