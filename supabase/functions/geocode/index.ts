// Supabase Edge Function: 카카오 Local 키워드 검색 프록시 (웹 CORS 우회)
// 배포: supabase functions deploy geocode
// 시크릿: supabase secrets set KAKAO_REST_KEY=<카카오 REST 키>
// 호출: GET {SUPABASE_URL}/functions/v1/geocode?query=강남 피트니스
declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (req: Request) => Response | Promise<Response>): void };

const KAKAO = Deno.env.get('KAKAO_REST_KEY') ?? '';

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

interface KakaoDoc {
  place_name?: string;
  address_name?: string;
  road_address_name?: string;
  category_name?: string;
  x: string; // 경도(lng)
  y: string; // 위도(lat)
}

// 운동 센터로 분류할 카테고리/이름 키워드 (sport=1 일 때 필터).
const SPORT_KEYWORDS = [
  '헬스', '피트니스', '스포츠', '체육', '요가', '필라테스', '크로스핏', '짐',
  'PT', '운동', '클라이밍', '복싱', '수영', '골프', '테니스', '댄스', '무용', '발레', '주짓수', '검도', '태권도',
];
function isSport(d: KakaoDoc): boolean {
  const hay = `${d.category_name ?? ''} ${d.place_name ?? ''}`;
  return SPORT_KEYWORDS.some((k) => hay.includes(k));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const u = new URL(req.url);
    const query = (u.searchParams.get('query') ?? '').trim();
    if (!query) return json({ error: 'query required' }, 400);
    const sport = u.searchParams.get('sport') === '1'; // 운동 센터만 필터

    // 카카오 키워드 검색 한 번. 실패 시 null.
    async function kakao(q: string): Promise<KakaoDoc[] | null> {
      const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(q)}&size=15`;
      const r = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO}` } });
      if (!r.ok) return null;
      const j = await r.json();
      return (j?.documents ?? []) as KakaoDoc[];
    }

    let docs: KakaoDoc[] = [];
    if (sport) {
      // "강남"처럼 운동 키워드가 없으면 헬스/피트니스/PT/필라테스/요가/크로스핏을 덧붙여
      // 여러 번 검색 후 병합 → 운동 시설만 필터. 이미 운동 키워드가 있으면 단일 검색.
      const hasKw = SPORT_KEYWORDS.some((k) => query.includes(k));
      const queries = hasKw
        ? [query]
        : ['헬스', '피트니스', 'PT', '필라테스', '요가', '크로스핏'].map((s) => `${query} ${s}`);
      const lists = await Promise.all(queries.map(kakao));
      if (lists.every((l) => l === null)) return json({ error: 'kakao error' }, 502);
      const seen = new Set<string>();
      for (const list of lists) {
        for (const d of list ?? []) {
          const key = `${d.x},${d.y},${d.place_name ?? ''}`;
          if (seen.has(key)) continue;
          seen.add(key);
          if (isSport(d)) docs.push(d);
        }
      }
    } else {
      const list = await kakao(query);
      if (list === null) return json({ error: 'kakao error' }, 502);
      docs = list;
    }

    const results = docs
      .slice(0, 12)
      .map((d) => ({
        name: d.place_name || d.road_address_name || d.address_name || '',
        address: d.road_address_name || d.address_name || '',
        lat: Number(d.y),
        lng: Number(d.x),
      }))
      .filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lng));
    return json({ results });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
