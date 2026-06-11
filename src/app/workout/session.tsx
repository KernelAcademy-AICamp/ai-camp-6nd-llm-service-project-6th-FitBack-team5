import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  Elevation,
  MaxContentWidth,
  Radius,
  ScreenPaddingX,
  Spacing,
} from '@/constants/theme';
import { koreanCount } from '@/features/workout/rep-scripts';
import { useTheme } from '@/hooks/use-theme';
import { playCue, tts } from '@/lib/tts';
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
  const time = detail.match(/(\d+)\s*분/);
  if (time) return { type: 'time', totalSeconds: parseInt(time[1], 10) * 60 };
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

function nextPreviewText(args: {
  phase: Phase;
  parsed: ParsedDetail | null;
  nextExerciseName: string | null;
}): string | null {
  const { phase, parsed, nextExerciseName } = args;
  // 운동이 다 끝났을 때 vs 다음 운동이 있을 때 — 두 케이스 모두 자체적으로 "다음:" prefix 미포함
  const afterAll = nextExerciseName ? `다음 운동: ${nextExerciseName}` : '오늘 운동 완료';

  switch (phase.kind) {
    case 'intro':
    case 'caution':
      return parsed?.type === 'time' ? '다음: 운동 시작' : '다음: 1세트 시작';
    case 'set-start':
      return `다음: ${phase.set}세트 진행`;
    case 'rep':
      if (parsed?.type !== 'reps') return null;
      if (phase.rep < parsed.reps) return null;
      return phase.set < parsed.sets
        ? `다음: ${REST_SECONDS}초 휴식 → ${phase.set + 1}세트`
        : afterAll;
    case 'rest':
      return `다음: ${phase.set + 1}세트 시작`;
    case 'time':
      return afterAll;
    case 'exercise-finish':
      return afterAll;
    case 'finish':
      return null;
  }
}

const RATE_OPTIONS = [1.0, 1.25, 1.5] as const;

/** 시간 기반 마지막 5초 카운트다운 — 한자어 (영화 카운트다운 톤) */
const SINO_COUNTDOWN_5 = ['오', '사', '삼', '이', '일'] as const;

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

// ────────────────────────────────────────────────────────────
// 화면
// ────────────────────────────────────────────────────────────

export default function SessionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const routine = useWorkoutSession((s) => s.routine);
  const clearRoutine = useWorkoutSession((s) => s.clear);
  const setCompletedCount = useWorkoutSession((s) => s.setCompletedCount);

  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' });
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRate] = useState(1.0);

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
  const parsed = current ? parseDetail(current.detail) : null;

  // 운동 종료 멘트 phase로 우회 (exercise-finish → 다음 운동의 intro 또는 finish)
  function advanceExercise() {
    setPhase({ kind: 'exercise-finish' });
  }

  // 컨트롤
  function handleReplay() {
    tts.stop();
    nextCueIdxRef.current = 0;
    halfwayPlayedRef.current = false;
    setPhase({ kind: 'intro' });
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
      if (next) tts.stop();
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

  // ── phase: intro ─ "{name}을(를) 시작할게요. {description}" 발화 ──
  useEffect(() => {
    if (!current || phase.kind !== 'intro' || isPaused) return;
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
  }, [current, phase.kind, isPaused, parsed]);

  // ── phase: caution ─ 주의사항 별도 발화 ──
  useEffect(() => {
    if (!current || phase.kind !== 'caution' || isPaused) return;
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
  }, [current, phase.kind, isPaused, parsed]);

  // ── phase: set-start ─ "N세트를 시작합니다. 총 M회예요. 준비, 시작." ──
  useEffect(() => {
    if (phase.kind !== 'set-start' || isPaused) return;
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
  }, [phase, isPaused, parsed]);

  // ── phase: rep ─ repScripts[rep-1] 발화 + 다음 rep / rest / 다음 운동 ──
  // repScripts 는 useGenerateRoutine 에서 generateRepScripts() 로 펼친 완성 멘트 배열.
  useEffect(() => {
    if (phase.kind !== 'rep' || isPaused || !parsed || parsed.type !== 'reps' || !current) return;
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
  }, [phase, isPaused, parsed, current]);

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
    if (phase.kind !== 'time' || isPaused || !current) return;
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
  }, [phase.kind, isPaused, current]);

  // ── phase: time (폴백) ─ 기존 routine에 timeScripts 없을 때 2/3 격려만 ──
  useEffect(() => {
    if (phase.kind !== 'time' || isPaused || !current) return;
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
  }, [phase, isPaused, current]);

  // ── phase: time ─ 마지막 5초 한자어 카운트 + 종료 ──
  useEffect(() => {
    if (phase.kind !== 'time' || isPaused) return;
    const { secondsLeft } = phase;

    if (secondsLeft >= 1 && secondsLeft <= 5) {
      tts.stop(); // 진행 중인 cue 끊고 카운트로 전환
      const text = SINO_COUNTDOWN_5[5 - secondsLeft];
      playCue({ rate: rateRef.current, text });
    } else if (secondsLeft === 0) {
      advanceExercise();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isPaused]);

  // ── phase: exercise-finish ─ "{name}을 모두 완료했어요" → 다음 운동의 intro 또는 finish ──
  useEffect(() => {
    if (phase.kind !== 'exercise-finish' || isPaused || !current) return;
    let cancelled = false;
    playCue({ rate: rateRef.current,
      text: `${current.name}을 모두 완료했어요.`,
      onDone: () => {
        if (cancelled) return;
        if (exerciseIdx < total - 1) {
          setExerciseIdx((i) => i + 1);
          setPhase({ kind: 'intro' });
        } else {
          setCompletedCount(exerciseIdx + 1);
          setPhase({ kind: 'finish' });
        }
      },
    });
    return () => {
      cancelled = true;
      tts.stop();
    };
  }, [phase.kind, isPaused, current, exerciseIdx, total]);

  // ── phase: finish ─ 전체 완료 멘트 ──
  useEffect(() => {
    if (phase.kind !== 'finish') return;
    playCue({ rate: rateRef.current, text: '오늘 운동을 모두 마쳤어요. 수고하셨어요.' });
  }, [phase.kind]);

  // ────────────────────────────────────────────────────────────
  // 렌더링
  // ────────────────────────────────────────────────────────────

  if (!routine || !current) {
    return <ThemedView style={styles.container} />;
  }

  const nextExerciseName = routine.exercises[exerciseIdx + 1]?.name ?? null;
  const nextPreview = nextPreviewText({ phase, parsed, nextExerciseName });
  const overallProgress = (exerciseIdx + exerciseFraction(phase, parsed)) / total;

  if (phase.kind === 'finish') {
    return (
      <ThemedView style={styles.finishContainer}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.finishContent}>
            <ThemedText type="display">운동 완료! 🎉</ThemedText>
            <ThemedText style={styles.finishSub}>오늘도 한 칸 채웠어요.</ThemedText>
          </View>
          <Pressable
            onPress={() => {
              tts.stop();
              router.push('/workout/complete');
              // clearRoutine은 complete.tsx에서 처리
            }}
            style={styles.primaryButton}
          >
            <ThemedText style={styles.primaryButtonText}>기록 남기기</ThemedText>
          </Pressable>
          <Pressable onPress={handleClose} style={styles.textButton}>
            <ThemedText style={styles.textButtonText}>그냥 닫기</ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}>
            <ThemedText type="subtitle" themeColor="textBody">
              ✕
            </ThemedText>
          </Pressable>
          <ThemedText type="smallBold" themeColor="textBody">
            오늘의 운동 진행 중
          </ThemedText>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {exerciseIdx + 1} / {total}
          </ThemedText>
        </View>

        <View style={[styles.progressTrack, { backgroundColor: theme.backgroundMuted }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.max(0, Math.min(1, overallProgress)) * 100}%`,
                backgroundColor: theme.primary,
              },
            ]}
          />
        </View>

        <ScrollView
          style={styles.mainScroll}
          contentContainerStyle={styles.main}
          showsVerticalScrollIndicator={false}>
          <ThemedText type="title" style={styles.center}>
            {current.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {current.detail}
          </ThemedText>
          {phase.kind === 'rep' && parsed?.type === 'reps' ? (
            <ThemedText type="smallBold" themeColor="primary">
              {phase.set}세트 / {parsed.sets}세트  ·  현재 {phase.rep}/{parsed.reps}회
            </ThemedText>
          ) : null}

          <View
            style={[
              styles.phaseCard,
              { borderColor: theme.lineDefault },
              Elevation.level1,
            ]}>
            <PhaseDisplay phase={phase} parsed={parsed} current={current} />
            {isPaused ? (
              <ThemedText type="smallBold" themeColor="warning">
                일시정지
              </ThemedText>
            ) : null}
          </View>

          {current.caution?.trim() ? (
            <View
              style={[
                styles.cautionCard,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.warning,
                },
              ]}>
              <ThemedText type="smallBold" themeColor="warning">
                주의할 점
              </ThemedText>
              <ThemedText type="small" themeColor="textBody">
                {current.caution}
              </ThemedText>
            </View>
          ) : null}

          {nextPreview ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              {nextPreview}
            </ThemedText>
          ) : null}

          <View style={styles.controls}>
          <Pressable
            onPress={handlePauseToggle}
            style={({ pressed }) => [
              styles.primaryCta,
              { backgroundColor: pressed ? theme.primaryPressed : theme.primary },
            ]}>
            <ThemedText type="subtitle" style={{ color: '#FFFFFF' }}>
              {isPaused ? '재개' : '일시정지'}
            </ThemedText>
          </Pressable>

          <View style={styles.subRow}>
            <Pressable
              onPress={handleReplay}
              style={({ pressed }) => [
                styles.subBtn,
                { borderColor: theme.lineDefault, opacity: pressed ? 0.6 : 1 },
              ]}>
              <ThemedText type="smallBold" themeColor="textBody">
                다시 듣기
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={handleSkip}
              style={({ pressed }) => [
                styles.subBtn,
                { borderColor: theme.lineDefault, opacity: pressed ? 0.6 : 1 },
              ]}>
              <ThemedText type="smallBold" themeColor="textBody">
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
                { borderColor: theme.lineDefault, opacity: pressed ? 0.6 : 1 },
              ]}>
              <ThemedText type="smallBold" themeColor="textBody">
                속도 {rate}x
              </ThemedText>
            </Pressable>
          </View>
        </View>
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
  const theme = useTheme();

  if (phase.kind === 'intro') {
    return (
      <>
        <View style={[styles.badge, { backgroundColor: theme.primaryLight }]}>
          <ThemedText type="smallBold" style={{ color: theme.primary }}>
            오디오 코칭 재생 중
          </ThemedText>
        </View>
        <ThemedText type="default" themeColor="textBody" style={styles.center}>
          {current.description}
        </ThemedText>
      </>
    );
  }

  if (phase.kind === 'caution') {
    return (
      <>
        <View style={[styles.badge, { backgroundColor: theme.primaryLight }]}>
          <ThemedText type="smallBold" style={{ color: theme.warning }}>
            주의사항 안내 중
          </ThemedText>
        </View>
        <ThemedText type="default" themeColor="textBody" style={styles.center}>
          {current.caution}
        </ThemedText>
      </>
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
        <ThemedText type="small" themeColor="textSecondary">
          세트 시작
        </ThemedText>
        <ThemedText type="display" style={styles.center}>
          {phase.set}세트
        </ThemedText>
      </>
    );
  }

  if (phase.kind === 'rep' && parsed?.type === 'reps') {
    return (
      <>
        <ThemedText type="small" themeColor="textSecondary">
          {phase.set}세트 / {parsed.sets}세트
        </ThemedText>
        <ThemedText type="display" style={styles.center}>
          {phase.rep} / {parsed.reps}회
        </ThemedText>
      </>
    );
  }

  if (phase.kind === 'rest') {
    return (
      <>
        <ThemedText type="small" themeColor="textSecondary">
          휴식
        </ThemedText>
        <ThemedText type="display" style={styles.center}>
          {phase.secondsLeft}초
        </ThemedText>
      </>
    );
  }

  if (phase.kind === 'time') {
    return (
      <>
        <ThemedText type="small" themeColor="textSecondary">
          남은 시간
        </ThemedText>
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
    paddingHorizontal: ScreenPaddingX,
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
    paddingVertical: Spacing.lg,
  },
  center: { textAlign: 'center' },
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
    backgroundColor: '#6675FF',
    marginBottom: Spacing.sm,
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
  textButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textButtonText: {
    color: '#9CA3AF',
  },
});
