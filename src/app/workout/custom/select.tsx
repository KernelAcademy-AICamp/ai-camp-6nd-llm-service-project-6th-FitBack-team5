/**
 * 1/4 운동 선택 — 부위·유형 토글 + 종목 6/4개 그리드 (다중 선택).
 *
 * - 디폴트: 하체 × 근력
 * - DB 저장 없음 (Zustand draft 만 갱신)
 * - 하단 CTA "선택 완료 (N)" → /workout/custom/routine
 */

import { useRouter } from 'expo-router';
import { Check, ChevronLeft, X } from 'lucide-react-native';
import { Image } from 'expo-image';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Icon } from '@/components/ui';
import {
  BottomTabInset,
  MaxContentWidth,
  Palette,
  Radius,
  ScreenPadding,
  Spacing,
  Typography,
} from '@/constants/theme';
import { useCatalog } from '@/features/workout-custom/useCatalog';
import type { BodyPart, CatalogItem, ExerciseType } from '@/features/workout-custom/types';
import { useCustomWorkoutDraft } from '@/stores/workout-custom';

const BODY_PARTS: BodyPart[] = ['하체', '상체', '코어', '전신'];
const EXERCISE_TYPES: ExerciseType[] = ['근력', '유산소', '스트레칭'];

export default function SelectScreen() {
  const router = useRouter();
  const bodyPart = useCustomWorkoutDraft((s) => s.bodyPart);
  const exerciseType = useCustomWorkoutDraft((s) => s.exerciseType);
  const selected = useCustomWorkoutDraft((s) => s.selected);
  const setBodyPart = useCustomWorkoutDraft((s) => s.setBodyPart);
  const setExerciseType = useCustomWorkoutDraft((s) => s.setExerciseType);
  const toggleSelected = useCustomWorkoutDraft((s) => s.toggleSelected);
  const removeSelected = useCustomWorkoutDraft((s) => s.removeSelected);

  const { data: catalog, isLoading } = useCatalog(bodyPart, exerciseType);

  const selectedIds = selected.map((s) => s.id);
  const count = selected.length;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}>
            <Icon icon={ChevronLeft} size={24} color={Palette.gray900} />
          </Pressable>
          <ThemedText type="subtitle">운동 선택</ThemedText>
          <ThemedText type="captionBold" style={{ color: Palette.gray500 }}>
            1 / 4
          </ThemedText>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <ThemedText type="h2" style={{ marginBottom: Spacing.xs }}>
            어떤 운동을 할까요?
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            부위, 유형, 종목을 선택하세요.
          </ThemedText>

          {/* 부위 */}
          <Section title="부위" inline>
            <ChipRow
              options={BODY_PARTS}
              active={bodyPart}
              onPick={(v) => setBodyPart(v as BodyPart)}
            />
          </Section>

          {/* 유형 */}
          <Section title="유형" inline>
            <ChipRow
              options={EXERCISE_TYPES}
              active={exerciseType}
              onPick={(v) => setExerciseType(v as ExerciseType)}
            />
          </Section>

          {/* 종목 */}
          <Section title="종목" subtitle="(다중 선택 가능)">
            {isLoading ? (
              <View style={{ paddingVertical: Spacing.xl, alignItems: 'center' }}>
                <ActivityIndicator color={Palette.primary} />
              </View>
            ) : (
              <View style={styles.grid}>
                {(catalog ?? []).map((item) => (
                  <ExerciseCard
                    key={item.id}
                    item={item}
                    selected={selectedIds.includes(item.id)}
                    onPress={() => toggleSelected(item)}
                  />
                ))}
              </View>
            )}
          </Section>
        </ScrollView>

        {/* 내 선택 트레이 — 부위/유형 필터를 바꿔도 무엇을 골랐는지 항상 보인다. */}
        {count > 0 ? (
          <View style={styles.tray}>
            <ThemedText type="label" themeColor="textSecondary" style={{ marginBottom: Spacing.sm }}>
              내 선택 ({count})
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: Spacing.xs }}>
              {selected.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => removeSelected(s.id)}
                  style={({ pressed }) => [
                    styles.trayChip,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}>
                  <ThemedText style={styles.trayChipText}>{s.name}</ThemedText>
                  <Icon icon={X} size={12} color={Palette.primary} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.bottomBar}>
          <Button
            label={`선택 완료 (${count})`}
            disabled={count === 0}
            onPress={() => router.push('/workout/custom/routine')}
          />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function Section({
  title,
  subtitle,
  children,
  inline,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** true: 타이틀 옆으로 children 가로 정렬. false: 타이틀 아래로 children 세로 정렬. */
  inline?: boolean;
}) {
  if (inline) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.md,
          marginTop: Spacing.lg,
        }}>
        <ThemedText type="subtitle">{title}</ThemedText>
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    );
  }
  return (
    <View style={{ marginTop: Spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs }}>
        <ThemedText type="subtitle">{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <View style={{ marginTop: Spacing.sm }}>{children}</View>
    </View>
  );
}

function ChipRow({
  options,
  active,
  onPick,
}: {
  options: readonly string[];
  active: string;
  onPick: (v: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const on = opt === active;
        return (
          <Pressable
            key={opt}
            onPress={() => onPick(opt)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: on ? Palette.primary : Palette.bgSurface,
                borderColor: on ? Palette.primary : Palette.lineDefault,
                opacity: pressed ? 0.8 : 1,
              },
            ]}>
            <ThemedText
              type="captionBold"
              style={{ color: on ? Palette.white : Palette.gray700 }}>
              {opt}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 종목 카드 이미지. URL 없거나 로딩 실패 시 'No Image' placeholder. */
function ExerciseImage({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <View style={[styles.exImage, styles.exImagePlaceholder]}>
        <ThemedText type="label" themeColor="textSecondary">
          No Image
        </ThemedText>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: url }}
      style={styles.exImage}
      contentFit="contain"
      onError={() => setFailed(true)}
    />
  );
}

function ExerciseCard({
  item,
  selected,
  onPress,
}: {
  item: CatalogItem;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.exCard,
        {
          borderColor: selected ? Palette.primary : Palette.lineDefault,
          backgroundColor: selected ? Palette.primaryLight : Palette.bgSurface,
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <View style={styles.checkBox}>
        <View
          style={[
            styles.checkCircle,
            {
              backgroundColor: selected ? Palette.primary : Palette.bgSurface,
              borderColor: selected ? Palette.primary : Palette.lineStrong,
            },
          ]}>
          {selected ? <Icon icon={Check} size={14} color={Palette.white} /> : null}
        </View>
      </View>
      <ExerciseImage url={item.image_url} />
      <ThemedText type="captionBold" style={{ textAlign: 'center' }}>
        {item.name}
      </ThemedText>
    </Pressable>
  );
}

const CARD_GAP = Spacing.sm;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.bgBase },
  safe: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ScreenPadding,
    height: 52,
  },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: ScreenPadding, paddingBottom: Spacing.xxl },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  exCard: {
    width: `48%` as const,
    borderRadius: Radius.card,
    borderWidth: 1.5,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.sm,
    position: 'relative',
  },
  exImage: {
    width: '100%',
    // 정사각 비율 — 이미지 원본(인물 일러스트, 대체로 정사각/세로) 과 맞춰
    // 위아래 빈 회색 영역이 생기지 않도록 한다.
    aspectRatio: 1,
    borderRadius: Radius.button,
  },
  exImagePlaceholder: {
    backgroundColor: Palette.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBox: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    zIndex: 1,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tray: {
    paddingHorizontal: ScreenPadding,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: Palette.lineDefault,
    backgroundColor: Palette.bgSurface,
  },
  trayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Palette.primaryLight,
  },
  trayChipText: {
    ...Typography.caption,
    color: Palette.primary,
  },

  bottomBar: {
    paddingHorizontal: ScreenPadding,
    paddingTop: Spacing.md,
    // 네이티브: NativeTabs 가 자체 inset 처리 → 0. 웹: JS fixed 탭 바 높이만큼 보정.
    paddingBottom: Platform.OS === 'web' ? BottomTabInset : 0,
    borderTopWidth: 0.5,
    borderTopColor: Palette.lineDefault,
    backgroundColor: Palette.bgSurface,
  },
});
