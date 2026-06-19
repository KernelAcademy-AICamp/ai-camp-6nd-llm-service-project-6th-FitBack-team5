import AsyncStorage from '@react-native-async-storage/async-storage';

// 알림 설정 — 계정+기기 로컬 저장(AsyncStorage). 실제 푸시는 모바일 SDK 단계에서 연결.
export interface NotifySettings {
  enabled: boolean; // 알람 수신
  night: boolean; // 야간 알람 수신
  asked: boolean; // 최초 권한 안내 노출 여부
}

const DEFAULTS: NotifySettings = { enabled: false, night: false, asked: false };
const key = (uid: string) => `fitback:notify:${uid}`;

export async function getNotifySettings(uid: string): Promise<NotifySettings> {
  try {
    const raw = await AsyncStorage.getItem(key(uid));
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<NotifySettings>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export async function setNotifySettings(uid: string, patch: Partial<NotifySettings>): Promise<NotifySettings> {
  const cur = await getNotifySettings(uid);
  const next = { ...cur, ...patch };
  try {
    await AsyncStorage.setItem(key(uid), JSON.stringify(next));
  } catch {
    // 저장 실패 무시
  }
  return next;
}
