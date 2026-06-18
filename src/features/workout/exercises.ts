/**
 * exercises 카탈로그 접근 계층.
 *
 * 추천 엔진은 다음 두 단계로 DB 를 사용한다:
 *   1) filterCandidates: 사용자 조건으로 100개 → 15~25개 후보 추리기 (LLM 입력용)
 *   2) fetchExercisesByIds: LLM 이 고른 ID 들의 전체 데이터 조회 (UI/코칭용)
 */

import { supabase } from '@/lib/supabase';

import type { RoutineInput } from './useGenerateRoutine';

/** 전체 컬럼 (DB 그대로). UI/코칭에 모두 필요한 데이터. */
export interface ExerciseRow {
  id: string;
  name: string;
  body_region: string | null;
  exercise_type: string[];
  goal_tags: string[];
  place_tags: string[];
  phase_tags: string[];
  target_parts: string[];
  contraindicated_parts: string[];
  equipment: string[];
  is_high_impact: boolean;
  intensity: number;
  default_sets: number | null;
  default_reps: number | null;
  min_reps: number | null;
  max_reps: number | null;
  default_duration_sec: number | null;
  min_duration_sec: number | null;
  max_duration_sec: number | null;
  description_text: string;
  caution_text: string;
  description_audio_url: string | null;
  caution_audio_url: string | null;
  early_reps: string[];
  middle_reps: string[];
  form_cues: string[];
  final_reps: string[];
  time_scripts: string[];
  halfway_encouragement: string;
}

/** LLM 입력용 압축 행 — 선택 판단에 필요한 최소 필드만. */
export interface CandidateRow {
  id: string;
  name: string;
  body_region: string | null;
  phase_tags: string[];
  intensity: number;
  is_set_based: boolean;
}

/** 컨디션 → 허용 최대 강도 (피곤할수록 가벼운 운동만). */
const CONDITION_MAX_INTENSITY: Record<string, number> = {
  좋음: 5,
  보통: 4,
  피곤해요: 2,
};

/** UI 라디오 선택 → 사용자가 가진 장비 집합. */
const USER_EQUIPMENT: Record<string, string[]> = {
  매트: ['매트'],
  없음: [],
  덤벨: ['덤벨', '매트'],
};

/** 사용자 조건으로 후보 운동 필터링.
 *
 * 두 쿼리를 합친다:
 *   1) 메인 후보: goal_tags 가 사용자 목표와 매칭되는 운동
 *   2) 스트레칭: body_region='스트레칭' 인 모든 운동 (goal 무관)
 *      → 워밍업/마무리용. 스트레칭은 대부분 goal_tags=['자세 개선'] 이라
 *      체중 감량/체력 향상 사용자에겐 (1) 만으로는 후보에서 빠짐.
 * 두 결과를 합친 뒤 id 기준 dedupe.
 */
export async function filterCandidates(input: RoutineInput): Promise<CandidateRow[]> {
  const baseCap = CONDITION_MAX_INTENSITY[input.condition] ?? 4;
  // easier=true 면 강도 상한을 한 단계 더 낮춤. 최소 1 까진 유지.
  const maxIntensity = input.easier ? Math.max(1, baseCap - 1) : baseCap;
  const userEquipment = USER_EQUIPMENT[input.equipment] ?? [];

  const selectCols =
    'id, name, body_region, phase_tags, intensity, default_sets, default_duration_sec';

  function buildBaseQuery() {
    let q = supabase
      .from('exercises')
      .select(selectCols)
      .containedBy('equipment', userEquipment)
      .lte('intensity', maxIntensity);

    if (input.bodyPart && input.bodyPart !== '없음') {
      // contraindicated_parts 에 사용자가 불편한 부위가 들어 있으면 제외
      q = q.not('contraindicated_parts', 'cs', `{${input.bodyPart}}`);
    }
    return q;
  }

  const [mainResp, stretchResp] = await Promise.all([
    buildBaseQuery().contains('goal_tags', [input.goal]),
    buildBaseQuery().eq('body_region', '스트레칭'),
  ]);

  if (mainResp.error) throw mainResp.error;
  if (stretchResp.error) throw stretchResp.error;

  const merged = new Map<string, CandidateRow>();
  for (const r of [...(mainResp.data ?? []), ...(stretchResp.data ?? [])]) {
    if (merged.has(r.id)) continue;
    merged.set(r.id, {
      id: r.id,
      name: r.name,
      body_region: r.body_region,
      phase_tags: r.phase_tags,
      intensity: r.intensity,
      is_set_based: r.default_sets !== null,
    });
  }

  return Array.from(merged.values());
}

/** 선택된 ID 들의 전체 데이터 조회. */
export async function fetchExercisesByIds(ids: string[]): Promise<ExerciseRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .in('id', ids);
  if (error) throw error;
  return (data ?? []) as ExerciseRow[];
}
