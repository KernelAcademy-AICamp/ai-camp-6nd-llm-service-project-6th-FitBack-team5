import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Meal } from '@/features/diet/useMeals';

type MacroTotals = { kcal: number; carb: number; protein: number; fat: number };

async function fetchDailyFeedback(
  totals: MacroTotals,
  target: MacroTotals,
  meals: Meal[],
  burnedKcal: number,
  context: string | undefined,
): Promise<string> {
  const mealPayload = meals.map((m) => ({
    mealType: m.mealType,
    name: m.name,
    kcal: m.kcal,
    carb: m.carb,
    protein: m.protein,
    fat: m.fat,
  }));

  const { data, error } = await supabase.functions.invoke<{ feedback?: string; error?: string }>('food-search', {
    body: { action: 'daily-feedback', totals, target, meals: mealPayload, burnedKcal, context },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.feedback ?? '';
}

function round10(n: number) { return Math.round(n / 10) * 10; }
function round5(n: number) { return Math.round(n / 5) * 5; }

export function useDailyFeedback(
  totals: MacroTotals,
  target: MacroTotals,
  meals: Meal[],
  burnedKcal: number,
  context?: string,
  date?: string,
) {
  const roundedKey = `${round10(totals.kcal)},${round5(totals.protein)},${round5(totals.carb)},${round5(totals.fat)}`;
  return useQuery({
    queryKey: ['daily-feedback', roundedKey, date ?? '', context ?? ''],
    queryFn: () => fetchDailyFeedback(totals, target, meals, burnedKcal, context),
    enabled: meals.length > 0,
    staleTime: 1000 * 60 * 60 * 6,
    retry: 1,
  });
}
