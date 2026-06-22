import { usePathname } from 'expo-router';
import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Elevation, Palette, Spacing } from '@/constants/theme';
import { CoachChat } from '@/features/coach/CoachChat';

const CHARACTER = require('../../assets/images/Chat.png') as number;

export function CoachFab() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname === '/') return null;

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel="AI 코치 열기">
        <Image source={CHARACTER} style={styles.fabImg} resizeMode="contain" />
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}>
        <ThemedView style={styles.modalRoot}>
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            <CoachChat onClose={() => setOpen(false)} />
          </SafeAreaView>
        </ThemedView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: BottomTabInset + Spacing.lg,
    right: Spacing.lg,
    zIndex: 100,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Elevation.level2,
  },
  fabImg: {
    width: 56,
    height: 56,
  },
  modalRoot: { flex: 1, backgroundColor: Palette.bgBase },
  modalSafe: { flex: 1 },
});
