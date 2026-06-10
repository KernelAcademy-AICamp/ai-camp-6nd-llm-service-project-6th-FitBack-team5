import { useQuery } from '@tanstack/react-query';

// 날씨는 Supabase Edge Function(weather) 프록시를 통해 받는다 (웹 CORS 우회).
// 기상청 키는 클라이언트가 아니라 Edge Function 시크릿(KMA_SERVICE_KEY)에 있다.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export interface Weather {
  temp: number;
  desc: string;
}

/** 센터 좌표 기준 현재 날씨. Edge Function 미배포/좌표 없음이면 조용히 생략. */
export function useWeather(lat: number | null | undefined, lon: number | null | undefined) {
  return useQuery<Weather>({
    queryKey: ['weather', lat, lon],
    enabled: !!SUPABASE_URL && !!ANON && lat != null && lon != null,
    staleTime: 10 * 60_000,
    retry: 0,
    queryFn: async () => {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/weather?lat=${lat}&lon=${lon}`, {
        headers: { Authorization: `Bearer ${ANON}`, apikey: ANON as string },
      });
      if (!r.ok) throw new Error('날씨 조회 실패');
      return (await r.json()) as Weather;
    },
  });
}
