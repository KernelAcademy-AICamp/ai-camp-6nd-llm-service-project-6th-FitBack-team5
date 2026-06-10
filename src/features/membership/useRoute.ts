import { useQuery } from '@tanstack/react-query';

// 카카오모빌리티 길찾기 REST 키 (선택). 없으면 경로 표시를 건너뛴다.
const KEY = process.env.EXPO_PUBLIC_KAKAO_REST_KEY;

export interface RouteInfo {
  distanceKm: number;
  durationMin: number;
}

/** 출발지→센터 자동차 경로(거리·소요시간). 키·좌표 없으면 비활성. */
export function useRoute(
  oLat: number | null | undefined,
  oLng: number | null | undefined,
  dLat: number | null | undefined,
  dLng: number | null | undefined,
) {
  return useQuery<RouteInfo>({
    queryKey: ['route', oLat, oLng, dLat, dLng],
    enabled: !!KEY && oLat != null && oLng != null && dLat != null && dLng != null,
    retry: 0,
    queryFn: async () => {
      const url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${oLng},${oLat}&destination=${dLng},${dLat}`;
      const r = await fetch(url, { headers: { Authorization: `KakaoAK ${KEY}` } });
      if (!r.ok) throw new Error('경로 조회 실패');
      const j = await r.json();
      const s = j?.routes?.[0]?.summary;
      if (!s) throw new Error('경로 없음');
      return { distanceKm: s.distance / 1000, durationMin: Math.round(s.duration / 60) };
    },
  });
}
