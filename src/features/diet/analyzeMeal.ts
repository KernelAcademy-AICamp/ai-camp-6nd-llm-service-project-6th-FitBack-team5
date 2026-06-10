import { useMutation } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

// analyze-meal Edge Function이 돌려주는 추정 결과
export interface AnalyzedMeal {
  name: string;
  kcal: number;
  carb: number;
  protein: number;
  fat: number;
}

interface AnalyzeResponse extends Partial<AnalyzedMeal> {
  error?: string;
}

// grams: 선택. 사용자가 총 섭취량(g)을 알려주면 분석 정확도가 올라간다.
export interface AnalyzeInput {
  text: string;
  grams?: number;
}

async function analyzeMealText({ text, grams }: AnalyzeInput): Promise<AnalyzedMeal> {
  // 통합 함수가 'food-search' 이름으로 배포돼 있어 같은 함수의 analyze 액션을 호출한다.
  const { data, error } = await supabase.functions.invoke<AnalyzeResponse>('food-search', {
    body: { action: 'analyze', text, grams },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  if (!data || typeof data.kcal !== 'number') throw new Error('분석 결과를 받지 못했어요');
  return {
    name: data.name ?? text,
    kcal: data.kcal,
    carb: data.carb ?? 0,
    protein: data.protein ?? 0,
    fat: data.fat ?? 0,
  };
}

/** 자연어 식단 설명(+선택 총 섭취량) → Claude 영양 추정. 텍스트 탭에서 사용. */
export function useAnalyzeMeal() {
  return useMutation({ mutationFn: analyzeMealText });
}
