/**
 * 3/4 오운완 기록 — 세트/회/초 입력 + 종목 체크 + 메모 + "오운완".
 *
 * - 진입 시 store 의 items 가 비었으면 useActiveSession 으로 복원
 * - "오운완" → success_flag='Y' update → /workout/custom/share
 */

import { useRouter } from 'expo-router';
import { Check, ChevronLeft, Minus, Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
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
} from '@/constants/theme';
import type { DraftItem } from '@/features/workout-custom/types';
import { useActiveSession, useCompleteSession } from '@/features/workout-custom/useSession';
import { useCustomWorkoutDraft } from '@/stores/workout-custom';

export default function RecordScreen() {
  const router = useRouter();

  const storeItems = useCustomWorkoutDraft((s) => s.items);
  const storeSessionId = useCustomWorkoutDraft((s) => s.sessionId);
  const memo = useCustomWorkoutDraft((s) => s.memo);
  const setMemo = useCustomWorkoutDraft((s) => s.setMemo);
  const patchItem = useCustomWorkoutDraft((s) => s.patchItem);
  const hydrateFromSession = useCustomWorkoutDraft((s) => s.hydrateFromSession);

  const { data: active, isLoading } = useActiveSession();
  const completeMut = useCompleteSession();

  // 외부 진입(코치 → 활성 세션 있음) 시 store 1회 동기화.
  useEffect(() => {
    if (storeSessionId || !active) return;
    hydrateFromSession({
      sessionId: active.id,
      bodyPart: active.body_part as never,
      exerciseType: active.exercise_type as never,
      items: active.items,
      memo: active.memo ?? '',
    });
  }, [active, storeSessionId, hydrateFromSession]);

  const items = storeItems ?? [];
  const allDone = items.length > 0 && items.every((it) => it.done);
  const sessionId = storeSessionId ?? active?.id ?? null;

  async function handleComplete() {
    if (!sessionId) {
      Alert.alert('세션 정보가 없어요', '루틴을 다시 시작해주세요.');
      return;
    }
    try {
      await completeMut.mutateAsync({ sessionId, items, memo });
      router.replace('/workout/custom/share');
    } catch (e) {
      Alert.alert('완료 실패', e instanceof Error ? e.message : '잠시 후 다시 시도해주세요.');
    }
  }

  if (isLoading && items.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safe} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}>
            <Icon icon={ChevronLeft} size={24} color={Palette.gray900} />
          </Pressable>
          <ThemedText type="subtitle">오운완 기록</ThemedText>
          <ThemedText type="captionBold" style={{ color: Palette.gray500 }}>
            3 / 4
          </ThemedText>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* 진행 상태 배너 */}
          <View style={styles.banner}>
            <View style={styles.bannerCheck}>
              <Icon icon={Check} size={14} color={Palette.white} strokeWidth={3} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="captionBold" style={{ color: Palette.gray900 }}>
                운동 진행 중이에요!
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                모든 세트 완료 후 ‘오운완’ 버튼을 눌러주세요.
              </ThemedText>
            </View>
          </View>

          {/* 전체 토글 — 한 번에 모든 종목 완료/해제 */}
          <Pressable
            onPress={() => {
              const next = !allDone;
              items.forEach((it) => patchItem(it.catalog_id, { done: next }));
            }}
            style={({ pressed }) => [styles.allRow, { opacity: pressed ? 0.7 : 1 }]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: allDone }}>
            <View
              style={[
                styles.allCheck,
                {
                  backgroundColor: allDone ? Palette.primary : Palette.bgSurface,
                  borderColor: allDone ? Palette.primary : Palette.lineStrong,
                },
              ]}>
              {allDone ? <Icon icon={Check} size={14} color={Palette.white} /> : null}
            </View>
            <ThemedText type="captionBold" style={{ flex: 1 }}>
              전체
            </ThemedText>
            <ThemedText type="label" themeColor="textSecondary">
              {items.filter((it) => it.done).length} / {items.length}
            </ThemedText>
          </Pressable>

          {/* 종목별 입력 */}
          <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
            {items.map((it, idx) => (
              <ItemRow
                key={it.catalog_id}
                index={idx + 1}
                item={it}
                onPatch={(patch) => patchItem(it.catalog_id, patch)}
              />
            ))}
          </View>

          {/* 메모 */}
          <View style={styles.memoBox}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <ThemedText type="captionBold">메모 (선택)</ThemedText>
              <ThemedText type="label" themeColor="textSecondary">
                {memo.length}/120
              </ThemedText>
            </View>
            <TextInput
              value={memo}
              onChangeText={(t) => setMemo(t.slice(0, 120))}
              placeholder="오늘의 컨디션, 운동 느낌 등을 기록해보세요."
              placeholderTextColor={Palette.gray400}
              multiline
              style={styles.memoInput}
            />
          </View>

          {/* CTA — 스크롤 끝 인라인 */}
          <View style={styles.ctaWrap}>
            <Button
              label="오운완"
              loading={completeMut.isPending}
              disabled={!allDone}
              onPress={handleComplete}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function ItemRow({
  index,
  item,
  onPatch,
}: {
  index: number;
  item: DraftItem;
  onPatch: (patch: Partial<DraftItem>) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <View style={{ flex: 1 }}>
          <ThemedText type="captionBold">
            {index}  {item.name}
          </ThemedText>
          <ThemedText type="label" themeColor="textSecondary" style={{ marginTop: 2 }}>
            {item.body_part} · {item.exercise_type}
          </ThemedText>
        </View>
        <ThemedText type="captionBold" style={{ color: Palette.primary }}>
          {item.duration_min}분
        </ThemedText>
      </View>

      <View style={styles.inputRow}>
        <Stepper
          value={item.sets}
          min={1}
          max={20}
          suffix="세트"
          onChange={(v) => onPatch({ sets: v })}
        />
        <ThemedText type="body" style={{ color: Palette.gray500 }}>
          ×
        </ThemedText>
        <Stepper
          value={item.reps}
          min={1}
          max={item.unit === '초' ? 600 : 100}
          suffix={item.unit}
          onChange={(v) => onPatch({ reps: v })}
        />
        <Pressable
          onPress={() => onPatch({ done: !item.done })}
          style={({ pressed }) => [
            styles.doneBtn,
            {
              backgroundColor: item.done ? Palette.primary : Palette.bgSurface,
              borderColor: item.done ? Palette.primary : Palette.lineStrong,
              opacity: pressed ? 0.8 : 1,
            },
          ]}>
          <Icon
            icon={Check}
            size={16}
            color={item.done ? Palette.white : Palette.gray500}
          />
        </Pressable>
      </View>
    </View>
  );
}

function Stepper({
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  const step = suffix === '초' ? 5 : 1;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  // 외부에서 value 가 바뀌면 draft 동기화 (편집 중이 아닐 때만)
  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  function commit() {
    const n = parseInt(draft, 10);
    if (!Number.isFinite(n)) {
      setDraft(String(value));
    } else {
      const clamped = Math.min(max, Math.max(min, n));
      onChange(clamped);
      setDraft(String(clamped));
    }
    setEditing(false);
  }

  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={() => onChange(Math.max(min, value - step))}
        style={({ pressed }) => [styles.stepBtn, { opacity: pressed ? 0.6 : 1 }]}>
        <Icon icon={Minus} size={14} color={Palette.primary} />
      </Pressable>
      <Pressable
        onPress={() => setEditing(true)}
        style={styles.stepValue}
        accessibilityRole="button"
        accessibilityLabel={`${value} ${suffix} — 탭하여 직접 입력`}>
        {editing ? (
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onBlur={commit}
            onSubmitEditing={commit}
            autoFocus
            selectTextOnFocus
            keyboardType="number-pad"
            inputMode="numeric"
            style={styles.stepInput}
          />
        ) : (
          <ThemedText type="captionBold" style={styles.stepNumber}>
            {value}
          </ThemedText>
        )}
        <ThemedText
          type="label"
          themeColor="textSecondary"
          numberOfLines={1}
          style={styles.stepSuffix}>
          {suffix}
        </ThemedText>
      </Pressable>
      <Pressable
        onPress={() => onChange(Math.min(max, value + step))}
        style={({ pressed }) => [styles.stepBtn, { opacity: pressed ? 0.6 : 1 }]}>
        <Icon icon={Plus} size={14} color={Palette.primary} />
      </Pressable>
    </View>
  );
}

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
  scrollContent: {
    paddingHorizontal: ScreenPadding,
    paddingBottom: Spacing.xxl + BottomTabInset,
  },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.successLight,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Palette.success,
    padding: Spacing.md,
  },
  bannerCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Palette.success,
    alignItems: 'center',
    justifyContent: 'center',
  },

  allRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.bgSurface,
    borderRadius: Radius.card,
    borderWidth: 0.5,
    borderColor: Palette.lineDefault,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.md,
  },
  allCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  row: {
    backgroundColor: Palette.bgSurface,
    borderRadius: Radius.card,
    borderWidth: 0.5,
    borderColor: Palette.lineDefault,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Palette.lineDefault,
    borderRadius: Radius.button,
    backgroundColor: Palette.bgSurface,
    flex: 1,
  },
  stepBtn: {
    width: 32,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    flex: 1,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  stepNumber: {
    minWidth: 24,
    textAlign: 'center',
    lineHeight: 21,
  },
  stepSuffix: {
    flexShrink: 0,
    lineHeight: 21,
  },
  stepInput: {
    width: 40,
    height: 24,
    padding: 0,
    margin: 0,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: Palette.gray900,
    backgroundColor: 'transparent',
    borderWidth: 0,
    // 웹 기본 outline 제거
    ...(Platform.OS === 'web' ? { outlineWidth: 0, outlineStyle: 'none' as never } : null),
  },
  doneBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.button,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  memoBox: {
    backgroundColor: Palette.bgSurface,
    borderRadius: Radius.card,
    borderWidth: 0.5,
    borderColor: Palette.lineDefault,
    padding: Spacing.md,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  memoInput: {
    minHeight: 60,
    color: Palette.gray900,
    fontSize: 14,
    textAlignVertical: 'top',
  },

  ctaWrap: {
    marginTop: Spacing.lg,
  },
});
