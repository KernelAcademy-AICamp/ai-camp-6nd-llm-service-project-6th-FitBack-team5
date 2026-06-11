// Supabase Edge Function: 카카오모빌리티 길찾기 프록시 (웹 CORS 우회)
// 배포: supabase functions deploy route
// 시크릿: supabase secrets set KAKAO_REST_KEY=<카카오 REST 키>
// 호출: GET {SUPABASE_URL}/functions/v1/route?oLat=&oLng=&dLat=&dLng=
declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (req: Request) => Response | Promise<Response>): void };

const KAKAO = Deno.env.get('KAKAO_REST_KEY') ?? '';

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const u = new URL(req.url);
    const oLat = Number(u.searchParams.get('oLat'));
    const oLng = Number(u.searchParams.get('oLng'));
    const dLat = Number(u.searchParams.get('dLat'));
    const dLng = Number(u.searchParams.get('dLng'));
    if ([oLat, oLng, dLat, dLng].some((v) => !Number.isFinite(v))) {
      return json({ error: 'oLat/oLng/dLat/dLng required' }, 400);
    }
    const url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${oLng},${oLat}&destination=${dLng},${dLat}`;
    const r = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO}` } });
    if (!r.ok) return json({ error: 'kakao error' }, 502);
    const j = await r.json();
    const s = j?.routes?.[0]?.summary;
    if (!s) return json({ error: 'no route' }, 502);
    return json({ distanceKm: s.distance / 1000, durationMin: Math.round(s.duration / 60) });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
