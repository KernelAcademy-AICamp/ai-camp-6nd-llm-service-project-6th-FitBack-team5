import { useMutation } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

import type { MealType } from './useMeals';

// 트레이너 피드백 요청 입력 — 방금 분석/기록한 끼니 + 운동 맥락
export interface FeedbackInput {
  name: string;
  kcal: number;
  carb: number;
  protein: number;
  fat: number;
  mealType: MealType;
  context?: string; // 오늘 운동 맥락 (예: '하체 운동 회복')
}

interface FeedbackResponse {
  feedback?: string;
  error?: string;
}

async function fetchFeedback(input: FeedbackInput): Promise<string> {
  const { context, ...meal } = input;
  // 통합 함수 'food-search'의 feedback 액션 — Claude가 트레이너 톤 코멘트 생성
  const { data, error } = await supabase.functions.invoke<FeedbackResponse>('food-search', {
    body: { action: 'feedback', meal, context },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return (data?.feedback ?? '').trim();
}

/** 방금 분석한 끼니 → 트레이너 피드백. 리뷰 화면에서 호출. */
export function useMealFeedback() {
  return useMutation({ mutationFn: fetchFeedback });
}
