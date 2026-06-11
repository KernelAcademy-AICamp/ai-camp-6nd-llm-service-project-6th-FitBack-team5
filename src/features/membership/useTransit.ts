import { useQuery } from '@tanstack/react-query';

// 도보 추정 + 대중교통(ODsay)을 Supabase Edge Function(transit) 프록시로 받는다.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export interface TransitInfo {
  walk: { minutes: number; km: number };
  transit: {
    minutes: number;
    type: string; // 지하철 / 버스 / 지하철+버스
    transfers: number;
    payment: number;
    walkMeters: number;
  } | null;
  transitError: string | null;
}

/** 출발지→센터 도보·대중교통 소요시간. 좌표/설정 없으면 조용히 생략. */
export function useTransit(
  sLat: number | null | undefined,
  sLng: number | null | undefined,
  eLat: number | null | undefined,
  eLng: number | null | undefined,
) {
  return useQuery<TransitInfo>({
    queryKey: ['transit', sLat, sLng, eLat, eLng],
    enabled: !!SUPABASE_URL && !!ANON && sLat != null && sLng != null && eLat != null && eLng != null,
    retry: 0,
    queryFn: async () => {
      const r = await fetch(
        `${SUPABASE_URL}/functions/v1/transit?sLat=${sLat}&sLng=${sLng}&eLat=${eLat}&eLng=${eLng}`,
        { headers: { Authorization: `Bearer ${ANON}`, apikey: ANON as string } },
      );
      if (!r.ok) throw new Error('대중교통 조회 실패');
      return (await r.json()) as TransitInfo;
    },
  });
}
