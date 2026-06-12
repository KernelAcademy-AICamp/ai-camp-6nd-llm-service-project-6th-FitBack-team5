import { ArrowUp, Flame, Sparkles, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Icon } from '@/components/ui';
import { Palette, Radius, ScreenPadding, Spacing } from '@/constants/theme';
import { useCoachChat, type CoachChatContext } from '@/features/coach/useCoachChat';
import { useDietSummary } from '@/features/coach/useDietSummary';
import { useHomeActivity } from '@/features/home/useHomeActivity';

interface ChatMsg {
  role: 'coach' | 'user';
  text: string;
}

const GREETING: ChatMsg = {
  role: 'coach',
  text: '안녕하세요, T 코치예요. 식단·운동·방문 기록을 바탕으로 도와드릴게요. 무엇이 궁금하세요?',
};
// 추천 질문(프리셋). TODO[검토]: 데이터 기반 동적 추천으로 확장.
const SUGGESTED = [
  '오늘 식단 어땠어?',
  '뭘 더 먹으면 좋아?',
  '이번 주 운동 페이스 괜찮아?',
];

function MacroBar({ c, p, f }: { c: number; p: number; f: number }) {
  return (
    <View style={styles.bar}>
      {c > 0 ? <View style={[styles.barSeg, { flex: c, backgroundColor: Palette.primary }]} /> : null}
      {p > 0 ? <View style={[styles.barSeg, { flex: p, backgroundColor: Palette.gray500 }]} /> : null}
      {f > 0 ? <View style={[styles.barSeg, { flex: f, backgroundColor: Palette.profit }]} /> : null}
    </View>
  );
}

/** MY 코치 — 식단 요약 카드 + 단발성 대화 + 추천 질문. (멀티턴 메모리 없음) */
export function CoachChat({ onClose }: { onClose: () => void }) {
  const { summary } = useDietSummary();
  const { data: home } = useHomeActivity();
  const chat = useCoachChat();
  const [messages, setMessages] = useState<ChatMsg[]>([GREETING]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  function buildContext(): CoachChatContext {
    return {
      diet: summary
        ? {
            date: summary.date,
            totalKcal: summary.totalKcal,
            carb_g: summary.carb_g,
            protein_g: summary.protein_g,
            fat_g: summary.fat_g,
            tags: summary.tags,
          }
        : null,
      streakWeeks: home?.streakWeeks,
      weekVisits: home?.weekVisits,
      weekWorkouts: home?.weekWorkouts,
    };
  }

  function send(text: string) {
    const q = text.trim();
    if (!q || chat.isPending) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    chat.mutate(
      { question: q, context: buildContext() },
      {
        onSuccess: (reply) => {
          setMessages((prev) => [...prev, { role: 'coach', text: reply }]);
          requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
        },
        onError: (e) => {
          setMessages((prev) => [
            ...prev,
            { role: 'coach', text: `지금은 답하기 어려워요. (${e.message})` },
          ]);
        },
      },
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <View style={styles.pill}>
            <Icon icon={Sparkles} size={13} color={Palette.primary} />
            <ThemedText type="label" style={{ color: Palette.primary }}>
              AI 코치
            </ThemedText>
          </View>
          {home && home.streakWeeks > 0 ? (
            <View style={styles.badge}>
              <Icon icon={Flame} size={12} color={Palette.warning} />
              <ThemedText type="label" themeColor="textSecondary">
                연속 {home.streakWeeks}주
              </ThemedText>
            </View>
          ) : null}
        </View>
        <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="닫기">
          <Icon icon={X} size={22} color={Palette.gray500} />
        </Pressable>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* 식단 요약 카드 (실데이터) */}
        {summary ? (
          <Card>
            <View style={styles.summaryHead}>
              <ThemedText type="captionBold">오늘 식단</ThemedText>
              <ThemedText type="captionBold">{summary.totalKcal} kcal</ThemedText>
            </View>
            <View style={styles.macroRow}>
              <ThemedText type="label" themeColor="textSecondary">
                탄 {summary.carb_g}g
              </ThemedText>
              <ThemedText type="label" themeColor="textSecondary">
                단 {summary.protein_g}g
              </ThemedText>
              <ThemedText type="label" themeColor="textSecondary">
                지 {summary.fat_g}g
              </ThemedText>
            </View>
            <MacroBar c={summary.carbPct} p={summary.proteinPct} f={summary.fatPct} />
            {summary.tags.length > 0 ? (
              <View style={styles.tagRow}>
                {summary.tags.map((t) => (
                  <View key={t} style={styles.tag}>
                    <ThemedText type="label" themeColor="textSecondary">
                      {t}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        ) : (
          <Card>
            <ThemedText type="caption" themeColor="textSecondary">
              오늘 식단을 기록하면 코치가 분석해드려요.
            </ThemedText>
          </Card>
        )}

        {/* 대화 */}
        {messages.map((m, i) => (
          <View key={i} style={m.role === 'user' ? styles.userLine : styles.coachLine}>
            <View style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.coachBubble]}>
              <ThemedText type="caption" style={m.role === 'user' ? { color: Palette.primary } : undefined}>
                {m.text}
              </ThemedText>
            </View>
          </View>
        ))}
        {chat.isPending ? (
          <View style={styles.coachLine}>
            <View style={[styles.bubble, styles.coachBubble]}>
              <ActivityIndicator size="small" color={Palette.gray500} />
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* 추천 질문 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        keyboardShouldPersistTaps="handled">
        {SUGGESTED.map((q) => (
          <Pressable
            key={q}
            onPress={() => send(q)}
            disabled={chat.isPending}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            accessibilityRole="button">
            <ThemedText type="label" style={{ color: Palette.primary }}>
              {q}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>

      {/* 입력창 */}
      <View style={styles.inputBar}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="메시지를 입력하세요"
          placeholderTextColor={Palette.gray300}
          style={styles.textInput}
          onSubmitEditing={() => send(input)}
          returnKeyType="send"
          editable={!chat.isPending}
        />
        <Pressable
          onPress={() => send(input)}
          disabled={chat.isPending || !input.trim()}
          style={({ pressed }) => [
            styles.sendBtn,
            (!input.trim() || chat.isPending) && styles.sendBtnDisabled,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="보내기">
          <Icon icon={ArrowUp} size={18} color={Palette.white} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ScreenPadding,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Palette.lineDefault,
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Palette.primaryLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  body: { padding: ScreenPadding, gap: Spacing.sm },
  summaryHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  macroRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  bar: { flexDirection: 'row', height: 16, borderRadius: 5, overflow: 'hidden', marginTop: 6, backgroundColor: Palette.gray100 },
  barSeg: { height: '100%' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.sm },
  tag: { backgroundColor: Palette.gray100, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.small },
  coachLine: { alignItems: 'flex-start' },
  userLine: { alignItems: 'flex-end' },
  bubble: { maxWidth: '82%', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.card },
  coachBubble: { backgroundColor: Palette.gray100, borderTopLeftRadius: Radius.small },
  userBubble: { backgroundColor: Palette.primaryLight, borderTopRightRadius: Radius.small },
  chips: { paddingHorizontal: ScreenPadding, paddingBottom: Spacing.sm, gap: Spacing.xs },
  chip: {
    borderWidth: 0.5,
    borderColor: Palette.lineStrong,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  pressed: { opacity: 0.6 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: ScreenPadding,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: Palette.lineDefault,
  },
  textInput: {
    flex: 1,
    backgroundColor: Palette.gray100,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    color: Palette.gray900,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Palette.gray300 },
});
