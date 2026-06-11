import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type DimensionValue,
  type TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

interface Meal {
  id: string;
  time: string;
  name: string;
  kcal: number;
}

const dummyMeals: Meal[] = [
  { id: '1', time: '08:10', name: '시리얼 + 우유 + 바나나', kcal: 380 },
  { id: '2', time: '12:30', name: '닭가슴살 샐러드', kcal: 420 },
  { id: '3', time: '15:00', name: '아메리카노 + 견과류', kcal: 180 },
  { id: '4', time: '19:00', name: '현미밥 + 고등어구이 + 나물', kcal: 620 },
];

const dailyGoal = 2000;

function MealCard({ item }: { item: Meal }) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText type="small">{item.time}</ThemedText>
        <ThemedText type="smallBold">{item.kcal} kcal</ThemedText>
      </View>
      <ThemedText type="subtitle">{item.name}</ThemedText>
    </ThemedView>
  );
}

// ── 화면 ────────────────────────────────────────────────────
export default function DietScreen() {
  const totalKcal = dummyMeals.reduce((acc, m) => acc + m.kcal, 0);
  const remaining = dailyGoal - totalKcal;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">오늘의 식단</ThemedText>

        <ThemedView type="backgroundElement" style={styles.summary}>
          <View style={styles.summaryRow}>
            <ThemedText type="small">섭취</ThemedText>
            <ThemedText type="subtitle">{totalKcal} kcal</ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <ThemedText type="small">목표 {dailyGoal} kcal</ThemedText>
            <ThemedText type="small">
              남은 {remaining > 0 ? remaining : 0} kcal
            </ThemedText>
          </View>
          {isLoading ? (
            <Card>
              <View style={styles.listState}>
                <ActivityIndicator color={D.primary} />
                <Txt variant="caption" color={D.gray500}>
                  기록을 불러오는 중…
                </Txt>
              </View>
            </Card>
          ) : isError ? (
            <Card>
              <View style={styles.listState}>
                <Txt variant="caption" color={D.gray500}>
                  기록을 불러오지 못했어요.
                </Txt>
                <Pressable onPress={() => refetch()} hitSlop={8}>
                  <Txt variant="caption" weight="600" color={D.primary}>
                    다시 시도
                  </Txt>
                </Pressable>
              </View>
            </Card>
          ) : (
            <View style={styles.slotList}>
              {MEAL_TYPES.map((t) => (
                <MealSlot key={t} type={t} meals={meals} onPress={openRecord} />
              ))}
            </View>
          )}
        </ScrollView>
          <FadeTop />
        </View>

      </SafeAreaView>

      <RecordModal visible={modalOpen} initialMealType={modalMealType} onClose={() => setModalOpen(false)} onSave={handleSave} />
      <CalendarModal
        visible={calendarOpen}
        selected={selectedDate}
        onSelect={setSelectedDate}
        onClose={() => setCalendarOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: D.bgBase },
  safeArea: { flex: 1, width: '100%', maxWidth: 800, alignSelf: 'center' },

  // 날짜 스트립 (하단 선 없음, 아래 영역과 24px 간격)
  dateStrip: { flexGrow: 0, backgroundColor: D.bgBase },
  dateStripContent: { paddingHorizontal: S.sm, alignItems: 'center' },

  // 오늘 운동 요약 (날짜 바로 아래, 아주 작게)
  workoutBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: D.muted,
    borderRadius: R.button,
    paddingVertical: 6,
  },
  workoutLead: { flexDirection: 'row', alignItems: 'center', gap: S.xs, paddingHorizontal: S.md },
  workoutCell: { flex: 1, alignItems: 'center' },
  workoutDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: D.lineStrong, marginVertical: 4 },

  // 스크롤 영역 + 상단 페이드
  scrollWrap: { flex: 1, position: 'relative' },
  fadeTop: { position: 'absolute', top: 0, left: 0, right: 0, height: S.md, zIndex: 2 },
  dateItem: {
    width: DATE_ITEM_W,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingVertical: S.sm,
  },

  // 달력 팝업
  calBackdrop: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.three,
  },
  summary: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.two,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  list: {
    gap: Spacing.three,
    paddingBottom: Spacing.three,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.two,
  },
  searchInput: { flex: 1, fontSize: 16, color: D.gray900 },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: S.sm,
    paddingVertical: S.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: D.line,
  },
  searchEmpty: { textAlign: 'center', paddingVertical: S.xl, alignItems: 'center' },

  analyzing: { alignItems: 'center', gap: S.sm, paddingVertical: S.xxl },

  reviewBody: { paddingHorizontal: SIDE, paddingTop: S.md, paddingBottom: S.xxl, gap: S.sm },
  reviewCard: {
    backgroundColor: D.muted,
    borderRadius: R.card,
    padding: S.md,
    gap: S.sm,
    alignItems: 'center',
  },
  center: { textAlign: 'center' },
  estimateRow: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  reviewKcal: { flexDirection: 'row', alignItems: 'baseline', gap: S.sm, marginTop: S.xs },
  reviewKcalNum: { fontSize: 44, lineHeight: 52 },
  reviewMacros: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: S.sm },
  reviewMacro: { alignItems: 'center', gap: 2 },

  chipRow: { flexDirection: 'row', gap: S.sm },
  mealChip: { flex: 1, alignItems: 'center', paddingVertical: S.sm, borderRadius: R.full, borderWidth: 1 },

  primaryBtn: { height: 52, borderRadius: R.button, alignItems: 'center', justifyContent: 'center', marginTop: S.sm },
});
