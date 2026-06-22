import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Headphones, Pause, Play, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/components/ui';
import {
  BottomTabInset,
  Elevation,
  MaxContentWidth,
  Palette,
  Radius,
  ScreenPadding,
  Spacing,
} from '@/constants/theme';
import { koreanCount } from '@/features/workout/rep-scripts';
import { useTheme } from '@/hooks/use-theme';
import { playCue, setTtsMode, tts } from '@/lib/tts';
import { useWorkoutSession } from '@/stores/workout-session';

// ────────────────────────────────────────────────────────────
// 상수
// ────────────────────────────────────────────────────────────

const REP_INTERVAL_MS = 1500; // rep 사이 간격 (TTS 끝난 뒤 다음 숫자까지)
const REST_SECONDS = 10;

// ────────────────────────────────────────────────────────────
// detail 파싱
// ────────────────────────────────────────────────────────────

type ParsedDetail =
  | { type: 'time'; totalSeconds: number }
  | { type: 'reps'; reps: number; sets: number };

function parseDetail(detail: string): ParsedDetail {
  // "N분 M초", "N분", "M초" 순으로 매칭 (분/초 혼합 표기 지원).
  const minMatch = detail.match(/(\d+)\s*분/);
  const secMatch = detail.match(/(\d+)\s*초/);
  if (minMatch || secMatch) {
    const minutes = minMatch ? parseInt(minMatch[1], 10) : 0;
    const seconds = secMatch ? parseInt(secMatch[1], 10) : 0;
    return { type: 'time', totalSeconds: minutes * 60 + seconds };
  }
  const reps = detail.match(/(\d+)\s*회\s*[×x*]\s*(\d+)\s*세트/);
  if (reps) {
    return {
      type: 'reps',
      reps: parseInt(reps[1], 10),
      sets: parseInt(reps[2], 10),
    };
  }
  return { type: 'time', totalSeconds: 30 };
}

function formatTime(s: number): string {
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}


// ────────────────────────────────────────────────────────────
// 상태머신
// ────────────────────────────────────────────────────────────

type Phase =
  | { kind: 'intro' }
  | { kind: 'caution' }
  | { kind: 'set-start'; set: number }
  | { kind: 'rep'; set: number; rep: number }
  | { kind: 'rest'; set: number; secondsLeft: number }
  | { kind: 'time'; secondsLeft: number; totalSeconds: number }
  | { kind: 'exercise-finish' }
  | { kind: 'finish' };


const RATE_OPTIONS = [1.0, 1.25, 1.5] as const;

/** 시간 기반 마지막 5초 카운트다운 — 한자어 (영화 카운트다운 톤) */
const SINO_COUNTDOWN_5 = ['오', '사', '삼', '이', '일'] as const;

/**
 * 오디오 파형(waveform) 막대 — 결정론적 의사 랜덤 높이(px).
 * RN/Web 의 % 높이 렌더링이 부모 flex 안에서 안정적이지 않아 절대 픽셀로 고정한다.
 */
const WAVEFORM_BAR_COUNT = 80;
const WAVEFORM_MIN_HEIGHT = 6;
const WAVEFORM_MAX_HEIGHT = 24;
const WAVEFORM_BARS: readonly number[] = Array.from({ length: WAVEFORM_BAR_COUNT }, (_, i) => {
  const n = Math.abs(Math.sin(i * 12.9898 + 78.233) * 43758.5453);
  const frac = n - Math.floor(n);
  return WAVEFORM_MIN_HEIGHT + frac * (WAVEFORM_MAX_HEIGHT - WAVEFORM_MIN_HEIGHT);
});

/** 현재 운동 안에서의 진행률 (0~1). 전체 progress bar 계산에 사용. */
function exerciseFraction(phase: Phase, parsed: ParsedDetail | null): number {
  if (phase.kind === 'intro' || phase.kind === 'caution') return 0;
  if (phase.kind === 'exercise-finish' || phase.kind === 'finish') return 1;
  if (phase.kind === 'time' && parsed?.type === 'time') {
    return (parsed.totalSeconds - phase.secondsLeft) / parsed.totalSeconds;
  }
  if (parsed?.type === 'reps') {
    const totalReps = parsed.reps * parsed.sets;
    if (phase.kind === 'set-start') return ((phase.set - 1) * parsed.reps) / totalReps;
    if (phase.kind === 'rep') return ((phase.set - 1) * parsed.reps + phase.rep) / totalReps;
    if (phase.kind === 'rest') return (phase.set * parsed.reps) / totalReps;
  }
  return 0;
}

/** 오디오 진행바 좌/우 라벨. time 운동은 MM:SS, reps 운동은 "N회". */
function audioProgressLabels(
  phase: Phase,
  parsed: ParsedDetail | null,
): { left: string; right: string } {
  if (parsed?.type === 'time') {
    const total = parsed.totalSeconds;
    let elapsed = 0;
    if (phase.kind === 'time') elapsed = total - phase.secondsLeft;
    else if (phase.kind === 'exercise-finish' || phase.kind === 'finish') elapsed = total;
    return { left: formatTime(elapsed), right: formatTime(total) };
  }
  if (parsed?.type === 'reps') {
    const totalReps = parsed.reps * parsed.sets;
    let done = 0;
    if (phase.kind === 'set-start') done = (phase.set - 1) * parsed.reps;
    else if (phase.kind === 'rep') done = (phase.set - 1) * parsed.reps + phase.rep;
    else if (phase.kind === 'rest') done = phase.set * parsed.reps;
    else if (phase.kind === 'exercise-finish' || phase.kind === 'finish') done = totalReps;
    return { left: `${done}회`, right: `${totalReps}회` };
  }
  return { left: '00:00', right: '00:00' };
}

// ────────────────────────────────────────────────────────────
// 화면
// ────────────────────────────────────────────────────────────

export default function SessionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const routine = useWorkoutSession((s) => s.routine);
  const clearRoutine = useWorkoutSession((s) => s.clear);
  const incrementCompleted = useWorkoutSession((s) => s.incrementCompleted);
  const startSession = useWorkoutSession((s) => s.startSession);

  // session 진입 시각을 한 번만 기록 (사용자가 화면 진입할 때).
  // complete.tsx 가 경과 시간을 MM:SS 로 계산하기 위해 필요.
  useEffect(() => {
    startSession();
  }, [startSession]);

  // exercise-finish 단계에 자연 도달한 운동 idx 를 추적 — 동일 idx 중복 증가 방지.
  const countedRef = useRef<Set<number>>(new Set());

  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' });
  // 다시 듣기 카운터 — intro effect 의 deps 에 들어가서, 같은 intro phase 라도 강제 재실행 유도.
  const [replayKey, setReplayKey] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  // isPaused 를 audio-playing effect 의 dep 에서 빼서 cleanup(tts.stop)이 일시정지에 안 걸리게.
  // 대신 effect 내부의 early-return 은 ref 로 최신값 검사.
  const isPausedRef = useRef(false);
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);
  const [rate, setRate] = useState(1.0);
  // intro/caution 진행률 (0~1) — 텍스트 길이 기반 추정 시간으로 0→1 보간. 실제 오디오 종료 시 phase 가 바뀌면 리셋.
  const [introProgress, setIntroProgress] = useState(0);
  // 현재 rep cue 진행률 (0~1) — "하나/둘…" 발화 동안 진행바가 한 회씩 점프하지 않고 부드럽게 차오르도록.
  const [repProgress, setRepProgress] = useState(0);

  // rate 변경 시 발화 중인 멘트를 끊지 않고, 다음 발화부터 새 rate 적용.
  const rateRef = useRef(rate);
  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

  // 시간 기반 phase 상태 — cue 인덱스/절반 격려 진행 여부
  const nextCueIdxRef = useRef(0);
  const halfwayPlayedRef = useRef(false);

  // 시퀀스 onDone 체인이 최신 secondsLeft를 읽도록 ref 동기화
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // routine 없으면 workout 인덱스로 (새로고침 등으로 store 비었을 때 history 의존 X)
  useEffect(() => {
    if (!routine) router.replace('/workout');
  }, [routine, router]);

  const total = routine?.exercises.length ?? 0;
  const current = routine?.exercises[exerciseIdx];
  const parsed = useMemo(
    () => (current ? parseDetail(current.detail) : null),
    [current],
  );

  // 운동이 바뀔 때마다 TTS 톤 모드 갱신 — playCue 가 메모리 캐시 조회 시 사용.
  useEffect(() => {
    setTtsMode(current?.isStretch ? 'stretch' : 'main');
  }, [current?.isStretch]);

  // 시범 영상 플레이어 — videoUrl 없으면 빈 소스. 무음·루프 자동 재생 (TTS 코칭과 겹치지 않게).
  const videoUrl = current?.videoUrl ?? null;
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  // 일시정지 또는 휴식(rest) 단계 → 영상 정지. 그 외엔 자동 재생.
  // 오디오 코칭은 휴식 멘트 그대로 흘러나오고, 영상만 멈춰서 사용자가 쉬는 느낌을 살림.
  useEffect(() => {
    if (!videoUrl) return;
    const shouldPause = isPaused || phase.kind === 'rest';
    if (shouldPause) player.pause();
    else player.play();
  }, [isPaused, phase.kind, videoUrl, player]);

  // 운동 종료 멘트 phase로 우회 (exercise-finish → 다음 운동의 intro 또는 finish)
  function advanceExercise() {
    setPhase({ kind: 'exercise-finish' });
  }

  // 컨트롤
  function handleReplay() {
    tts.stop();
    nextCueIdxRef.current = 0;
    halfwayPlayedRef.current = false;
    // 일시정지 상태에서 replay 누르면 자동 unpause. (replay 는 "처음부터 다시" 의도라 paused 인 채로
    // 정지 후 재생을 두 번 눌러야 들리는 UX 는 부자연스러움.)
    setIsPaused(false);
    setPhase({ kind: 'intro' });
    setReplayKey((k) => k + 1);
  }

  function handleSkip() {
    tts.stop();
    if (exerciseIdx < total - 1) {
      // 다음 운동 intro로 직행 — exercise-finish 멘트 건너뜀
      nextCueIdxRef.current = 0;
      halfwayPlayedRef.current = false;
      setExerciseIdx((i) => i + 1);
      setPhase({ kind: 'intro' });
    } else {
      // 마지막 운동에서 건너뛰기 → 바로 finish (자연 완료 아니므로 completedCount 미증가)
      setPhase({ kind: 'finish' });
    }
  }

  function handlePauseToggle() {
    setIsPaused((p) => {
      const next = !p;
      // 진짜 일시정지/재개 — 오디오 객체는 유지하고 currentTime 보존.
      if (next) tts.pause();
      else tts.resume();
      return next;
    });
  }

  function handleClose() {
    tts.stop();
    if (phase.kind !== 'finish') {
      // 운동 중간에 닫기: partial 기록 없이 바로 나가는 경우
      // store 정리 후 종료
      clearRoutine();
      router.back();
    } else {
      // finish 상태에서 "그냥 닫기": 기록 안 남기고 나가는 경우
      clearRoutine();
      router.back();
    }
  }

  // ── 컴포넌트 unmount 시 cleanup ──
  useEffect(() => {
    return () => {
      tts.stop();
    };
  }, []);

  // ── intro/caution 진행률 보간 — 텍스트 길이 기반 추정 시간으로 0→1.
  //    audio 가 실제로는 더 빨리 끝날 수도 있어 1.0 도달 전 phase 가 바뀌면 reset.
  useEffect(() => {
    if (!current || (phase.kind !== 'intro' && phase.kind !== 'caution')) {
      setIntroProgress(0);
      return;
    }
    const text =
      phase.kind === 'intro'
        ? `${current.name}을(를) 시작할게요. ${current.description}`.trim()
        : (current.caution ?? '').trim();
    // tts.ts 의 추정과 동일: 글자당 ~140ms, 최소 2.5초 + 2s 여유. rate 비례.
    const estimatedMs = Math.max(2500, (text.length * 140) / rateRef.current + 2000);
    let elapsedMs = 0;
    let lastTick = Date.now();
    setIntroProgress(0);
    const id = setInterval(() => {
      const now = Date.now();
      if (isPausedRef.current) {
        lastTick = now; // 일시정지 동안은 누적하지 않음
        return;
      }
      elapsedMs += now - lastTick;
      lastTick = now;
      setIntroProgress(Math.min(1, elapsedMs / estimatedMs));
    }, 100);
    return () => clearInterval(id);
  }, [phase.kind, current, replayKey]);

  // ── rep 진행률 보간 — 현재 rep cue 추정 발화 시간 동안 0→1.
  //    phase 가 rep 가 아니거나 rep 이 바뀌면 0 으로 리셋.
  useEffect(() => {
    if (phase.kind !== 'rep' || !current || !parsed || parsed.type !== 'reps') {
      setRepProgress(0);
      return;
    }
    const text = current.repScripts?.[phase.rep - 1] ?? koreanCount(phase.rep);
    // 한국어 발화: 글자당 ~140ms, 최소 0.8s + 0.4s 여유, rate 비례.
    const estimatedMs = Math.max(800, (text.length * 140) / rateRef.current + 400);
    let elapsedMs = 0;
    let lastTick = Date.now();
    setRepProgress(0);
    const id = setInterval(() => {
      const now = Date.now();
      if (isPausedRef.current) {
        lastTick = now;
        return;
      }
      elapsedMs += now - lastTick;
      lastTick = now;
      setRepProgress(Math.min(1, elapsedMs / estimatedMs));
    }, 80);
    return () => clearInterval(id);
  }, [phase, current, parsed]);

  // ── phase: intro ─ "{name}을(를) 시작할게요. {description}" 발화 ──
  useEffect(() => {
    if (!current || phase.kind !== 'intro' || isPausedRef.current) return;
    const text = `${current.name}을(를) 시작할게요. ${current.description}`.trim();
    const hasCaution = !!current.caution?.trim();

    let cancelled = false;
    playCue({ rate: rateRef.current,
      text,
      onDone: () => {
        if (cancelled) return;
        if (hasCaution) {
          setPhase({ kind: 'caution' });
        } else if (parsed?.type === 'time') {
          nextCueIdxRef.current = 0;
          halfwayPlayedRef.current = false;
          setPhase({
            kind: 'time',
            secondsLeft: parsed.totalSeconds,
            totalSeconds: parsed.totalSeconds,
          });
        } else {
          setPhase({ kind: 'set-start', set: 1 });
        }
      },
    });
    return () => {
      cancelled = true;
      tts.stop();
    };
  }, [current, phase.kind, parsed, replayKey]);

  // ── phase: caution ─ 주의사항 별도 발화 ──
  useEffect(() => {
    if (!current || phase.kind !== 'caution' || isPausedRef.current) return;
    let cancelled = false;
    playCue({ rate: rateRef.current,
      text: current.caution,
      onDone: () => {
        if (cancelled) return;
        if (parsed?.type === 'time') {
          nextCueIdxRef.current = 0;
          halfwayPlayedRef.current = false;
          setPhase({
            kind: 'time',
            secondsLeft: parsed.totalSeconds,
            totalSeconds: parsed.totalSeconds,
          });
        } else {
          setPhase({ kind: 'set-start', set: 1 });
        }
      },
    });
    return () => {
      cancelled = true;
      tts.stop();
    };
  }, [current, phase.kind, parsed]);

  // ── phase: set-start ─ "N세트를 시작합니다. 총 M회예요. 준비, 시작." ──
  useEffect(() => {
    if (phase.kind !== 'set-start' || isPausedRef.current) return;
    if (!parsed || parsed.type !== 'reps') return;
    const setNum = phase.set;
    const text = `${setNum}세트를 시작합니다. 총 ${parsed.reps}회예요. 준비, 시작.`;
    let cancelled = false;
    playCue({ rate: rateRef.current,
      text,
      onDone: () => {
        if (cancelled) return;
        setPhase({ kind: 'rep', set: setNum, rep: 1 });
      },
    });
    return () => {
      cancelled = true;
      tts.stop();
    };
  }, [phase, parsed]);

  // ── phase: rep ─ repScripts[rep-1] 발화 + 다음 rep / rest / 다음 운동 ──
  // repScripts 는 useGenerateRoutine 에서 generateRepScripts() 로 펼친 완성 멘트 배열.
  useEffect(() => {
    if (phase.kind !== 'rep' || isPausedRef.current || !parsed || parsed.type !== 'reps' || !current) return;
    const { reps, sets } = parsed;
    const { set, rep } = phase;
    const text = current.repScripts?.[rep - 1] ?? koreanCount(rep);

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    playCue({ rate: rateRef.current,
      text,
      onDone: () => {
        if (cancelled) return;
        timeoutId = setTimeout(() => {
          if (cancelled) return;
          if (rep < reps) {
            setPhase({ kind: 'rep', set, rep: rep + 1 });
          } else if (set < sets) {
            setPhase({ kind: 'rest', set, secondsLeft: REST_SECONDS });
          } else {
            advanceExercise();
          }
        }, REP_INTERVAL_MS);
      },
    });

    return () => {
      cancelled = true;
      tts.stop();
      if (timeoutId) clearTimeout(timeoutId);
    };
    // advanceExercise는 closure로 충분
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, parsed, current]);

  // ── phase: rest ─ "좋아요. N세트 완료했어요. 30초 쉬어갈게요" + 카운트다운 → 다음 set-start ──
  useEffect(() => {
    if (phase.kind !== 'rest' || isPaused) return;
    let cancelled = false;
    if (phase.secondsLeft === REST_SECONDS) {
      playCue({ rate: rateRef.current,
        text: `좋아요. ${phase.set}세트 완료했어요. ${REST_SECONDS}초 쉬어갈게요.`,
      });
    }
    const interval = setInterval(() => {
      if (cancelled) return;
      setPhase((p) => {
        if (p.kind !== 'rest') return p;
        if (p.secondsLeft <= 1) {
          return { kind: 'set-start', set: p.set + 1 };
        }
        return { ...p, secondsLeft: p.secondsLeft - 1 };
      });
    }, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [phase, isPaused]);

  // ── phase: time ─ 1초 카운트 → 다음 운동 ──
  useEffect(() => {
    if (phase.kind !== 'time' || isPaused) return;
    const interval = setInterval(() => {
      setPhase((p) => {
        if (p.kind !== 'time') return p;
        return { ...p, secondsLeft: Math.max(0, p.secondsLeft - 1) };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase.kind, isPaused]);

  // ── phase: time (신규 스키마) ─ timeScripts 순차 재생 + 절반 격려 ──
  // 절반 격려는 진행 중인 cue가 끝난 뒤(다음 cue 슬롯)에 끼어듦.
  // cue 진행은 onDone 체인으로 진행. 마지막 5초 도달 시 자동으로 빠짐.
  useEffect(() => {
    if (phase.kind !== 'time' || isPausedRef.current || !current) return;
    const cues = current.timeScripts ?? [];
    if (cues.length === 0) return; // 폴백은 별도 effect

    const halfwayPoint = Math.floor(phase.totalSeconds / 2);
    const halfwayMessage = (current.halfwayEncouragement ?? '').trim();
    let cancelled = false;

    function playNext() {
      if (cancelled) return;
      const cur = phaseRef.current;
      if (cur.kind !== 'time') return;
      if (cur.secondsLeft <= 5) return; // 카운트다운에 자리 양보

      // 절반 시점 격려가 아직이고 절반을 지났으면 먼저 발화
      if (
        !halfwayPlayedRef.current &&
        halfwayMessage.length > 0 &&
        cur.secondsLeft <= halfwayPoint
      ) {
        playCue({
          rate: rateRef.current,
          text: halfwayMessage,
          onDone: () => {
            if (cancelled) return;
            halfwayPlayedRef.current = true;
            playNext();
          },
        });
        return;
      }

      const idx = nextCueIdxRef.current;
      if (idx >= cues.length) return; // cue 소진 → 카운트다운까지 무음
      playCue({
        rate: rateRef.current,
        text: cues[idx],
        onDone: () => {
          if (cancelled) return;
          // 완료된 cue만 인덱스 전진 (pause 시 같은 cue 재발화 위함)
          nextCueIdxRef.current = idx + 1;
          playNext();
        },
      });
    }

    playNext();

    return () => {
      cancelled = true;
      tts.stop();
    };
  }, [phase.kind, current]);

  // ── phase: time (폴백) ─ 기존 routine에 timeScripts 없을 때 2/3 격려만 ──
  useEffect(() => {
    if (phase.kind !== 'time' || isPausedRef.current || !current) return;
    if ((current.timeScripts?.length ?? 0) > 0) return; // 신규 스키마는 위 effect가 처리
    const { secondsLeft, totalSeconds } = phase;
    const twoThirdsLeft = Math.floor(totalSeconds / 3);

    if (secondsLeft === twoThirdsLeft && secondsLeft > 5) {
      const tail =
        current.caution?.trim() || current.description?.trim() || '';
      const parts = ['거의 다 했어요. 조금만 더!', tail].filter(
        (s) => s.length > 0,
      );
      playCue({ rate: rateRef.current, text: parts.join(' ') });
    }
  }, [phase, current]);

  // ── phase: time ─ 마지막 5초 한자어 카운트 + 종료 ──
  useEffect(() => {
    if (phase.kind !== 'time' || isPausedRef.current) return;
    const { secondsLeft } = phase;

    if (secondsLeft >= 1 && secondsLeft <= 5) {
      tts.stop(); // 진행 중인 cue 끊고 카운트로 전환
      const text = SINO_COUNTDOWN_5[5 - secondsLeft];
      playCue({ rate: rateRef.current, text });
    } else if (secondsLeft === 0) {
      advanceExercise();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── phase: exercise-finish ─ "{name}을 모두 완료했어요" → 다음 운동의 intro 또는 finish ──
  useEffect(() => {
    if (phase.kind !== 'exercise-finish' || isPausedRef.current || !current) return;
    // 이 운동이 exercise-finish 단계까지 도달했다 = 건너뛰지 않고 자연 완료.
    // 같은 idx 가 중복 카운트되지 않도록 ref Set 으로 가드.
    if (!countedRef.current.has(exerciseIdx)) {
      countedRef.current.add(exerciseIdx);
      incrementCompleted();
    }
    let cancelled = false;
    playCue({ rate: rateRef.current,
      text: `${current.name}을 모두 완료했어요.`,
      onDone: () => {
        if (cancelled) return;
        if (exerciseIdx < total - 1) {
          setExerciseIdx((i) => i + 1);
          setPhase({ kind: 'intro' });
        } else {
          setPhase({ kind: 'finish' });
        }
      },
    });
    return () => {
      cancelled = true;
      tts.stop();
    };
  }, [phase.kind, current, exerciseIdx, total, incrementCompleted]);

  // ── phase: finish ─ 완료 페이지로 즉시 이동 ──
  // 인-세션 완료 화면(축하 + "기록 남기기"/"그냥 닫기")은 제거.
  // 자연 완료든 마지막 건너뛰기든 finish 도달 직후 complete.tsx 가 자동 저장 + AI 피드백 처리.
  useEffect(() => {
    if (phase.kind !== 'finish') return;
    tts.stop();
    router.replace('/workout/complete');
  }, [phase.kind, router]);

  // ────────────────────────────────────────────────────────────
  // 렌더링
  // ────────────────────────────────────────────────────────────

  if (!routine || !current) {
    return <ThemedView style={styles.container} />;
  }

  const overallProgress = (exerciseIdx + exerciseFraction(phase, parsed)) / total;

  // phase.kind === 'finish' 도달 시점에 위의 useEffect 가 router.replace 로 이동.
  // 렌더 시점에 잠시 빈 화면이 보일 수 있으나 곧장 complete.tsx 로 교체됨.
  if (phase.kind === 'finish') {
    return <ThemedView style={styles.container} />;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}>
            <Icon icon={X} size={24} color={Palette.gray500} />
          </Pressable>
          <ThemedText type="smallBold">
            홈트 진행 중
          </ThemedText>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {exerciseIdx + 1} / {total}
          </ThemedText>
        </View>

        {/* <View style={[styles.progressTrack, { backgroundColor: Palette.bgMuted }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.max(0, Math.min(1, overallProgress)) * 100}%`,
                backgroundColor: Palette.primary,
              },
            ]}
          />
        </View> */}

        <ScrollView
          style={styles.mainScroll}
          contentContainerStyle={styles.main}
          showsVerticalScrollIndicator={false}>
          {/* 상단 헤더 — 운동명(25px) + 디테일(small/gray) 베이스라인 정렬. */}
          <View style={styles.headerInfo}>
            <View style={styles.headerTitleRow}>
              <ThemedText type="title" style={{ fontSize: 25, lineHeight: 31 }}>
                {current.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                ({current.detail})
              </ThemedText>
            </View>
          </View>

          {/* 운동명 바로 아래에 영상 (60% 폭, 가운데 정렬). */}
          {current.videoUrl ? (
            <Pressable
              onPress={handlePauseToggle}
              style={({ pressed }) => [
                styles.topCardVideo,
                { backgroundColor: Palette.bgMuted, opacity: pressed ? 0.85 : 1 },
              ]}>
              <VideoView
                player={player}
                style={styles.video}
                contentFit="cover"
                nativeControls={false}
              />
            </Pressable>
          ) : null}

          {/* 영상 아래 타이머/세트/회차 — 가운데 정렬. */}
          <View style={styles.phaseBlock}>
            <PhaseDisplay phase={phase} parsed={parsed} current={current} />
          </View>

          {/* 오디오 코칭 카드 — 진행바 + 재생/정지 버튼 + AI 말풍선. */}
          <View
            style={[
              styles.audioCard,
              { borderColor: Palette.lineDefault },
              Elevation.level1,
            ]}>
            <View style={styles.audioHeaderRow}>
              <View style={styles.audioBadge}>
                <Headphones color={Palette.primary} size={16} />
                <ThemedText type="smallBold" style={{ color: Palette.primary }}>
                  {isPaused ? '오디오 코칭 정지됨' : '오디오 코칭 재생 중'}
                </ThemedText>
              </View>
              <Pressable
                onPress={handlePauseToggle}
                style={({ pressed }) => [
                  styles.audioToggle,
                  { backgroundColor: Palette.primaryLight, opacity: pressed ? 0.7 : 1 },
                ]}>
                {isPaused ? (
                  <Play color={Palette.primary} size={18} fill={Palette.primary} />
                ) : (
                  <Pause color={Palette.primary} size={18} fill={Palette.primary} />
                )}
              </Pressable>
            </View>

            {/* 진행 바 — 위: 오디오 파형 / 아래: 얇은 진행바. 둘 다 phaseProgress 와 동기.
                intro/caution 은 introProgress, rep 는 (rep-1 까지의 누적) + repProgress 보간. */}
            {(() => {
              const isIntroLike = phase.kind === 'intro' || phase.kind === 'caution';
              let rawFraction: number;
              if (isIntroLike) {
                rawFraction = introProgress;
              } else if (phase.kind === 'rep' && parsed?.type === 'reps') {
                const totalReps = parsed.reps * parsed.sets;
                const base = (phase.set - 1) * parsed.reps + (phase.rep - 1);
                rawFraction = (base + repProgress) / totalReps;
              } else {
                rawFraction = exerciseFraction(phase, parsed);
              }
              const fraction = Math.min(1, Math.max(0, rawFraction));
              const labels = audioProgressLabels(phase, parsed);
              const playedCount = Math.round(fraction * WAVEFORM_BAR_COUNT);
              const widthPct = `${fraction * 100}%` as const;
              return (
                <View style={styles.audioProgressBlock}>
                  <View style={styles.audioProgressRow}>
                    <ThemedText type="label" themeColor="textSecondary">
                      {labels.left}
                    </ThemedText>
                    <View style={styles.waveformRow}>
                      {WAVEFORM_BARS.map((h, i) => (
                        <View
                          key={i}
                          style={[
                            styles.waveformBar,
                            {
                              height: h,
                              backgroundColor:
                                i < playedCount ? Palette.primary : Palette.bgMuted,
                            },
                          ]}
                        />
                      ))}
                    </View>
                    <ThemedText type="label" themeColor="textSecondary">
                      {labels.right}
                    </ThemedText>
                  </View>
                  {/* 파형 아래 얇은 진행바 — 일단 화면에서 숨김. 필요해지면 주석 해제.
                  <View style={[styles.audioProgressLineTrack, { backgroundColor: Palette.bgMuted }]}>
                    <View
                      style={[
                        styles.audioProgressFill,
                        { backgroundColor: Palette.primary, width: widthPct },
                      ]}
                    />
                  </View>
                  */}
                </View>
              );
            })()}

            {/* AI 아바타 + 말풍선 — 항상 표시. description + (caution 있으면 한 줄 띄고 '주의' 칩). */}
            <View style={styles.bubbleRow}>
              <View style={[styles.bubbleAvatar, { backgroundColor: Palette.primaryLight }]}>
                <ThemedText type="label" style={{ color: Palette.primary }}>
                  AI
                </ThemedText>
              </View>
              <View style={[styles.coachBubble, { backgroundColor: Palette.bgMuted }]}>
                {/* intro: 설명만 / caution: 주의만 / 그 외: 둘 다 (한 줄 띄고). */}
                {phase.kind !== 'caution' ? (
                  <ThemedText type="default">{current.description}</ThemedText>
                ) : null}
                {phase.kind !== 'caution' &&
                phase.kind !== 'intro' &&
                current.caution?.trim() ? (
                  <View style={styles.bubbleGap} />
                ) : null}
                {phase.kind !== 'intro' && current.caution?.trim() ? (
                  <View style={styles.cautionRow}>
                    <View
                      style={[
                        styles.cautionChip,
                        { backgroundColor: `${Palette.warning}33` },
                      ]}>
                      <ThemedText
                        type="label"
                        style={{ color: Palette.warning }}>
                        주의
                      </ThemedText>
                    </View>
                    <ThemedText type="default" style={styles.cautionText}>
                      {current.caution}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.controls}>
          {/* 재생/일시정지는 오디오 카드의 동그란 버튼으로 통합됨 — 이 자리는 보조 컨트롤만. */}

          <View style={styles.subRow}>
            <Pressable
              onPress={handleReplay}
              style={({ pressed }) => [
                styles.subBtn,
                { borderColor: Palette.lineDefault, opacity: pressed ? 0.6 : 1 },
              ]}>
              <ThemedText type="smallBold">
                다시 듣기
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={handleSkip}
              style={({ pressed }) => [
                styles.subBtn,
                { borderColor: Palette.lineDefault, opacity: pressed ? 0.6 : 1 },
              ]}>
              <ThemedText type="smallBold">
                건너뛰기
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => {
                const idx = RATE_OPTIONS.findIndex((r) => r === rate);
                const nextIdx = (idx + 1) % RATE_OPTIONS.length;
                setRate(RATE_OPTIONS[nextIdx]);
              }}
              style={({ pressed }) => [
                styles.subBtn,
                { borderColor: Palette.lineDefault, opacity: pressed ? 0.6 : 1 },
              ]}>
              <ThemedText type="smallBold">
                속도 {rate}x
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {/* 영상이 있을 때만 하단에 AI 생성 영상 안내 (12px / 연한 회색). */}
        {current.videoUrl ? (
          <ThemedText style={styles.aiVideoNote}>
            * AI로 생성된 영상입니다
          </ThemedText>
        ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

// ────────────────────────────────────────────────────────────
// phase별 메인 표시 영역
// ────────────────────────────────────────────────────────────

function PhaseDisplay({
  phase,
  parsed,
  current,
}: {
  phase: Phase;
  parsed: ParsedDetail | null;
  current: { name: string; description: string; caution: string };
}) {
  // intro/caution 단계에서는 상단 카드에 아무 라벨도 표시하지 않음 (텍스트는 오디오 말풍선으로 이동).
  if (phase.kind === 'intro' || phase.kind === 'caution') {
    return null;
  }

  // "[진행중] {label}" 라벨 — set-start/rep/rest/time 진행 단계에 공통 사용.
  function PhaseLabel({ text }: { text: string }) {
    return (
      <View style={styles.phaseLabelRow}>
        <View style={[styles.progressChip, { backgroundColor: Palette.primaryLight }]}>
          <ThemedText type="label" style={{ color: Palette.primary }}>
            진행중
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {text}
        </ThemedText>
      </View>
    );
  }

  if (phase.kind === 'exercise-finish') {
    return (
      <>
        <ThemedText type="small" themeColor="textSecondary">
          운동 완료
        </ThemedText>
        <ThemedText type="display" style={styles.center}>
          {current.name}
        </ThemedText>
      </>
    );
  }

  if (phase.kind === 'set-start') {
    return (
      <>
        <PhaseLabel text="세트 시작" />
        <ThemedText type="display" style={styles.center}>
          {phase.set}세트
        </ThemedText>
      </>
    );
  }

  if (phase.kind === 'rep' && parsed?.type === 'reps') {
    return (
      <>
        <PhaseLabel text={`${phase.set}세트 / ${parsed.sets}세트`} />
        <ThemedText type="display" style={styles.center}>
          {phase.rep} / {parsed.reps}회
        </ThemedText>
      </>
    );
  }

  if (phase.kind === 'rest') {
    return (
      <>
        <PhaseLabel text="휴식" />
        <ThemedText type="display" style={styles.center}>
          {phase.secondsLeft}초
        </ThemedText>
      </>
    );
  }

  if (phase.kind === 'time') {
    return (
      <>
        <PhaseLabel text="남은 시간" />
        <ThemedText type="display" style={styles.center}>
          {formatTime(phase.secondsLeft)}
        </ThemedText>
      </>
    );
  }

  return null;
}

// ────────────────────────────────────────────────────────────
// 스타일
// ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: ScreenPadding,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    width: '100%',
    marginTop: Spacing.sm,
  },
  progressFill: {
    height: '100%',
  },
  mainScroll: {
    flex: 1,
  },
  main: {
    flexGrow: 1,
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.lg,
    // 웹 하단 탭(고정 80px) 또는 iOS 홈 인디케이터에 가려지지 않도록 충분히 띄움.
    paddingBottom: BottomTabInset + Spacing.lg,
  },
  center: { textAlign: 'center' },
  // 상단 헤더 — 운동명 + (디테일) 베이스라인 정렬.
  headerInfo: {
    gap: Spacing.xs,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  // 오디오 코칭 카드 — 진행바 + 재생 버튼 + AI 말풍선.
  audioCard: {
    width: '100%',
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  audioHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  audioBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  audioToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 파형 + 얇은 진행바를 묶는 컨테이너.
  audioProgressBlock: {
    gap: Spacing.xs,
  },
  audioProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  audioProgressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  // 파형 아래 가로 진행바 — column 컨테이너 안에서 부모 가로폭에 stretch.
  audioProgressLineTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  audioProgressFill: {
    height: '100%',
  },
  // 오디오 파형 — 가운데 정렬된 세로 막대 N개. 막대마다 height 절대 픽셀.
  waveformRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: WAVEFORM_MAX_HEIGHT,
  },
  waveformBar: {
    width: 2,
    borderRadius: 1,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  bubbleAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachBubble: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopLeftRadius: Radius.small,
    borderTopRightRadius: Radius.card,
    borderBottomRightRadius: Radius.card,
    borderBottomLeftRadius: Radius.card,
  },
  // description 과 caution 사이 한 칸 여백.
  bubbleGap: { height: Spacing.sm },
  // 주의 칩 + caution 텍스트를 한 줄에 정렬.
  cautionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  cautionChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.small,
  },
  cautionText: { flex: 1 },
  // 상단 카드 — 상: 타이머/세트, 하: 영상 (세로 적층).
  topCard: {
    width: '100%',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  topCardLeft: {
    width: '100%',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  // 영상 아래 타이머/세트 — 가운데 정렬 블록.
  phaseBlock: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  // "[진행중] {label}" 한 줄 정렬.
  phaseLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  progressChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.small,
  },
  // 영상 — 60% 폭, 4:5 세로 비율, 가운데 정렬.
  topCardVideo: {
    width: '60%',
    alignSelf: 'center',
    aspectRatio: 856 / 1072,
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  video: { width: '100%', height: '100%' },
  aiVideoNote: {
    fontSize: 12,
    lineHeight: 16,
    color: Palette.gray400,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  phaseCard: {
    width: '100%',
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 160,
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.small,
  },
  cautionCard: {
    width: '100%',
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.xs,
  },
  controls: { gap: Spacing.sm, width: '100%' },
  primaryCta: {
    height: 52,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subRow: { flexDirection: 'row', gap: Spacing.sm },
  subBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radius.button,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  finishContainer: { flex: 1 },
  finishContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  finishSub: {
    textAlign: 'center',
  },
  primaryButton: {
    height: 52,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.primary,
    marginBottom: Spacing.sm,
  },
  primaryButtonText: {
    color: Palette.white,
  },
  textButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textButtonText: {
    color: Palette.gray400,
  },
});
