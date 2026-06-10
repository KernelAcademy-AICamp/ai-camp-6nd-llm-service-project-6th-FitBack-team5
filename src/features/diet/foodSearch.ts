import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

// food-search Edge Function이 돌려주는 정규화된 검색 결과 1건
export interface FoodSearchResult {
  name: string;
  kcal: number;
  carb: number;
  protein: number;
  fat: number;
  servingSize: string | null;
}

interface FoodSearchResponse {
  results?: FoodSearchResult[];
  error?: string;
}

async function searchFoods(query: string): Promise<FoodSearchResult[]> {
  const { data, error } = await supabase.functions.invoke<FoodSearchResponse>('food', {
    body: { action: 'search', query },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.results ?? [];
}

/**
 * 음식명으로 식약처 DB 검색. query가 2자 미만이면 호출하지 않는다(과도한 요청 방지).
 * 디바운스된 query를 넘기는 것을 권장.
 */
export function useFoodSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ['food-search', q],
    queryFn: () => searchFoods(q),
    enabled: q.length >= 2,
    staleTime: 5 * 60 * 1000, // 같은 검색어 5분 캐시
    retry: 1,
  });
}
