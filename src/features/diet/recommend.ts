import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export interface RecFood {
  name: string;
  amount: number;
  unit: string;
}

export interface RecDeficit {
  label: string;
  g: number;
}

interface RecommendResponse {
  foods?: RecFood[];
  error?: string;
}

async function fetchRecommend(deficits: RecDeficit[], context?: string): Promise<RecFood[]> {
  const { data, error } = await supabase.functions.invoke<RecommendResponse>('food-search', {
    body: { action: 'recommend', deficits, context },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.foods ?? [];
}

/**
 * 부족 영양소 기반 개별 음식 추천 (Claude). 부족 수치로 캐싱해 끼니가 바뀔 때만 재요청.
 * deficits가 비면 호출하지 않는다.
 */
export function useRecommend(deficits: RecDeficit[], context?: string) {
  // 캐시 키: 라벨+5g 단위로 반올림(작은 변화로 재요청 안 하도록)
  const sig = deficits.map((d) => `${d.label}:${Math.round(d.g / 5) * 5}`).join(',');
  return useQuery({
    queryKey: ['recommend', sig, context ?? ''],
    queryFn: () => fetchRecommend(deficits, context),
    enabled: deficits.length > 0,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
}
