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
  x: string; // 경도(lng)
  y: string; // 위도(lat)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const u = new URL(req.url);
    const query = (u.searchParams.get('query') ?? '').trim();
    if (!query) return json({ error: 'query required' }, 400);

    // 키워드 검색: 장소명·주소 모두 커버, 후보 다수 반환.
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=10`;
    const r = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO}` } });
    if (!r.ok) return json({ error: 'kakao error', status: r.status }, 502);
    const j = await r.json();
    const docs: KakaoDoc[] = j?.documents ?? [];
    const results = docs
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
