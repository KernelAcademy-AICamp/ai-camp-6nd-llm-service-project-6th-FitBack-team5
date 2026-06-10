import { useQuery } from '@tanstack/react-query';

// 기상청 단기예보(초단기실황) 서비스 키 (공공데이터포털 data.go.kr 발급, 무료).
// 없으면 날씨 표시를 건너뛴다. ⚠️ 웹은 CORS로 막힐 수 있음(네이티브는 정상).
const KEY = process.env.EXPO_PUBLIC_KMA_SERVICE_KEY;

export interface Weather {
  temp: number;
  desc: string;
}

/** 위경도 → 기상청 격자(nx, ny). 기상청 제공 Lambert 변환 공식. */
function toGrid(lat: number, lon: number): { nx: number; ny: number } {
  const RE = 6371.00877;
  const GRID = 5.0;
  const SLAT1 = 30.0;
  const SLAT2 = 60.0;
  const OLON = 126.0;
  const OLAT = 38.0;
  const XO = 43;
  const YO = 136;
  const DEGRAD = Math.PI / 180;

  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

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

  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  };
}

/** 초단기실황 base_date/base_time. 매시 정시 발표·40분 후 제공 → 여유로 -40분. */
function baseDateTime(): { baseDate: string; baseTime: string } {
  const d = new Date(Date.now() - 40 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    baseDate: `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`,
    baseTime: `${p(d.getHours())}00`,
  };
}

// 강수형태(PTY) 코드 → 설명. 초단기실황엔 하늘상태(SKY)가 없어 PTY=0은 '맑음'으로 근사.
const PTY_DESC: Record<string, string> = {
  '0': '맑음',
  '1': '비',
  '2': '비/눈',
  '3': '눈',
  '5': '빗방울',
  '6': '진눈깨비',
  '7': '눈날림',
};

interface KmaItem {
  category: string;
  obsrValue: string;
}

/** 센터 좌표 기준 현재 날씨(기상청 초단기실황). 키·좌표 없으면 비활성. */
export function useWeather(lat: number | null | undefined, lon: number | null | undefined) {
  return useQuery<Weather>({
    queryKey: ['weather-kma', lat, lon],
    enabled: !!KEY && lat != null && lon != null,
    staleTime: 10 * 60_000,
    retry: 0,
    queryFn: async () => {
      const { nx, ny } = toGrid(lat as number, lon as number);
      const { baseDate, baseTime } = baseDateTime();
      const url =
        'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst' +
        `?serviceKey=${KEY}&dataType=JSON&numOfRows=100&pageNo=1` +
        `&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error('날씨 조회 실패');
      const j = await r.json();
      if (j?.response?.header?.resultCode !== '00') {
        throw new Error(j?.response?.header?.resultMsg ?? '날씨 조회 실패');
      }
      const items: KmaItem[] = j.response.body.items.item;
      const t1h = items.find((i) => i.category === 'T1H')?.obsrValue;
      const pty = items.find((i) => i.category === 'PTY')?.obsrValue ?? '0';
      return {
        temp: t1h != null ? Math.round(Number(t1h)) : 0,
        desc: PTY_DESC[pty] ?? '',
      };
    },
  });
}
