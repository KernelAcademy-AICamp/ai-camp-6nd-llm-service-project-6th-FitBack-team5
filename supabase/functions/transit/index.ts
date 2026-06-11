// Supabase Edge Function: ODsay 대중교통 길찾기 + 도보 추정 프록시 (웹 CORS 우회)
// 배포: supabase functions deploy transit
// 시크릿: supabase secrets set ODSAY_API_KEY=<ODsay 인증키>  (선택) ODSAY_REFERER=<등록 도메인>
// 호출: GET {SUPABASE_URL}/functions/v1/transit?sLat=&sLng=&eLat=&eLng=
//
// ODsay는 Server(IP) 대신 URI(Referer) 검증을 쓰므로, 서버 호출 시 등록 도메인을
// Referer 헤더로 실어 보낸다.
declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (req: Request) => Response | Promise<Response>): void };

const ODSAY = Deno.env.get('ODSAY_API_KEY') ?? '';
const REFERER = Deno.env.get('ODSAY_REFERER') ?? 'http://localhost:8081';

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

/** 두 좌표 간 거리(km). Haversine. */
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ODsay pathType: 1=지하철, 2=버스, 3=버스+지하철
const PATH_TYPE: Record<number, string> = { 1: '지하철', 2: '버스', 3: '지하철+버스' };

interface OdsayPath {
  pathType: number;
  info: {
    totalTime: number; // 분
    payment: number; // 원
    busTransitCount: number;
    subwayTransitCount: number;
    totalWalk: number; // m
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const u = new URL(req.url);
    const sLat = Number(u.searchParams.get('sLat'));
    const sLng = Number(u.searchParams.get('sLng'));
    const eLat = Number(u.searchParams.get('eLat'));
    const eLng = Number(u.searchParams.get('eLng'));
    if ([sLat, sLng, eLat, eLng].some((v) => !Number.isFinite(v))) {
      return json({ error: 'sLat/sLng/eLat/eLng required' }, 400);
    }

    // 도보: 직선거리에 도로 보정(1.3) 적용, 보행 4.5km/h 가정.
    const straight = distanceKm(sLat, sLng, eLat, eLng);
    const walkKm = straight * 1.3;
    const walkMin = Math.round((walkKm / 4.5) * 60);
    const walk = { minutes: walkMin, km: Math.round(walkKm * 10) / 10 };

    // 대중교통: ODsay. SX=출발 경도, SY=출발 위도, EX/EY=도착.
    let transit: {
      minutes: number;
      type: string;
      transfers: number;
      payment: number;
      walkMeters: number;
    } | null = null;
    let transitError: string | null = null;
    try {
      const url =
        'https://api.odsay.com/v1/api/searchPubTransPathT' +
        `?SX=${sLng}&SY=${sLat}&EX=${eLng}&EY=${eLat}&apiKey=${encodeURIComponent(ODSAY)}`;
      const r = await fetch(url, { headers: { Referer: REFERER } });
      const j = await r.json();
      if (j?.error) {
        transitError = j.error?.msg ?? 'odsay error';
      } else {
        const paths: OdsayPath[] = j?.result?.path ?? [];
        if (paths.length > 0) {
          // 최단 시간 경로 선택.
          const best = paths.reduce((a, b) => (a.info.totalTime <= b.info.totalTime ? a : b));
          transit = {
            minutes: best.info.totalTime,
            type: PATH_TYPE[best.pathType] ?? '대중교통',
            transfers: (best.info.busTransitCount ?? 0) + (best.info.subwayTransitCount ?? 0) - 1,
            payment: best.info.payment ?? 0,
            walkMeters: best.info.totalWalk ?? 0,
          };
        }
      }
    } catch (e) {
      transitError = String(e);
    }

    return json({ walk, transit, transitError });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
