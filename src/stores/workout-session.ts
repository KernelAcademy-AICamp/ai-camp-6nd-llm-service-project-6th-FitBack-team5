import { create } from 'zustand';

import type { Routine } from '@/features/workout/useGenerateRoutine';

interface WorkoutSessionState {
  routine: Routine | null;
  setRoutine: (routine: Routine) => void;
  /** 자연 완료된(=건너뛰지 않은) 운동 수. complete.tsx 에서 '완료/미완료' 산정·completion_status 결정에 사용. */
  completedCount: number;
  incrementCompleted: () => void;
  /** 완료 개수 직접 설정 — 챗봇 추천 루틴을 '완료 기록'으로 미리 채울 때 사용. */
  setCompletedCount: (n: number) => void;
  /** session 진입 시각(ms). complete.tsx 에서 MM:SS 경과시간 계산에 사용. */
  sessionStartedAt: number | null;
  startSession: () => void;
  clear: () => void;
}

export const useWorkoutSession = create<WorkoutSessionState>((set) => ({
  routine: null,
  setRoutine: (routine) => set({ routine }),
  completedCount: 0,
  incrementCompleted: () =>
    set((s) => ({ completedCount: s.completedCount + 1 })),
  setCompletedCount: (n) => set({ completedCount: n }),
  sessionStartedAt: null,
  startSession: () => set({ sessionStartedAt: Date.now(), completedCount: 0 }),
  clear: () => set({ routine: null, completedCount: 0, sessionStartedAt: null }),
}));
