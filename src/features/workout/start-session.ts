/**
 * 운동 세션 시작 준비.
 *
 * - OpenAI TTS 사전합성(prime) — session.tsx 의 playCue 호출과 1:1 매칭되는 모든 멘트.
 * - 첫 운동 intro 만 동기 await — session 진입 직후 캐시 HIT 보장.
 * - 나머지는 백그라운드로 계속 합성.
 *
 * session.tsx 의 REST_SECONDS / SINO_COUNTDOWN_5 / 발화 템플릿이 바뀌면 여기도 갱신.
 */

import type { Routine } from './useGenerateRoutine';
import { getOrCreateAudio, primeTts, type TtsMode } from '@/lib/tts';

const REST_SECONDS = 10;
const SINO_COUNTDOWN_5 = ['오', '사', '삼', '이', '일'];
const FINISH_TEXT = '오늘 운동을 모두 마쳤어요. 수고하셨어요.';

function modeFor(isStretch: boolean): TtsMode {
  return isStretch ? 'stretch' : 'main';
}

/** 백그라운드 prime — 호출자는 await 하지 않음. */
function primeAllInBackground(routine: Routine): void {
  routine.exercises.forEach((ex) => {
    const mode = modeFor(ex.isStretch);

    getOrCreateAudio(
      `${ex.name}을(를) 시작할게요. ${ex.description}`.trim(),
      mode,
    ).catch(() => {});

    if (ex.caution) getOrCreateAudio(ex.caution, mode).catch(() => {});
    if (ex.halfwayEncouragement) {
      getOrCreateAudio(ex.halfwayEncouragement, mode).catch(() => {});
    }
    ex.repScripts.forEach((s) => getOrCreateAudio(s, mode).catch(() => {}));
    ex.timeScripts.forEach((s) => getOrCreateAudio(s, mode).catch(() => {}));

    getOrCreateAudio(`${ex.name}을 모두 완료했어요.`, mode).catch(() => {});

    const repsMatch = ex.detail.match(/(\d+)\s*회\s*[×x*]\s*(\d+)\s*세트/);
    if (repsMatch) {
      const reps = parseInt(repsMatch[1], 10);
      const sets = parseInt(repsMatch[2], 10);
      for (let s = 1; s <= sets; s++) {
        getOrCreateAudio(
          `${s}세트를 시작합니다. 총 ${reps}회예요. 준비, 시작.`,
          mode,
        ).catch(() => {});
      }
      for (let s = 1; s < sets; s++) {
        getOrCreateAudio(
          `좋아요. ${s}세트 완료했어요. ${REST_SECONDS}초 쉬어갈게요.`,
          mode,
        ).catch(() => {});
      }
    } else {
      SINO_COUNTDOWN_5.forEach((t) => getOrCreateAudio(t, mode).catch(() => {}));
    }
  });

  const lastEx = routine.exercises[routine.exercises.length - 1];
  if (lastEx) {
    getOrCreateAudio(FINISH_TEXT, modeFor(lastEx.isStretch)).catch(() => {});
  }
}

/**
 * 세션 진입 직전 호출. primeTts 게이트 해제 + 전체 백그라운드 prime + 첫 intro 대기.
 * 호출자는 await 후 router.push('/workout/session') 하면 된다.
 */
export async function prepareSessionAudio(routine: Routine): Promise<void> {
  primeTts();
  primeAllInBackground(routine);

  const firstEx = routine.exercises[0];
  if (firstEx) {
    const firstMode = modeFor(firstEx.isStretch);
    const firstIntroText =
      `${firstEx.name}을(를) 시작할게요. ${firstEx.description}`.trim();
    await getOrCreateAudio(firstIntroText, firstMode).catch(() => null);
  }
}
