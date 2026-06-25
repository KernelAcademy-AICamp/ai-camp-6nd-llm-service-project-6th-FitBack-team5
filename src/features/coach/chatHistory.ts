// 코치 채팅 히스토리 — 로컬(AsyncStorage) 영속화. 기기 한정, 사용자별 키.
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StoredMessage {
  role: 'coach' | 'user';
  text: string;
  response?: unknown; // AppResponse (직렬화 가능)
  wcRoutineResult?: unknown; // Routine
}

export interface ChatSession {
  id: string;
  title: string;
  updatedAt: number; // epoch ms
  messages: StoredMessage[];
}

const KEY = (userKey: string) => `coach_chat_sessions_v1_${userKey}`;
const MAX_SESSIONS = 20; // 기기 저장 상한

/** 사용자의 지난 대화 목록 (최신순). */
export async function loadSessions(userKey: string): Promise<ChatSession[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY(userKey));
    if (!raw) return [];
    const arr = JSON.parse(raw) as ChatSession[];
    return Array.isArray(arr) ? arr.sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch {
    return [];
  }
}

/** 세션 upsert (id 동일하면 갱신), 최신순 정렬 + 상한 적용. */
export async function saveSession(userKey: string, session: ChatSession): Promise<void> {
  try {
    const list = await loadSessions(userKey);
    const next = [session, ...list.filter((s) => s.id !== session.id)]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_SESSIONS);
    await AsyncStorage.setItem(KEY(userKey), JSON.stringify(next));
  } catch {
    /* 저장 실패는 조용히 무시(히스토리는 보조 기능) */
  }
}

/** 세션 삭제. */
export async function deleteSession(userKey: string, id: string): Promise<void> {
  try {
    const list = await loadSessions(userKey);
    await AsyncStorage.setItem(KEY(userKey), JSON.stringify(list.filter((s) => s.id !== id)));
  } catch {
    /* ignore */
  }
}
