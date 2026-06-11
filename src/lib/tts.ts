/**
 * TTS 추상화 — 화면 코드는 이 모듈만 사용.
 *
 * 1단계: expo-speech 만 구현 (캐시된 audioUrl이 있어도 무시하고 speak).
 * 추후 클라우드 TTS 도입 시 playCue 내부에서 expo-av로 캐시 재생 분기 추가.
 */
import * as Speech from 'expo-speech';

export const TTS_VERSION = 1;

interface SpeakOptions {
  rate?: number;
  onDone?: () => void;
  onError?: () => void;
}

export interface Tts {
  speak(text: string, opts?: SpeakOptions): void;
  stop(): void;
}

// 글로벌 TTS rate (사용자가 속도 조절 시 변경됨)
let globalRate = 1.0;
export function setTtsRate(rate: number) {
  globalRate = rate;
}
export function getTtsRate(): number {
  return globalRate;
}

export const tts: Tts = {
  speak(text, opts) {
    const trimmed = text?.trim();
    if (!trimmed) {
      opts?.onDone?.();
      return;
    }
    Speech.speak(trimmed, {
      language: 'ko-KR',
      rate: opts?.rate ?? 1.0,
      onDone: opts?.onDone,
      onError: opts?.onError ?? opts?.onDone,
    });
  },
  stop() {
    Speech.stop();
  },
};

interface PlayCueOptions {
  /** 캐시된 오디오 URL. 1단계에선 무시되고 TTS로 fallback. */
  audioUrl?: string | null;
  /** TTS로 fallback할 텍스트. */
  text: string;
  rate?: number;
  onDone?: () => void;
  onError?: () => void;
}

/**
 * 큐 1회 재생. 캐시된 audioUrl이 있으면 그걸 쓰고, 없으면 TTS.
 * 1단계는 항상 TTS로 fallback.
 *
 * onDone fallback: 웹 SpeechSynthesis 가 종종 onend 이벤트를 보내지 않음
 * (utterance GC 등 알려진 Chrome 버그). 예상 발화 시간 + 마진 후에도
 * onDone/onError 가 안 오면 강제로 onDone 발화하여 상태머신이 멈추지 않게 함.
 */
export function playCue(opts: PlayCueOptions) {
  // TODO Phase 2: audioUrl이 있으면 expo-av로 재생, onDone 콜백 wiring
  const trimmed = opts.text?.trim() ?? '';
  const rate = opts.rate ?? 1.0;
  const audioUrl = opts.audioUrl;

  if (audioUrl) {
    // Phase 2: expo-av Audio.Sound로 재생
    // TODO: import { Audio } from 'expo-av'; 설치 후 활성화
    // const { sound } = await Audio.Sound.createAsync({ uri: audioUrl });
    // await sound.playAsync();
    // sound.setOnPlaybackStatusUpdate(status => {
    //   if (status.isLoaded && status.didJustFinish) onDone?.();
    // });
    // return;

    // 지금은 audioUrl 있어도 expo-speech로 fallback (주석 처리된 위 코드가 Phase 2 구현)
  }

  // 한국어 발화 속도 추정: 글자당 ~140ms (rate 1.0 기준). rate 비례 조정.
  const estimatedMs = Math.max(2500, (trimmed.length * 140) / rate + 2000);

  let done = false;
  const finish = (fn?: () => void) => {
    if (done) return;
    done = true;
    if (fallbackId) clearTimeout(fallbackId);
    fn?.();
  };

  const fallbackId: ReturnType<typeof setTimeout> = setTimeout(
    () => finish(opts.onDone),
    estimatedMs,
  );

  tts.speak(trimmed, {
    rate,
    onDone: () => finish(opts.onDone),
    onError: () => finish(opts.onError ?? opts.onDone),
  });
}

/**
 * Phase 2에서 구현 예정.
 * tts_cache 테이블 조회 → 없으면 Cloud TTS API → Supabase Storage 저장 → URL 반환.
 * Phase 1에서는 항상 null 반환 (expo-speech fallback 사용).
 */
export async function getOrCreateAudio(text: string): Promise<string | null> {
  void text;
  return null;
}
