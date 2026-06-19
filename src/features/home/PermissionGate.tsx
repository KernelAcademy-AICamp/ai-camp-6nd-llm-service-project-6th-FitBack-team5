import AsyncStorage from '@react-native-async-storage/async-storage';
import { Bell, MapPin } from 'lucide-react-native';
import { useEffect, useState } from 'react';

import { getNotifySettings, setNotifySettings } from '@/features/home/notifySettings';
import { PermissionModal } from '@/features/home/PermissionModal';
import { getPosition } from '@/features/membership/location';

const locKey = (uid: string) => `fitback:locperm:${uid}`;

/**
 * 최초 진입 권한 안내 — 위치 → (닫히면) 알림 순서로 연쇄.
 * 계정+기기 단위로 1회만(위치=허용 시 기억, 알림=안내 1회). 실제 푸시는 SDK 단계에서 연결.
 */
export function PermissionGate({ userId }: { userId: string }) {
  const [phase, setPhase] = useState<'idle' | 'location' | 'notify'>('idle');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loc = await AsyncStorage.getItem(locKey(userId));
      const notify = await getNotifySettings(userId);
      if (cancelled) return;
      if (loc !== 'granted') setPhase('location');
      else if (!notify.asked) setPhase('notify');
      else setPhase('idle');
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function afterLocation() {
    const notify = await getNotifySettings(userId);
    setPhase(notify.asked ? 'idle' : 'notify');
  }

  async function locationAllow() {
    setBusy(true);
    try {
      await getPosition(); // 브라우저/OS 위치 권한 프롬프트
    } catch {
      // 거부/실패해도 안내는 끝낸다
    }
    await AsyncStorage.setItem(locKey(userId), 'granted');
    setBusy(false);
    afterLocation();
  }

  function locationLater() {
    // 미허용은 기억하지 않음(다음에 다시 안내). 단, 이번엔 알림 안내로 넘어감.
    afterLocation();
  }

  async function notifyAllow() {
    setBusy(true);
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        await window.Notification.requestPermission(); // 웹 알림 권한(있을 때)
      }
    } catch {
      // 무시 — 모바일 SDK 단계에서 expo-notifications로 대체
    }
    await setNotifySettings(userId, { enabled: true, asked: true });
    setBusy(false);
    setPhase('idle');
  }

  async function notifyLater() {
    await setNotifySettings(userId, { asked: true });
    setPhase('idle');
  }

  return (
    <>
      <PermissionModal
        visible={phase === 'location'}
        icon={MapPin}
        busy={busy}
        title="위치 권한이 필요해요"
        text="센터 도착을 확인해 검증 체크인을 기록하려면 위치 접근이 필요해요. 위치는 체크인에만 쓰여요."
        onAllow={locationAllow}
        onLater={locationLater}
      />
      <PermissionModal
        visible={phase === 'notify'}
        icon={Bell}
        busy={busy}
        title="알림을 받아볼까요?"
        text="운동 리마인드·회원권 만료 같은 꼭 필요한 소식만 보내드려요. 마이 > 알림 설정에서 언제든 바꿀 수 있어요."
        onAllow={notifyAllow}
        onLater={notifyLater}
      />
    </>
  );
}
