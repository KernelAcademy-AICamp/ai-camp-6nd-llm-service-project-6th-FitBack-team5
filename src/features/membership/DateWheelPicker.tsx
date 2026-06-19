import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette, Radius, Spacing } from '@/constants/theme';

// 2026 기준 모바일 날짜 선택의 표준인 3컬럼 스크롤 휠.
// 크로스플랫폼: 네이티브는 스냅 스크롤, 웹/공통은 항목 탭으로도 선택 가능.
const ITEM_HEIGHT = 44;
const VISIBLE = 5;
const PAD = ITEM_HEIGHT * Math.floor(VISIBLE / 2);

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function rangeArr(start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate(); // month: 1-12
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
              <ThemedText
                type={selected ? 'h2' : 'body'}
                style={selected ? styles.selectedText : styles.dim}>
                {suffix === '년' ? it : pad2(it)}
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

export function DateWheelPicker({
  visible,
  value,
  onConfirm,
  onCancel,
  minYear = 2020,
  maxYear = 2035,
}: {
  visible: boolean;
  value: string; // 'YYYY-MM-DD'
  onConfirm: (date: string) => void;
  onCancel: () => void;
  minYear?: number;
  maxYear?: number;
}) {
  const init = useMemo(() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    const now = new Date();
    if (m) return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) };
    return { y: now.getFullYear(), mo: now.getMonth() + 1, d: now.getDate() };
  }, [value]);

  const [year, setYear] = useState(init.y);
  const [month, setMonth] = useState(init.mo);
  const [day, setDay] = useState(init.d);

  useEffect(() => {
    if (visible) {
      setYear(init.y);
      setMonth(init.mo);
      setDay(init.d);
    }
  }, [visible, init]);

  const years = rangeArr(minYear, maxYear);
  const months = rangeArr(1, 12);
  const maxDay = daysInMonth(year, month);
  const days = rangeArr(1, maxDay);
  const safeDay = Math.min(day, maxDay);

  function handleConfirm() {
    onConfirm(`${year}-${pad2(month)}-${pad2(safeDay)}`);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <ThemedView style={styles.sheet}>
          <View style={styles.header}>
            <Pressable onPress={onCancel} hitSlop={8}>
              <ThemedText type="body" style={styles.cancel}>
                취소
              </ThemedText>
            </Pressable>
            <ThemedText type="captionBold">시작일 선택</ThemedText>
            <Pressable onPress={handleConfirm} hitSlop={8}>
              <ThemedText type="captionBold" style={styles.done}>
                완료
              </ThemedText>
            </Pressable>
          </View>
          <View style={styles.wheels}>
            <WheelColumn items={years} value={year} onChange={setYear} suffix="년" />
            <WheelColumn items={months} value={month} onChange={setMonth} suffix="월" />
            <WheelColumn items={days} value={safeDay} onChange={setDay} suffix="일" />
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
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
  wheels: {
    flexDirection: 'row',
    height: ITEM_HEIGHT * VISIBLE,
    paddingHorizontal: Spacing.md,
  },
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
