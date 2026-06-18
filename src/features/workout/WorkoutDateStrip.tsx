/**
 * 운동 홈 상단 가로 날짜 스트립.
 * 오늘 기준 앞뒤 7일(총 15일) 표시. 선택 일자는 보라 pill 강조.
 * 선택 변경 시 onSelect(iso) 콜백.
 */

import { useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Palette, Radius, Spacing } from '@/constants/theme';

const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];
const DATE_ITEM_W = 56;

function iso(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function WorkoutDateStrip({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (iso: string) => void;
}) {
  const days = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return Array.from({ length: 15 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + (i - 7));
      return {
        iso: iso(d),
        label: `${d.getMonth() + 1}.${d.getDate()}`,
        dow: DOW_KO[d.getDay()],
      };
    });
  }, []);
  const ref = useRef<ScrollView>(null);
  const selIndex = days.findIndex((d) => d.iso === selected);

  // 선택 날짜를 가운데로 — onLayout 의 width 로 1회 정렬.
  function centerSelected(width: number) {
    const x = Math.max(0, selIndex * DATE_ITEM_W - (width / 2 - DATE_ITEM_W / 2));
    ref.current?.scrollTo({ x, animated: false });
  }

  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={(e) => centerSelected(e.nativeEvent.layout.width)}
      style={styles.strip}
      contentContainerStyle={styles.stripContent}>
      {days.map((d) => {
        const isSel = d.iso === selected;
        return (
          <Pressable
            key={d.iso}
            onPress={() => onSelect(d.iso)}
            style={[
              styles.item,
              isSel && { backgroundColor: Palette.primary },
            ]}>
            <ThemedText
              type="smallBold"
              style={{ color: isSel ? Palette.white : Palette.gray900 }}>
              {d.label}
            </ThemedText>
            <ThemedText
              type="label"
              style={{ color: isSel ? Palette.white : Palette.gray500 }}>
              {d.dow}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: { flexGrow: 0 },
  stripContent: {
    paddingHorizontal: Spacing.sm,
    gap: Spacing.xs,
    alignItems: 'center',
  },
  item: {
    width: DATE_ITEM_W,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    alignItems: 'center',
    gap: 2,
  },
});
