import AsyncStorage from '@react-native-async-storage/async-storage';
import { MapPin } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui';
import { Palette, Radius, ScreenPadding, Spacing } from '@/constants/theme';
import { getPosition } from '@/features/membership/location';

// 계정+기기 단위로 1회만 노출. 허용하면 기억해 다시 띄우지 않음.
const storageKey = (uid: string) => `fitback:locperm:${uid}`;

/**
 * 최초 진입 위치 권한 안내(웹 1차). '허용' 시 브라우저/OS 위치 프롬프트를 띄우고 기억한다.
 * 블루투스 등 센서 권한은 SDK(2차) 단계에서 확장한다.
 */
export function LocationPermissionModal({ userId }: { userId: string }) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(storageKey(userId)).then((v) => {
      if (!cancelled && v !== 'granted') setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function allow() {
    setBusy(true);
    try {
      await getPosition(); // 브라우저/OS 위치 권한 프롬프트
    } catch {
      // 권한 거부/실패해도 1회 안내는 끝낸다
    }
    await AsyncStorage.setItem(storageKey(userId), 'granted');
    setBusy(false);
    setVisible(false);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Icon icon={MapPin} size={24} color={Palette.primary} />
          </View>
          <ThemedText type="h2">위치 권한이 필요해요</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary" style={styles.text}>
            센터 도착을 확인해 검증 체크인을 기록하려면 위치 접근이 필요해요. 위치는 체크인에만 쓰여요.
          </ThemedText>
          <Pressable onPress={allow} disabled={busy} style={[styles.primary, busy && styles.primaryOff]}>
            <ThemedText type="subtitle" style={{ color: Palette.white }}>
              {busy ? '확인 중…' : '허용'}
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => setVisible(false)} style={styles.ghost} hitSlop={6}>
            <ThemedText type="captionBold" themeColor="textSecondary">
              나중에
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: ScreenPadding,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Palette.bgSurface,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { marginBottom: Spacing.sm },
  primary: {
    backgroundColor: Palette.primary,
    borderRadius: Radius.button,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  primaryOff: { backgroundColor: Palette.gray300 },
  ghost: { alignItems: 'center', paddingVertical: Spacing.sm },
});
