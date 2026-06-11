/**
 * TTS 추상화 — 화면 코드는 이 모듈만 사용.
 *
 * 1단계: expo-speech 만 구현 (캐시된 audioUrl이 있어도 무시하고 speak).
 * 추후 클라우드 TTS 도입 시 playCue 내부에서 expo-av로 캐시 재생 분기 추가.
 */
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

export const TTS_VERSION = 1;

/**
 * 웹 SpeechSynthesis 자동재생 게이트 해제용. 유저 제스처(클릭/탭) 콜스택에서
 * 호출해야 효과가 있다. native에서는 no-op.
 *
 * 무음·짧은 utterance를 한 번 speak해두면 같은 탭의 이후 speak가 무성 처리되지 않는다.
 */
let primed = false;
export function primeTts(): void {
  if (Platform.OS !== 'web' || primed) return;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    const u = new window.SpeechSynthesisUtterance(' ');
    u.volume = 0;
    u.lang = 'ko-KR';
    window.speechSynthesis.speak(u);
    primed = true;
  } catch {
    // 일부 브라우저/환경 비대응 — 조용히 무시
  }
}

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

// ── 웹: window.speechSynthesis 직접 사용 (expo-speech 우회) ─────────────
//
// 이유: expo-speech 웹 셈이 보이스 로딩 race, onend 누락, 동시 utterance 처리
// 등에서 종종 무음이 됨. 직접 API를 쓰면 보이스 선택과 큐 동작을 통제 가능.

function pickKoreanVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  return (
    voices.find((v) => v.lang === 'ko-KR') ??
    voices.find((v) => v.lang?.startsWith('ko')) ??
    voices.find((v) => v.default) ??
    voices[0] ??
    null
  );
}

function webSpeak(text: string, opts?: SpeakOptions): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    opts?.onDone?.();
    return;
  }
  const synth = window.speechSynthesis;

  // Chrome 알려진 버그: ~15초 이상 idle 또는 이전 utterance가 깔끔히 정리 안 되면
  // 내부 큐가 paused/stuck 상태로 빠져 다음 speak가 무음. cancel + resume으로 강제 해제.
  synth.cancel();
  if (synth.paused) synth.resume();

  const u = new window.SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR';
  u.rate = opts?.rate ?? 1.0;
  u.volume = 1;
  const voice = pickKoreanVoice();
  if (voice) u.voice = voice;
  u.onend = () => opts?.onDone?.();
  u.onerror = () => (opts?.onError ?? opts?.onDone)?.();

  // 첫 호출 시점에 voices가 아직 비어있으면 voiceschanged 이후 다시 시도
  if (!synth.getVoices().length) {
    const handler = () => {
      synth.removeEventListener('voiceschanged', handler);
      const v = pickKoreanVoice();
      if (v) u.voice = v;
      synth.speak(u);
    };
    synth.addEventListener('voiceschanged', handler);
    // 200ms 안에 voiceschanged 안 오면 그냥 speak (기본 보이스)
    setTimeout(() => {
      synth.removeEventListener('voiceschanged', handler);
      if (!u.voice) synth.speak(u);
    }, 200);
    return;
  }
  synth.speak(u);
}

function webStop(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
}

export const tts: Tts = {
  speak(text, opts) {
    const trimmed = text?.trim();
    if (!trimmed) {
      opts?.onDone?.();
      return;
    }
    if (Platform.OS === 'web') {
      webSpeak(trimmed, opts);
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
    if (Platform.OS === 'web') {
      webStop();
      return;
    }
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
