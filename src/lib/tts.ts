/**
 * TTS 추상화 — 화면 코드는 이 모듈만 사용.
 *
 * 2단계: OpenAI TTS(synth-tts Edge Function) 캐시 우선, 실패/미스 시 expo-speech.
 *   - getOrCreateAudio(text): Edge Function 으로 합성된 MP3 URL 받아 메모리 캐시
 *   - playCue(opts): audioUrl(외부 명시) > 메모리 캐시 > expo-speech fallback 순
 *   - 웹: <audio> 엘리먼트, iOS/Android: expo-audio AudioPlayer 로 mp3 재생.
 *     실패 시 expo-speech 시스템 보이스로 fallback (절대 무음 안 됨).
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

// iOS 무음모드/잠금화면에서도 운동 코칭 음성이 끊기지 않도록 카테고리 설정.
// 호출 실패해도 앱은 정상 동작 (그냥 무음모드에서 들리지 않을 뿐).
if (Platform.OS !== 'web') {
  setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: false, // 백그라운드 재생은 별도 권한 필요 — 일단 false
  }).catch(() => {});
}

export const TTS_VERSION = 1;

/** TTS 톤 모드. Edge Function 의 INSTRUCTIONS_BY_MODE 와 1:1 매칭. */
export type TtsMode = 'main' | 'stretch';

// 현재 재생 중인 운동의 mode. 화면 전환마다 setTtsMode 로 갱신한다.
// playCue 가 메모리 캐시를 조회할 때 이 값을 사용해 mode 별 URL 을 선택.
let currentMode: TtsMode = 'main';
export function setTtsMode(mode: TtsMode): void {
  currentMode = mode;
}
export function getTtsMode(): TtsMode {
  return currentMode;
}

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
  /** 진짜 일시정지 — 오디오 객체를 파괴하지 않고 currentTime 보존. */
  pause(): void;
  /** pause() 된 오디오를 그 위치에서 이어 재생. */
  resume(): void;
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

// ── 현재 재생 중인 mp3 인스턴스 추적 ─────────────────────────
// playCue 가 캐시 URL 로 mp3 를 재생하면 여기 보관. tts.stop() 이 같이 정지시킨다.
// 보관 안 하면 건너뛰기·일시정지 시 SpeechSynthesis 만 끊고 mp3 는 계속 흐름 → 다음 cue 와 겹침.
let activeWebAudio: HTMLAudioElement | null = null;
let activeNativePlayerStopper: (() => void) | null = null;
// 일시정지(currentTime 보존) / 재개용. 네이티브는 playCue 가 등록.
let activeNativePlayerPauser: (() => void) | null = null;
let activeNativePlayerResumer: (() => void) | null = null;

function stopActiveAudio(): void {
  if (activeWebAudio) {
    const audio = activeWebAudio;
    activeWebAudio = null;
    // onended/onerror 를 먼저 떼서 pause 가 콜백을 트리거하지 않게 함.
    // (안 그러면 stop 직후 다음 phase 의 onDone 이 두 번 발화될 수 있음)
    audio.onended = null;
    audio.onerror = null;
    try {
      audio.pause();
      audio.src = '';
    } catch {
      // pause 실패는 무시 — 이미 release 된 상태일 수 있음
    }
  }
  if (activeNativePlayerStopper) {
    const stopper = activeNativePlayerStopper;
    activeNativePlayerStopper = null;
    activeNativePlayerPauser = null;
    activeNativePlayerResumer = null;
    try {
      stopper();
    } catch {
      // 무시
    }
  }
}

// 파괴하지 않고 일시정지만 — currentTime 보존, resume 으로 이어 재생 가능.
function pauseActiveAudio(): void {
  if (activeWebAudio) {
    try {
      activeWebAudio.pause();
    } catch {
      // 무시
    }
  }
  if (activeNativePlayerPauser) {
    try {
      activeNativePlayerPauser();
    } catch {
      // 무시
    }
  }
}

function resumeActiveAudio(): void {
  if (activeWebAudio) {
    try {
      void activeWebAudio.play();
    } catch {
      // 무시 — 사용자 제스처 외 자동 재생 차단 등은 호출자가 다음 클릭으로 회복
    }
  }
  if (activeNativePlayerResumer) {
    try {
      activeNativePlayerResumer();
    } catch {
      // 무시
    }
  }
}

// Android는 expo-speech의 pause/resume 미지원 → stop 후 resume 시 재발화. 그 폴백을 위해
// 현재 native Speech 발화를 보관.
//   - suppressed: tts.pause/tts.stop 으로 인해 Speech.stop 을 우리가 부른 경우. expo-speech 가
//     그때 자동 트리거하는 onDone 이 phase 진행 콜백으로 새는 걸 막는다.
//   - tts.stop 은 utterance 자체를 null 로 (resume 으로 부활하면 안 됨)
//   - tts.pause(Android) 는 utterance 를 유지 (resume 이 같은 text/opts 로 재발화)
type NativeUtterance = { text: string; opts?: SpeakOptions; suppressed: boolean };
let currentNativeUtterance: NativeUtterance | null = null;

function nativeSpeak(text: string, opts?: SpeakOptions): void {
  const u: NativeUtterance = { text, opts, suppressed: false };
  currentNativeUtterance = u;
  Speech.speak(text, {
    language: 'ko-KR',
    rate: opts?.rate ?? 1.0,
    onDone: () => {
      if (currentNativeUtterance === u) currentNativeUtterance = null;
      if (u.suppressed) return;
      opts?.onDone?.();
    },
    onError: () => {
      if (currentNativeUtterance === u) currentNativeUtterance = null;
      if (u.suppressed) return;
      (opts?.onError ?? opts?.onDone)?.();
    },
  });
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
    nativeSpeak(trimmed, opts);
  },
  stop() {
    stopActiveAudio();
    if (Platform.OS === 'web') {
      webStop();
      return;
    }
    // 활성 Speech 발화가 있을 때만 stop. cached MP3 만 재생 중일 땐 Speech API 가
    // 안드로이드 오디오 세션을 건드릴 수 있어 호출 안 함.
    if (currentNativeUtterance) {
      currentNativeUtterance.suppressed = true;
      currentNativeUtterance = null;
      Speech.stop();
    }
  },
  pause() {
    pauseActiveAudio();
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.pause();
        } catch {
          // 무시
        }
      }
      return;
    }
    if (!currentNativeUtterance) return; // cached MP3 경로는 pauseActiveAudio 가 끝
    if (Platform.OS === 'android') {
      // Android: Speech.pause 미지원 → stop. resume 시 currentNativeUtterance 로 재발화.
      // suppressed=true 로 자동 onDone 이 상위 콜백(phase 진행)으로 새는 것을 막는다.
      currentNativeUtterance.suppressed = true;
      Speech.stop();
      return;
    }
    // iOS: 진짜 pause. Promise rejection 도 같이 무시.
    void Promise.resolve(Speech.pause()).catch(() => {});
  },
  resume() {
    resumeActiveAudio();
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.resume();
        } catch {
          // 무시
        }
      }
      return;
    }
    if (!currentNativeUtterance) return; // cached MP3 경로는 resumeActiveAudio 가 끝
    if (Platform.OS === 'android') {
      // Android: pause 가 stop 이었으므로 resume 은 큐를 처음부터 다시 발화.
      // (Android TTS 엔진은 native pause 자체를 지원 안 함 → 위치 보존 불가능)
      const { text, opts } = currentNativeUtterance;
      nativeSpeak(text, opts);
      return;
    }
    void Promise.resolve(Speech.resume()).catch(() => {});
  },
};

interface PlayCueOptions {
  /** 외부에서 미리 받은 캐시 URL. 없으면 모듈 내부 메모리 캐시에서 조회. */
  audioUrl?: string | null;
  /** TTS로 fallback할 텍스트. 메모리 캐시 키이기도 함. */
  text: string;
  rate?: number;
  onDone?: () => void;
  onError?: () => void;
}

// ── 메모리 캐시 ──────────────────────────────────────────────
// getOrCreateAudio 가 받아 온 URL 을 mode 별로 보관. playCue 가 currentMode 로 동기 조회.
// 페이지 새로고침 시 비워지지만 어차피 Edge Function 이 DB 캐시 HIT 으로
// 즉시 응답하므로 다음 사전 합성 단계에서 빠르게 복원됨.
const audioCache = new Map<string, string>();

function cacheKey(text: string, mode: TtsMode): string {
  return `${mode}:${text.trim()}`;
}

function getCachedAudioUrl(text: string, mode: TtsMode): string | null {
  return audioCache.get(cacheKey(text, mode)) ?? null;
}

// ── 오디오 URL 재생 ──────────────────────────────────────────

function webPlayAudioUrl(
  url: string,
  rate: number,
  onDone?: () => void,
  onError?: () => void,
): void {
  if (typeof window === 'undefined' || typeof window.Audio === 'undefined') {
    (onError ?? onDone)?.();
    return;
  }
  // 이전 mp3 가 아직 흐르고 있으면 먼저 끊는다 — 호출자가 stop 을 잊었어도 겹침 방지.
  stopActiveAudio();
  try {
    const audio = new window.Audio(url);
    activeWebAudio = audio;
    audio.playbackRate = rate;
    audio.onended = () => {
      if (activeWebAudio === audio) activeWebAudio = null;
      onDone?.();
    };
    audio.onerror = () => {
      if (activeWebAudio === audio) activeWebAudio = null;
      (onError ?? onDone)?.();
    };
    audio.play().catch(() => {
      if (activeWebAudio === audio) activeWebAudio = null;
      (onError ?? onDone)?.();
    });
  } catch {
    (onError ?? onDone)?.();
  }
}

/**
 * iOS/Android: expo-audio AudioPlayer 로 mp3 재생.
 * 재생 완료 시 onDone, 에러 시 onError. 한 인스턴스는 한 번만 쓰고 release.
 */
function nativePlayAudioUrl(
  url: string,
  rate: number,
  onDone?: () => void,
  onError?: () => void,
): void {
  // 이전 mp3 가 아직 흐르고 있으면 먼저 끊는다 — 호출자가 stop 을 잊었어도 겹침 방지.
  stopActiveAudio();

  let player: AudioPlayer | null = null;
  let done = false;
  let cancelled = false;
  const finish = (fn?: () => void) => {
    if (done) return;
    done = true;
    if (activeNativePlayerStopper === stopThisPlayer) {
      activeNativePlayerStopper = null;
    }
    try {
      player?.remove();
    } catch {
      // remove 실패는 무시 — 이미 release 된 상태일 수 있음
    }
    if (cancelled) return; // tts.stop() 으로 끊긴 경우 onDone 발화 금지
    fn?.();
  };
  // tts.stop() 이 호출하면 onDone 발화를 막고 player 를 release.
  const stopThisPlayer = () => {
    cancelled = true;
    try {
      player?.pause();
    } catch {
      // 무시
    }
    finish();
  };
  // tts.pause() — currentTime 보존, resume 으로 이어 재생.
  const pauseThisPlayer = () => {
    try {
      player?.pause();
    } catch {
      // 무시
    }
  };
  const resumeThisPlayer = () => {
    try {
      player?.play();
    } catch {
      // 무시
    }
  };

  try {
    player = createAudioPlayer({ uri: url });
    activeNativePlayerStopper = stopThisPlayer;
    activeNativePlayerPauser = pauseThisPlayer;
    activeNativePlayerResumer = resumeThisPlayer;
    // expo-audio v56: playbackRate 는 read-only 프로퍼티. 반드시 setter 메서드 사용.
    player.setPlaybackRate(rate);
    player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) finish(onDone);
      // status.isLoaded === false 인 채 시간이 흘러도 어차피 외부 fallback timer 가 처리.
    });
    player.play();
  } catch {
    finish(onError ?? onDone);
  }
}

/**
 * 큐 1회 재생. 우선순위:
 *   1) opts.audioUrl (외부에서 명시) — 즉시 재생
 *   2) 메모리 캐시 — getOrCreateAudio 가 미리 받아 둔 URL
 *   3) expo-speech / SpeechSynthesis fallback
 *
 * onDone fallback: 웹 SpeechSynthesis 가 종종 onend 이벤트를 보내지 않음
 * (utterance GC 등 알려진 Chrome 버그). 예상 발화 시간 + 마진 후에도
 * onDone/onError 가 안 오면 강제로 onDone 발화하여 상태머신이 멈추지 않게 함.
 */
export function playCue(opts: PlayCueOptions) {
  const trimmed = opts.text?.trim() ?? '';
  const rate = opts.rate ?? 1.0;
  // 외부 audioUrl 우선, 그 다음 현재 mode 의 메모리 캐시.
  const audioUrl = opts.audioUrl ?? getCachedAudioUrl(trimmed, currentMode);

  // 캐시된 URL 이 있으면 mp3 직접 재생 (웹은 <audio>, 네이티브는 expo-audio).
  // URL 이 없거나 재생 실패 시 아래 expo-speech / SpeechSynthesis fallback.
  if (audioUrl) {
    if (Platform.OS === 'web') {
      webPlayAudioUrl(audioUrl, rate, opts.onDone, opts.onError);
    } else {
      nativePlayAudioUrl(audioUrl, rate, opts.onDone, opts.onError);
    }
    return;
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
 * 텍스트에 대응하는 캐시 오디오 URL 을 가져온다. 없으면 합성 후 URL 반환.
 *
 * - 메모리 캐시 HIT: 즉시 반환
 * - 메모리 캐시 MISS: synth-tts Edge Function 호출
 *   → DB(tts_cache) HIT 면 ~100ms, MISS 면 OpenAI 합성 ~500~1500ms
 *   → 반환된 URL 을 메모리 캐시에 저장하여 playCue 가 동기 조회 가능하게 함.
 *
 * 실패 시 null 반환 (호출자는 무시; playCue 가 expo-speech 로 자동 fallback).
 */
export async function getOrCreateAudio(
  text: string,
  mode: TtsMode = 'main',
): Promise<string | null> {
  const trimmed = text?.trim() ?? '';
  if (!trimmed) return null;
  const key = cacheKey(trimmed, mode);

  const memo = audioCache.get(key);
  if (memo) return memo;

  try {
    const { data, error } = await supabase.functions.invoke<{
      audio_url?: string;
      error?: string;
    }>('synth-tts', { body: { text: trimmed, mode } });

    if (error || !data?.audio_url) {
      if (data?.error) console.warn('[synth-tts]', data.error);
      return null;
    }
    audioCache.set(key, data.audio_url);
    return data.audio_url;
  } catch (e) {
    console.warn('[synth-tts] invoke failed:', e);
    return null;
  }
}
