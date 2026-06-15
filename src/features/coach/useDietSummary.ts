import { useMeals } from '@/features/diet/useMeals';

export interface DietSummary {
  date: string;
  mealCount: number;
  totalKcal: number;
  carb_g: number;
  protein_g: number;
  fat_g: number;
  carbPct: number; // 칼로리 기여 비율(합 100)
  proteinPct: number;
  fatPct: number;
  tags: string[];
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 간단 규칙 기반 태그(분석 룰 자리). dietScore는 계산식 미정이라 제외(실데이터만). */
function buildTags(proteinPct: number, fatPct: number, carbPct: number): string[] {
  const tags: string[] = [];
  if (proteinPct >= 25) tags.push('단백질 충분');
  else tags.push('단백질 부족');
  if (fatPct >= 35) tags.push('고지방 주의');
  if (carbPct >= 60) tags.push('탄수화물 풍부');
  return tags;
}

/** 오늘 식단 요약(실데이터). 기록 없으면 null. MY 코치 요약 카드/컨텍스트용. */
export function useDietSummary(date: string = todayISO()) {
  const { data: meals, isLoading } = useMeals(date);

  let summary: DietSummary | null = null;
  if (meals && meals.length > 0) {
    const carb_g = meals.reduce((s, m) => s + (m.carb ?? 0), 0);
    const protein_g = meals.reduce((s, m) => s + (m.protein ?? 0), 0);
    const fat_g = meals.reduce((s, m) => s + (m.fat ?? 0), 0);
    const totalKcal = meals.reduce((s, m) => s + (m.kcal ?? 0), 0);

    const cCal = carb_g * 4;
    const pCal = protein_g * 4;
    const fCal = fat_g * 9;
    const macroCal = cCal + pCal + fCal;
    const carbPct = macroCal > 0 ? Math.round((cCal / macroCal) * 100) : 0;
    const proteinPct = macroCal > 0 ? Math.round((pCal / macroCal) * 100) : 0;
    const fatPct = macroCal > 0 ? Math.max(0, 100 - carbPct - proteinPct) : 0;

    summary = {
      date,
      mealCount: meals.length,
      totalKcal: Math.round(totalKcal),
      carb_g: Math.round(carb_g),
      protein_g: Math.round(protein_g),
      fat_g: Math.round(fat_g),
      carbPct,
      proteinPct,
      fatPct,
      tags: buildTags(proteinPct, fatPct, carbPct),
    };
  }

  return { summary, isLoading };
}
