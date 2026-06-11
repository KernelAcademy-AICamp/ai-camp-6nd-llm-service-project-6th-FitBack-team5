import { supabase } from '@/lib/supabase';

import type { Routine } from './useGenerateRoutine';

export interface ExerciseRow {
  id: string;
  name: string;
  category: string | null;
  muscle_group: string | null;
  description_text: string;
  description_audio_url: string | null;
  caution_text: string;
  caution_audio_url: string | null;
  tts_version: number;
}

/**
 * 루틴의 운동들을 exercises 마스터 테이블에 upsert.
 * 1단계: name이 이미 있으면 skip (첫 생성된 마스터를 신뢰).
 * 추후 Phase 2: 유사도 검색으로 dedup, 신규시에만 신규 마스터.
 */
export async function persistRoutineExercises(routine: Routine): Promise<void> {
  const rows = routine.exercises
    .map((ex) => ({
      name: ex.name.trim(),
      description_text: ex.description,
      caution_text: ex.caution,
    }))
    .filter((r) => r.name.length > 0 && r.description_text.length > 0);

  if (rows.length === 0) return;

  const { error } = await supabase
    .from('exercises')
    .upsert(rows, { onConflict: 'name', ignoreDuplicates: true });

  if (error) {
    console.warn('[persistRoutineExercises] failed:', error.message);
  }
}

/**
 * 운동명으로 마스터 조회. 캐시된 audio_url을 활용하기 위함.
 */
export async function fetchExerciseByName(name: string): Promise<ExerciseRow | null> {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('name', name.trim())
    .maybeSingle();
  if (error || !data) return null;
  return data as ExerciseRow;
}
