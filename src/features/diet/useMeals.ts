import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';

export type MealType = '아침' | '점심' | '저녁' | '간식';
export const MEAL_TYPES: MealType[] = ['아침', '점심', '저녁', '간식'];
export type InputMethod = 'image' | 'voice' | 'manual';

// DB row (snake_case) — public.meals
interface MealRow {
  id: string;
  user_id: string;
  log_date: string;
  meal_type: MealType;
  name: string;
  kcal: number;
  carb: number;
  protein: number;
  fat: number;
  eaten_at: string;
  input_method: InputMethod;
  created_at: string;
}

// UI 모델 (diet.tsx가 사용) — DB row에서 표시용으로 변환
export interface Meal {
  id: string;
  mealType: MealType;
  name: string;
  kcal: number;
  carb: number;
  protein: number;
  fat: number;
  time: string; // 'HH:MM' (eaten_at을 로컬 시각으로 포맷)
  inputMethod: InputMethod;
}

// 저장 입력 (id·time·user는 서버/훅이 채움)
export interface NewMeal {
  mealType: MealType;
  name: string;
  kcal: number;
  carb: number;
  protein: number;
  fat: number;
  inputMethod: InputMethod;
  eatenAt?: Date;
}

// 로컬 기준 오늘 (YYYY-MM-DD)
function todayISO(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = `${d.getHours()}`.padStart(2, '0');
  const min = `${d.getMinutes()}`.padStart(2, '0');
  return `${h}:${min}`;
}

function fromRow(r: MealRow): Meal {
  return {
    id: r.id,
    mealType: r.meal_type,
    name: r.name,
    kcal: r.kcal,
    carb: r.carb,
    protein: r.protein,
    fat: r.fat,
    time: formatTime(r.eaten_at),
    inputMethod: r.input_method,
  };
}

const mealsKey = (userId: string | undefined, date: string) => ['meals', userId, date];

// 특정 날짜(기본: 오늘)의 식단 기록 조회
export function useMeals(date: string = todayISO()) {
  const user = useCurrentUser();
  return useQuery<Meal[]>({
    queryKey: mealsKey(user?.id, date),
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('meals')
        .select('*')
        .eq('user_id', user.id)
        .eq('log_date', date)
        .order('eaten_at', { ascending: true });
      if (error) throw error;
      return (data as MealRow[]).map(fromRow);
    },
  });
}

// 식단 기록 추가 — 저장 후 해당 날짜 쿼리 무효화
export function useAddMeal(date: string = todayISO()) {
  const user = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (meal: NewMeal): Promise<Meal> => {
      if (!user) throw new Error('로그인이 필요합니다.');
      const { data, error } = await supabase
        .from('meals')
        .insert({
          user_id: user.id,
          log_date: date,
          meal_type: meal.mealType,
          name: meal.name,
          kcal: meal.kcal,
          carb: meal.carb,
          protein: meal.protein,
          fat: meal.fat,
          input_method: meal.inputMethod,
          ...(meal.eatenAt ? { eaten_at: meal.eatenAt.toISOString() } : {}),
        })
        .select('*')
        .single();
      if (error) throw error;
      return fromRow(data as MealRow);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mealsKey(user?.id, date) });
    },
  });
}

// 기록 수정 입력 (id로 특정 row 갱신)
export interface MealEdit {
  id: string;
  mealType: MealType;
  name: string;
  kcal: number;
  carb: number;
  protein: number;
  fat: number;
}

// 식단 기록 수정 — 값/끼니 갱신 후 해당 날짜 쿼리 무효화
export function useUpdateMeal(date: string = todayISO()) {
  const user = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (meal: MealEdit): Promise<Meal> => {
      if (!user) throw new Error('로그인이 필요합니다.');
      const { data, error } = await supabase
        .from('meals')
        .update({
          meal_type: meal.mealType,
          name: meal.name,
          kcal: meal.kcal,
          carb: meal.carb,
          protein: meal.protein,
          fat: meal.fat,
        })
        .eq('id', meal.id)
        .eq('user_id', user.id)
        .select('*')
        .single();
      if (error) throw error;
      return fromRow(data as MealRow);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mealsKey(user?.id, date) });
    },
  });
}

// 식단 기록 삭제 — 삭제 후 해당 날짜 쿼리 무효화
export function useDeleteMeal(date: string = todayISO()) {
  const user = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      if (!user) throw new Error('로그인이 필요합니다.');
      const { error } = await supabase.from('meals').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mealsKey(user?.id, date) });
    },
  });
}
