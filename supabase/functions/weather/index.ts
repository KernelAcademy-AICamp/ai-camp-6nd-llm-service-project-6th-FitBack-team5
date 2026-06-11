// Supabase Edge Function: 기상청 초단기실황 프록시 (웹 CORS 우회)
// 배포: supabase functions deploy weather
// 시크릿: supabase secrets set KMA_SERVICE_KEY=<공공데이터포털 Encoding 키>
// 호출: GET {SUPABASE_URL}/functions/v1/weather?lat=..&lon=..  (Authorization: Bearer ANON)
//
// deno 런타임 — 앱(tsc) 빌드 대상이 아니라 tsconfig에서 제외됨.
declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (req: Request) => Response | Promise<Response>): void };

const KMA = Deno.env.get('KMA_SERVICE_KEY') ?? '';

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function toGrid(lat: number, lon: number): { nx: number; ny: number } {
  const RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0, OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136;
  const DEGRAD = Math.PI / 180;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD, slat2 = SLAT2 * DEGRAD, olon = OLON * DEGRAD, olat = OLAT * DEGRAD;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;
  return { nx: Math.floor(ra * Math.sin(theta) + XO + 0.5), ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5) };
}

function baseDateTime(): { baseDate: string; baseTime: string } {
  // 기상청 API는 KST 기준. Edge Function은 UTC로 돌기 때문에 +9h 보정해 KST 벽시계로 만든다.
  // 초단기실황은 매시 ~40분 이후 제공되므로 40분 여유를 빼 직전 정시를 고른다.
  const kst = new Date(Date.now() + (9 * 60 - 40) * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    baseDate: `${kst.getUTCFullYear()}${p(kst.getUTCMonth() + 1)}${p(kst.getUTCDate())}`,
    baseTime: `${p(kst.getUTCHours())}00`,
  };
}

const PTY: Record<string, string> = {
  '0': '맑음', '1': '비', '2': '비/눈', '3': '눈', '5': '빗방울', '6': '진눈깨비', '7': '눈날림',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const u = new URL(req.url);
    const lat = Number(u.searchParams.get('lat'));
    const lon = Number(u.searchParams.get('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return json({ error: 'lat/lon required' }, 400);

    const { nx, ny } = toGrid(lat, lon);
    const { baseDate, baseTime } = baseDateTime();
    const url =
      'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst' +
      `?serviceKey=${KMA}&dataType=JSON&numOfRows=100&pageNo=1` +
      `&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}`;
    const r = await fetch(url);
    const j = await r.json();
    if (j?.response?.header?.resultCode !== '00') {
      return json({ error: j?.response?.header?.resultMsg ?? 'KMA error' }, 502);
    }
    const items: { category: string; obsrValue: string }[] = j.response.body.items.item;
    const t1h = items.find((i) => i.category === 'T1H')?.obsrValue;
    const pty = items.find((i) => i.category === 'PTY')?.obsrValue ?? '0';
    return json({ temp: t1h != null ? Math.round(Number(t1h)) : 0, desc: PTY[pty] ?? '' });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
