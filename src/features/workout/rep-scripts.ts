/**
 * 운동 코칭 패턴을 reps 길이의 TTS 스크립트 배열로 펼친다.
 *
 * - 처음 2회: earlyReps (순서대로)
 * - 마지막 3회: finalReps (순서대로)
 * - 그 사이: middleReps 순환 + formCues 가 슬롯 0/2/4 에 끼어듦
 *   → 같은 부위 운동들이 공유하는 generic middleReps 위에,
 *     운동 특화 폼 큐(formCues)가 자연스럽게 섞여 발화된다.
 *   → formCues 가 비어 있으면 기존 동작 그대로 (middleReps 순환만).
 * - reps가 작으면 (1~4) early/final이 겹치지 않도록 clamp
 * - `{count}` placeholder는 "하나, 둘, ...열, 열하나..." 한글 카운트로 치환
 */

export interface CoachingPattern {
  exerciseId: string;
  exerciseName: string;
  reps: number;
  secondsPerRep: number;
  earlyReps: string[];
  middleReps: string[];
  finalReps: string[];
  /** 운동 특화 폼 큐 0~3개. 비어 있으면 middleReps generic 만 발화. */
  formCues?: string[];
}

export const KOREAN_NUMBERS = [
  '하나', '둘', '셋', '넷', '다섯',
  '여섯', '일곱', '여덟', '아홉', '열',
  '열하나', '열둘', '열셋', '열넷', '열다섯',
  '열여섯', '열일곱', '열여덟', '열아홉', '스물',
] as const;

const EARLY_REP_COUNT = 2;
const FINAL_REP_COUNT = 3;

export function koreanCount(n: number): string {
  return KOREAN_NUMBERS[n - 1] ?? String(n);
}

function fillCount(template: string, count: number): string {
  return template.replace(/\{count\}/g, koreanCount(count));
}

function pickTemplate(pool: string[], i: number): string {
  // pool이 비어있으면 숫자만 발화하도록 fallback
  if (pool.length === 0) return '{count}';
  return pool[i % pool.length];
}

/**
 * middle 슬롯 인덱스 i 에 대해 cue 를 결정한다.
 * - 슬롯 0, 2, 4 (mod 5): formCues 가 있으면 form 큐로 교체, 없으면 middle generic
 * - 슬롯 1, 3 (mod 5): 항상 middle generic
 *
 * 결과적으로 12회 반복 운동의 중반 7회 중 약 4회가 운동 특화 멘트로 나간다.
 */
function pickMiddleTemplate(
  middleReps: string[],
  formCues: string[],
  i: number,
): string {
  const slot = i % 5;
  const formSlotIndex = slot === 0 ? 0 : slot === 2 ? 1 : slot === 4 ? 2 : -1;

  if (formSlotIndex >= 0) {
    const form = formCues[formSlotIndex];
    if (form) return form;
  }
  return pickTemplate(middleReps, i);
}

export function generateRepScripts(pattern: CoachingPattern): string[] {
  const { reps, earlyReps, middleReps, finalReps, formCues = [] } = pattern;
  if (reps <= 0) return [];

  const earlyCount = Math.min(EARLY_REP_COUNT, reps);
  const finalCount = Math.min(FINAL_REP_COUNT, Math.max(0, reps - earlyCount));
  const middleCount = reps - earlyCount - finalCount;

  const out: string[] = [];
  let n = 1;

  for (let i = 0; i < earlyCount; i++, n++) {
    out.push(fillCount(pickTemplate(earlyReps, i), n));
  }
  for (let i = 0; i < middleCount; i++, n++) {
    out.push(fillCount(pickMiddleTemplate(middleReps, formCues, i), n));
  }
  for (let i = 0; i < finalCount; i++, n++) {
    out.push(fillCount(pickTemplate(finalReps, i), n));
  }

  return out;
}
