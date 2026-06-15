import { HelpCircle, X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui';
import { Palette, Radius, Spacing } from '@/constants/theme';

/** 지표 옆 (?) 인라인 도움말 버튼 + 설명 모달. (FitBack 모달 배치 기획안 §2 개념 설명) */
export function HelpButton({
  title,
  paragraphs,
  size = 14,
  color = Palette.gray300,
}: {
  title: string;
  paragraphs: string[];
  size?: number;
  color?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityLabel={`${title} 도움말`}>
        <Icon icon={HelpCircle} size={size} color={color} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={styles.card}>
            <View style={styles.head}>
              <ThemedText type="h2">{title}</ThemedText>
              <Pressable onPress={() => setOpen(false)} hitSlop={8} accessibilityLabel="닫기">
                <Icon icon={X} size={20} color={Palette.gray500} />
              </Pressable>
            </View>
            {paragraphs.map((p, i) => (
              <ThemedText key={i} type="body" themeColor="textSecondary">
                {p}
              </ThemedText>
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  card: {
    backgroundColor: Palette.bgSurface,
    borderRadius: Radius.modal,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
