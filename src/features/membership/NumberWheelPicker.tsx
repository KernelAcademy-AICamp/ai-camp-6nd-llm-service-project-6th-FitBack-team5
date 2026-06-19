import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette, Radius, Spacing } from '@/constants/theme';

// 단일 값 숫자 휠 피커 — 키·체중 등 단위 숫자 선택용. DateWheelPicker와 동일 인터랙션.
const ITEM_HEIGHT = 44;
const VISIBLE = 5;
const PAD = ITEM_HEIGHT * Math.floor(VISIBLE / 2);

function rangeArr(start: number, end: number, step: number): number[] {
  const out: number[] = [];
  for (let i = start; i <= end; i += step) out.push(Math.round(i * 10) / 10);
  return out;
}

function WheelColumn({
  items,
  value,
  onChange,
  suffix,
}: {
  items: number[];
  value: number;
  onChange: (v: number) => void;
  suffix: string;
}) {
  const ref = useRef<ScrollView>(null);
  const index = Math.max(0, items.indexOf(value));

  useEffect(() => {
    const id = setTimeout(() => {
      ref.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false });
    }, 0);
    return () => clearTimeout(id);
  }, [index]);

  function commitFromOffset(y: number) {
    const i = Math.min(Math.max(Math.round(y / ITEM_HEIGHT), 0), items.length - 1);
    if (items[i] !== value) onChange(items[i]);
  }

  return (
    <View style={styles.column}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={(e) => commitFromOffset(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e) => commitFromOffset(e.nativeEvent.contentOffset.y)}
        contentContainerStyle={{ paddingVertical: PAD }}>
        {items.map((it) => {
          const selected = it === value;
          return (
            <Pressable
              key={it}
              style={styles.item}
              onPress={() => {
                onChange(it);
                ref.current?.scrollTo({ y: items.indexOf(it) * ITEM_HEIGHT, animated: true });
              }}>
              <ThemedText type={selected ? 'h2' : 'body'} style={selected ? styles.selectedText : styles.dim}>
                {it}
                {suffix}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.band} pointerEvents="none" />
    </View>
  );
}

export function NumberWheelPicker({
  visible,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  title = '선택',
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  title?: string;
  onConfirm: (v: number) => void;
  onCancel: () => void;
}) {
  const items = useMemo(() => rangeArr(min, max, step), [min, max, step]);
  const [sel, setSel] = useState(value);

  useEffect(() => {
    // 모달이 열릴 때 선택값을 현재 값으로 동기화(휠 표준 패턴).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (visible) setSel(items.includes(value) ? value : items[Math.floor(items.length / 2)]);
  }, [visible, value, items]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <ThemedView style={styles.sheet}>
          <View style={styles.header}>
            <Pressable onPress={onCancel} hitSlop={8}>
              <ThemedText type="body" style={styles.cancel}>취소</ThemedText>
            </Pressable>
            <ThemedText type="captionBold">{title}</ThemedText>
            <Pressable onPress={() => onConfirm(sel)} hitSlop={8}>
              <ThemedText type="captionBold" style={styles.done}>완료</ThemedText>
            </Pressable>
          </View>
          <View style={styles.wheels}>
            <WheelColumn items={items} value={sel} onChange={setSel} suffix={suffix} />
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: Palette.bgSurface,
    borderTopLeftRadius: Radius.modal,
    borderTopRightRadius: Radius.modal,
    paddingBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Palette.lineDefault,
  },
  cancel: { color: Palette.gray500 },
  done: { color: Palette.primary },
  wheels: { flexDirection: 'row', height: ITEM_HEIGHT * VISIBLE, paddingHorizontal: Spacing.md },
  column: { flex: 1 },
  item: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  selectedText: { color: Palette.primary },
  dim: { opacity: 0.35 },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: PAD,
    height: ITEM_HEIGHT,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: Palette.primary,
  },
});
