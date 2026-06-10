import { useQuery } from '@tanstack/react-query';

// OpenWeather 무료 키 (선택). 없으면 날씨 표시를 건너뛴다.
const KEY = process.env.EXPO_PUBLIC_OPENWEATHER_KEY;

export interface Weather {
  temp: number;
  desc: string;
}

/** 센터 좌표 기준 현재 날씨. 키가 없거나 좌표가 없으면 비활성(undefined). */
export function useWeather(lat: number | null | undefined, lon: number | null | undefined) {
  return useQuery<Weather>({
    queryKey: ['weather', lat, lon],
    enabled: !!KEY && lat != null && lon != null,
    staleTime: 10 * 60_000,
    retry: 0,
    queryFn: async () => {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${KEY}&units=metric&lang=kr`;
      const r = await fetch(url);
      if (!r.ok) throw new Error('날씨 조회 실패');
      const j = await r.json();
      return {
        temp: Math.round(j?.main?.temp ?? 0),
        desc: j?.weather?.[0]?.description ?? '',
      };
    },
  });
}
