import { create } from 'zustand';

import type { Routine } from '@/features/workout/useGenerateRoutine';

interface WorkoutSessionState {
  routine: Routine | null;
  setRoutine: (routine: Routine) => void;
  completedCount: number;
  setCompletedCount: (n: number) => void;
  clear: () => void;
}

export const useWorkoutSession = create<WorkoutSessionState>((set) => ({
  routine: null,
  setRoutine: (routine) => set({ routine }),
  completedCount: 0,
  setCompletedCount: (n) => set({ completedCount: n }),
  clear: () => set({ routine: null, completedCount: 0 }),
}));
