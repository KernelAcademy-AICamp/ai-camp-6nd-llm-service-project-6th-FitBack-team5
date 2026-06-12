import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';
import type { FoodSearchResult } from './foodSearch';

interface FavoriteRow {
  id: string;
  user_id: string;
  name: string;
  kcal: number;
  carb: number;
  protein: number;
  fat: number;
  serving_size: string | null;
  created_at: string;
}

export interface FoodFavorite {
  id: string;
  name: string;
  kcal: number;
  carb: number;
  protein: number;
  fat: number;
  servingSize?: string;
}

function fromRow(r: FavoriteRow): FoodFavorite {
  return {
    id: r.id,
    name: r.name,
    kcal: r.kcal,
    carb: r.carb,
    protein: r.protein,
    fat: r.fat,
    ...(r.serving_size ? { servingSize: r.serving_size } : {}),
  };
}

const favoritesKey = (userId: string | undefined) => ['food_favorites', userId];

export function useFoodFavorites() {
  const user = useCurrentUser();
  return useQuery<FoodFavorite[]>({
    queryKey: favoritesKey(user?.id),
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('food_favorites')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as FavoriteRow[]).map(fromRow);
    },
  });
}

// food가 즐겨찾기에 있으면 삭제, 없으면 추가
export function useToggleFavorite() {
  const user = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      food,
      favorites,
    }: {
      food: FoodSearchResult;
      favorites: FoodFavorite[];
    }): Promise<'added' | 'removed'> => {
      if (!user) throw new Error('로그인이 필요합니다.');
      const existing = favorites.find((f) => f.name === food.name);
      if (existing) {
        const { error } = await supabase
          .from('food_favorites')
          .delete()
          .eq('id', existing.id)
          .eq('user_id', user.id);
        if (error) throw error;
        return 'removed';
      } else {
        const { error } = await supabase.from('food_favorites').insert({
          user_id: user.id,
          name: food.name,
          kcal: food.kcal,
          carb: food.carb,
          protein: food.protein,
          fat: food.fat,
          ...(food.servingSize ? { serving_size: food.servingSize } : {}),
        });
        if (error) throw error;
        return 'added';
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: favoritesKey(user?.id) });
    },
  });
}
