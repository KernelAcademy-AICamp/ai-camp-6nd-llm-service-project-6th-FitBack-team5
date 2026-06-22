import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

import type { BodyPart, CatalogItem, ExerciseType } from './types';

const BUCKET = 'workout-custom-exercise';

export function useCatalog(bodyPart: BodyPart, exerciseType: ExerciseType) {
  return useQuery({
    queryKey: ['workout-custom-catalog', bodyPart, exerciseType],
    queryFn: async (): Promise<CatalogItem[]> => {
      const { data, error } = await supabase
        .from('workout_custom_catalog')
        .select('id, name, body_part, exercise_type, unit, default_sets, default_reps, image_path, sort_order')
        .eq('body_part', bodyPart)
        .eq('exercise_type', exerciseType)
        .order('sort_order', { ascending: true });
      if (error) throw error;

      // image_path → public URL 변환. Storage 파일 미업로드 상태면 URL 만 만들어 두고,
      // <Image> 로딩 실패 시 컴포넌트에서 placeholder fallback.
      return (data ?? []).map((row): CatalogItem => {
        const image_url = row.image_path
          ? supabase.storage.from(BUCKET).getPublicUrl(row.image_path).data.publicUrl
          : null;
        return { ...row, image_url } as CatalogItem;
      });
    },
    staleTime: 5 * 60_000,
  });
}
