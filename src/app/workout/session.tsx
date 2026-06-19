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
  }, [phase.kind, isPaused, current, exerciseIdx, total, incrementCompleted]);

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
            오늘의 운동 진행 중
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

            {/* 진행 바 — 시각 표시용 데코레이션. 실제 오디오 동기는 추후 연결. */}
            <View style={styles.audioProgressRow}>
              <ThemedText type="label" themeColor="textSecondary">
                00:00
              </ThemedText>
              <View style={[styles.audioProgressTrack, { backgroundColor: Palette.bgMuted }]}>
                <View
                  style={[
                    styles.audioProgressFill,
                    { backgroundColor: Palette.primary, width: '40%' },
                  ]}
                />
              </View>
              <ThemedText type="label" themeColor="textSecondary">
                {formatTime((parsed?.type === 'time' ? parsed.totalSeconds : 0))}
              </ThemedText>
            </View>

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
    paddingVertical: Spacing.lg,
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
  audioProgressFill: {
    height: '100%',
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
