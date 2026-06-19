import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, ProgressBar } from '@/components/ui';
import { Palette, Radius, Spacing } from '@/constants/theme';
import type { PortfolioItem } from '@/features/membership/PortfolioView';
import { daysUntil } from '@/features/membership/useMemberships';

const TYPE_LABEL: Record<PortfolioItem['m']['type'], string> = { period: '기간권', session: '인세권' };

/** 회원권 개수 요약 헤더 + 부피 줄인 한 줄 리스트(이름·D-day·활용도 미니바). */
export function MembershipMiniList({
  items,
  onSeeAll,
  onPressItem,
}: {
  items: PortfolioItem[];
  onSeeAll: () => void;
  onPressItem: () => void;
}) {
  const total = items.length;
  const active = items.filter((x) => !x.expired).length;
  const expiring = items.filter((x) => x.m.status === 'expiring' && !x.expired).length;
  const ordered = [...items].sort((a, b) => Number(a.expired) - Number(b.expired));

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <View style={styles.headLeft}>
          <ThemedText type="captionBold">회원권 {total}개</ThemedText>
          <ThemedText type="label" themeColor="textSecondary">
            활성 {active}
            {expiring > 0 ? ` · 임박 ${expiring}` : ''}
          </ThemedText>
        </View>
        <Pressable
          onPress={onSeeAll}
          style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}
          accessibilityRole="button">
          <ThemedText type="label" style={{ color: Palette.gray500 }}>
            전체보기
          </ThemedText>
          <Icon icon={ChevronRight} size={14} color={Palette.gray500} />
        </Pressable>
      </View>

      <View style={styles.list}>
        {ordered.map(({ m, value, expired }) => {
          const pct = Math.min(100, Math.round(value.progressPct));
          const dday = Math.max(0, daysUntil(m.endDate));
          const ddayColor = expired ? Palette.gray500 : m.status === 'expiring' ? Palette.warning : Palette.gray500;
          return (
            <Pressable
              key={m.id}
              onPress={onPressItem}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              accessibilityRole="button">
              <View style={styles.rowTop}>
                <View style={styles.nameWrap}>
                  <View style={styles.typeBadge}>
                    <ThemedText type="label" style={{ color: Palette.gray500 }}>
                      {TYPE_LABEL[m.type]}
                    </ThemedText>
                  </View>
                  <ThemedText type="caption" numberOfLines={1} style={styles.name}>
                    {m.name}
                  </ThemedText>
                </View>
                <ThemedText type="label" style={{ color: ddayColor }}>
                  {expired ? '만료' : `D-${dday}`}
                </ThemedText>
              </View>
              <View style={styles.barRow}>
                <View style={styles.barFlex}>
                  <ProgressBar
                    ratio={pct / 100}
                    color={expired ? Palette.gray300 : Palette.primary}
                    height={6}
                    label={`${m.name} 활용도 ${pct}%`}
                  />
                </View>
                <ThemedText type="label" themeColor="textSecondary">
                  {pct}%
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headLeft: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  seeAll: { flexDirection: 'row', alignItems: 'center' },
  list: { gap: Spacing.sm },
  row: {
    gap: 6,
    padding: Spacing.md,
    backgroundColor: Palette.bgSurface,
    borderRadius: Radius.button,
    borderWidth: 0.5,
    borderColor: Palette.lineDefault,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  nameWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  typeBadge: {
    backgroundColor: Palette.gray100,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 1,
  },
  name: { flex: 1 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  barFlex: { flex: 1 },
  pressed: { opacity: 0.6 },
});
