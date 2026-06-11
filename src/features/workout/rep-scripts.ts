/**
 * 운동 코칭 패턴을 reps 길이의 TTS 스크립트 배열로 펼친다.
 *
 * - 처음 2회: earlyReps (순서대로)
 * - 마지막 3회: finalReps (순서대로)
 * - 그 사이: middleReps 순환
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

export function generateRepScripts(pattern: CoachingPattern): string[] {
  const { reps, earlyReps, middleReps, finalReps } = pattern;
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
    out.push(fillCount(pickTemplate(middleReps, i), n));
  }
  for (let i = 0; i < finalCount; i++, n++) {
    out.push(fillCount(pickTemplate(finalReps, i), n));
  }

  return out;
}
