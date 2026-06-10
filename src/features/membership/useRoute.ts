import { useQuery } from '@tanstack/react-query';

// 경로는 Supabase Edge Function(route) 프록시를 통해 받는다 (웹 CORS 우회).
// 카카오 키는 클라이언트가 아니라 Edge Function 시크릿(KAKAO_REST_KEY)에 있다.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export interface RouteInfo {
  distanceKm: number;
  durationMin: number;
}

/** 출발지→센터 자동차 경로. Edge Function 미배포/좌표 없음이면 조용히 생략. */
export function useRoute(
  oLat: number | null | undefined,
  oLng: number | null | undefined,
  dLat: number | null | undefined,
  dLng: number | null | undefined,
) {
  return useQuery<RouteInfo>({
    queryKey: ['route', oLat, oLng, dLat, dLng],
    enabled: !!SUPABASE_URL && !!ANON && oLat != null && oLng != null && dLat != null && dLng != null,
    retry: 0,
    queryFn: async () => {
      const r = await fetch(
        `${SUPABASE_URL}/functions/v1/route?oLat=${oLat}&oLng=${oLng}&dLat=${dLat}&dLng=${dLng}`,
        { headers: { Authorization: `Bearer ${ANON}`, apikey: ANON as string } },
      );
      if (!r.ok) throw new Error('경로 조회 실패');
      return (await r.json()) as RouteInfo;
    },
  });
}
