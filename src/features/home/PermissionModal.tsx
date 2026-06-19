import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui';
import { Palette, Radius, ScreenPadding, Spacing } from '@/constants/theme';

/** 공용 권한 안내 모달(위치·알림 등). 실제 권한 요청은 호출부의 onAllow에서 수행. */
export function PermissionModal({
  visible,
  icon,
  title,
  text,
  busy,
  allowLabel = '허용',
  laterLabel = '나중에',
  onAllow,
  onLater,
}: {
  visible: boolean;
  icon: React.ComponentProps<typeof Icon>['icon'];
  title: string;
  text: string;
  busy?: boolean;
  allowLabel?: string;
  laterLabel?: string;
  onAllow: () => void;
  onLater: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onLater}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Icon icon={icon} size={24} color={Palette.primary} />
          </View>
          <ThemedText type="h2">{title}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary" style={styles.text}>
            {text}
          </ThemedText>
          <Pressable onPress={onAllow} disabled={busy} style={[styles.primary, busy && styles.primaryOff]}>
            <ThemedText type="subtitle" style={{ color: Palette.white }}>
              {busy ? '확인 중…' : allowLabel}
            </ThemedText>
          </Pressable>
          <Pressable onPress={onLater} style={styles.ghost} hitSlop={6}>
            <ThemedText type="captionBold" themeColor="textSecondary">
              {laterLabel}
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
