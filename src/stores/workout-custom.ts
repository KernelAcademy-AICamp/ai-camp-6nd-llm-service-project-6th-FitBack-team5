import { create } from 'zustand';

import type {
  BodyPart,
  CatalogItem,
  DraftItem,
  ExerciseType,
} from '@/features/workout-custom/types';

interface CustomWorkoutDraftState {
  /** 현재 그리드 필터 (화면 표시용. 선택 누적과는 독립.) */
  bodyPart: BodyPart;
  exerciseType: ExerciseType;
  /** 누적 선택 — 부위/유형 필터를 바꿔도 유지된다. */
  selected: CatalogItem[];
  items: DraftItem[] | null;
  memo: string;
  /** 진행 중 세션 id (3번 화면에서 insert 후 세팅, 5번 화면 완료 시 null) */
  sessionId: string | null;

  setBodyPart: (v: BodyPart) => void;
  setExerciseType: (v: ExerciseType) => void;
  /** 선택 토글 — id로 같은 종목 있으면 제거, 없으면 추가. */
  toggleSelected: (item: CatalogItem) => void;
  removeSelected: (id: string) => void;
  /** 3번 화면 진입 시 호출: 누적 선택으로 60분 균등 배분 items 생성 */
  buildItems: (totalMin?: number) => void;
  patchItem: (catalog_id: string, patch: Partial<DraftItem>) => void;
  setMemo: (v: string) => void;
  setSessionId: (id: string | null) => void;
  hydrateFromSession: (input: {
    sessionId: string;
    bodyPart: BodyPart;
    exerciseType: ExerciseType;
    items: DraftItem[];
    memo: string;
  }) => void;
  reset: () => void;
}

const DEFAULTS = {
  bodyPart: '하체' as BodyPart,
  exerciseType: '근력' as ExerciseType,
  selected: [] as CatalogItem[],
  items: null as DraftItem[] | null,
  memo: '',
  sessionId: null as string | null,
};

export const useCustomWorkoutDraft = create<CustomWorkoutDraftState>((set, get) => ({
  ...DEFAULTS,

  // 필터 변경은 누적 선택을 건드리지 않는다(교차 부위/유형 선택 지원).
  setBodyPart: (v) => set({ bodyPart: v }),
  setExerciseType: (v) => set({ exerciseType: v }),

  toggleSelected: (item) => {
    const cur = get().selected;
    const has = cur.some((x) => x.id === item.id);
    set({
      selected: has ? cur.filter((x) => x.id !== item.id) : [...cur, item],
      items: null,
    });
  },

  removeSelected: (id) => {
    set({
      selected: get().selected.filter((x) => x.id !== id),
      items: null,
    });
  },

  buildItems: (totalMin = 60) => {
    const sel = get().selected;
    if (sel.length === 0) {
      set({ items: [] });
      return;
    }
    const per = Math.floor(totalMin / sel.length);
    const items: DraftItem[] = sel.map((c) => ({
      catalog_id: c.id,
      name: c.name,
      body_part: c.body_part,
      exercise_type: c.exercise_type,
      unit: c.unit,
      duration_min: per,
      sets: c.default_sets,
      reps: c.default_reps,
      done: false,
      image_path: c.image_path,
    }));
    set({ items });
  },

  patchItem: (catalog_id, patch) => {
    const items = get().items;
    if (!items) return;
    set({
      items: items.map((it) => (it.catalog_id === catalog_id ? { ...it, ...patch } : it)),
    });
  },

  setMemo: (v) => set({ memo: v }),
  setSessionId: (id) => set({ sessionId: id }),

  hydrateFromSession: ({ sessionId, bodyPart, exerciseType, items, memo }) => {
    set({
      sessionId,
      bodyPart,
      exerciseType,
      items,
      memo,
      // 누적 선택을 items로부터 역추론(필요 최소 필드만 넣어 토글이 자연스럽게 동작).
      selected: items.map((it) => ({
        id: it.catalog_id,
        name: it.name,
        body_part: it.body_part,
        exercise_type: it.exercise_type,
        unit: it.unit,
        default_sets: it.sets,
        default_reps: it.reps,
        image_path: it.image_path,
        image_url: null,
        sort_order: 0,
      })),
    });
  },

  reset: () => set({ ...DEFAULTS }),
}));
