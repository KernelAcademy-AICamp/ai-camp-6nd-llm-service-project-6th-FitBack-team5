export type BodyPart = '하체' | '상체' | '코어' | '전신';
export type ExerciseType = '근력' | '유산소' | '스트레칭';
export type Unit = '회' | '초';

export interface CatalogItem {
  id: string;
  name: string;
  body_part: BodyPart;
  exercise_type: ExerciseType;
  unit: Unit;
  default_sets: number;
  default_reps: number;
  /** Storage 내부 경로 (예: 'lower/squat.png'). useCatalog 가 publicUrl 로 변환해 image_url 에 넣는다. */
  image_path: string | null;
  image_url: string | null;
  sort_order: number;
}

export interface DraftItem {
  catalog_id: string;
  name: string;
  body_part: BodyPart;
  exercise_type: ExerciseType;
  unit: Unit;
  duration_min: number;
  sets: number;
  reps: number;
  done: boolean;
  /** Storage 내부 경로 — 렌더 시 supabase.storage.getPublicUrl 로 변환. null 이면 placeholder. */
  image_path: string | null;
}

export interface SessionRow {
  id: string;
  user_id: string;
  body_part: BodyPart;
  exercise_type: ExerciseType;
  total_duration_min: number;
  items: DraftItem[];
  memo: string | null;
  success_flag: 'Y' | 'N' | null;
  started_at: string;
  completed_at: string | null;
}
