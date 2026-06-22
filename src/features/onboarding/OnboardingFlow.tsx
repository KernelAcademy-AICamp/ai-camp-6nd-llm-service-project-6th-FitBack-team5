import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, Icon } from '@/components/ui';
import { Palette, Radius, ScreenPadding, Spacing } from '@/constants/theme';
import { DateWheelPicker } from '@/features/membership/DateWheelPicker';
import { NumberWheelPicker } from '@/features/membership/NumberWheelPicker';
import { useCompleteOnboarding, type FitnessGoal } from '@/features/onboarding/useCompleteOnboarding';
import { queryClient } from '@/lib/queryClient';

// 회원권 단계는 온보딩에서 제거 — 첫 진입엔 정보·목표만 받고, 회원권은 홈 빈 상태에서 추가 유도.
type Step = 'info' | 'goal' | 'done';
const STEP_ORDER: Step[] = ['info', 'goal'];

const GENDERS: { value: 'F' | 'M'; label: string }[] = [
  { value: 'F', label: '여자' },
  { value: 'M', label: '남자' },
];

const GOALS: { value: FitnessGoal; label: string; desc: string }[] = [
  { value: 'fat_loss', label: '체중 감량', desc: '건강하게 체지방을 줄여요' },
  { value: 'muscle_gain', label: '근력 향상', desc: '근력을 키우고 탄탄하게' },
  { value: 'health', label: '건강 관리', desc: '꾸준한 컨디션 관리' },
  { value: 'body_shape', label: '체형 개선', desc: '원하는 라인을 만들어요' },
  { value: 'habit', label: '습관 형성', desc: '운동을 루틴으로' },
];

function ageFromBirth(d: string): number {
  const b = new Date(`${d}T00:00:00`);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const mo = now.getMonth() - b.getMonth();
  if (mo < 0 || (mo === 0 && now.getDate() < b.getDate())) a -= 1;
  return a;
}

export function OnboardingFlow() {
  const [step, setStep] = useState<Step>('info');

  const [birthDate, setBirthDate] = useState('2000-01-01');
  const [birthPickerOpen, setBirthPickerOpen] = useState(false);
  const [gender, setGender] = useState<'F' | 'M' | null>(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [heightPickerOpen, setHeightPickerOpen] = useState(false);
  const [weightPickerOpen, setWeightPickerOpen] = useState(false);
  const [goal, setGoal] = useState<FitnessGoal | null>(null);

  const { mutate, isPending, error } = useCompleteOnboarding();

  const stepIndex = STEP_ORDER.indexOf(step);
  const curYear = new Date().getFullYear();

  function submit() {
    mutate(
      {
        age: birthDate ? ageFromBirth(birthDate) : null,
        gender,
        height: height ? Number(height) : null,
        weight: weight ? Number(weight) : null,
        membership: null, // 회원권은 온보딩 이후 홈에서 등록
        goal,
      },
      { onSuccess: () => setStep('done') },
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {step !== 'done' ? (
          <View style={styles.progress}>
            {STEP_ORDER.map((s, i) => (
              <View key={s} style={[styles.dot, i <= stepIndex && styles.dotOn]} />
            ))}
          </View>
        ) : null}

        <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* 1) 내 정보 */}
          {step === 'info' ? (
            <>
              <ThemedText type="h1">반가워요!</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">
                맞춤 분석을 위해 기본 정보를 알려주세요. (나중에 바꿀 수 있어요)
              </ThemedText>

              <View style={styles.field}>
                <ThemedText type="label" themeColor="textSecondary">생년월일</ThemedText>
                <Pressable onPress={() => setBirthPickerOpen(true)} style={styles.input}>
                  <ThemedText type="body">{birthDate}</ThemedText>
                </Pressable>
              </View>

              <View style={styles.field}>
                <ThemedText type="label" themeColor="textSecondary">성별</ThemedText>
                <View style={styles.segmentRow}>
                  {GENDERS.map((g) => {
                    const on = gender === g.value;
                    return (
                      <Pressable key={g.value} onPress={() => setGender(g.value)} style={[styles.segment, on && styles.segOn]}>
                        <ThemedText type={on ? 'captionBold' : 'caption'} style={on ? styles.activeText : undefined}>
                          {g.label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.field}>
                <ThemedText type="label" themeColor="textSecondary">키 (cm)</ThemedText>
                <Pressable onPress={() => setHeightPickerOpen(true)} style={styles.input}>
                  <ThemedText type="body" themeColor={height ? 'text' : 'textSecondary'}>
                    {height ? `${height} cm` : '예: 168'}
                  </ThemedText>
                </Pressable>
              </View>
              <View style={styles.field}>
                <ThemedText type="label" themeColor="textSecondary">체중 (kg)</ThemedText>
                <Pressable onPress={() => setWeightPickerOpen(true)} style={styles.input}>
                  <ThemedText type="body" themeColor={weight ? 'text' : 'textSecondary'}>
                    {weight ? `${weight} kg` : '예: 58'}
                  </ThemedText>
                </Pressable>
              </View>
            </>
          ) : null}

          {/* 2) 가입 환영 + 운동 목표 */}
          {step === 'goal' ? (
            <>
              <ThemedText type="h1">가입을 환영해요!</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">
                어떤 목표로 운동하시나요? 맞춤 코칭에 쓸게요. (선택, 나중에 바꿀 수 있어요)
              </ThemedText>
              {GOALS.map((g) => {
                const on = goal === g.value;
                return (
                  <Card
                    key={g.value}
                    onPress={() => setGoal((v) => (v === g.value ? null : g.value))}
                    accentColor={on ? Palette.primary : undefined}
                    style={on ? styles.cardOn : undefined}>
                    <View style={styles.cardHead}>
                      <ThemedText type="h2">{g.label}</ThemedText>
                      {on ? <Icon icon={Check} size={20} color={Palette.primary} /> : null}
                    </View>
                    <ThemedText type="caption" themeColor="textSecondary">{g.desc}</ThemedText>
                  </Card>
                );
              })}
              {error ? (
                <ThemedText type="caption" style={styles.error}>저장 실패: {(error as Error).message}</ThemedText>
              ) : null}
            </>
          ) : null}

          {/* 완료 */}
          {step === 'done' ? (
            <View style={styles.doneWrap}>
              <View style={styles.celebrate}>
                <Icon icon={Check} size={32} color={Palette.profit} />
              </View>
              <ThemedText type="h1">준비 완료!</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">
                이제 시작해볼까요? 홈에서 회원권을 등록하면 활용도를 분석해 드려요.
              </ThemedText>
            </View>
          ) : null}
        </ScrollView>

        {/* 하단 고정 CTA */}
        <View style={styles.footer}>
          {step === 'info' ? <Button label="다음" onPress={() => setStep('goal')} /> : null}
          {step === 'goal' ? (
            <>
              <Button label="완료" onPress={submit} loading={isPending} />
              <Pressable onPress={() => setStep('info')} style={styles.backBtn} hitSlop={6}>
                <ThemedText type="captionBold" themeColor="textSecondary">이전으로</ThemedText>
              </Pressable>
            </>
          ) : null}
          {step === 'done' ? (
            <Button label="시작하기" onPress={() => queryClient.invalidateQueries({ queryKey: ['profile'] })} />
          ) : null}
        </View>
      </SafeAreaView>

      <DateWheelPicker
        visible={birthPickerOpen}
        value={birthDate}
        minYear={1940}
        maxYear={curYear}
        onConfirm={(d) => {
          setBirthDate(d);
          setBirthPickerOpen(false);
        }}
        onCancel={() => setBirthPickerOpen(false)}
      />
      <NumberWheelPicker
        visible={heightPickerOpen}
        value={height ? Number(height) : 165}
        min={120}
        max={220}
        suffix=" cm"
        title="키 선택"
        onConfirm={(v) => {
          setHeight(String(v));
          setHeightPickerOpen(false);
        }}
        onCancel={() => setHeightPickerOpen(false)}
      />
      <NumberWheelPicker
        visible={weightPickerOpen}
        value={weight ? Number(weight) : 60}
        min={30}
        max={200}
        suffix=" kg"
        title="체중 선택"
        onConfirm={(v) => {
          setWeight(String(v));
          setWeightPickerOpen(false);
        }}
        onCancel={() => setWeightPickerOpen(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.bgBase },
  safe: { flex: 1 },
  progress: { flexDirection: 'row', gap: Spacing.xs, paddingHorizontal: ScreenPadding, paddingTop: Spacing.md },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Palette.gray100 },
  dotOn: { backgroundColor: Palette.primary },
  scroll: { flex: 1 },
  body: { paddingHorizontal: ScreenPadding, paddingVertical: Spacing.lg, gap: Spacing.md },
  field: { gap: Spacing.sm },
  footer: {
    paddingHorizontal: ScreenPadding,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: Palette.lineDefault,
    backgroundColor: Palette.bgBase,
  },
  backBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  input: {
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    color: Palette.gray900,
    backgroundColor: Palette.gray100,
    minHeight: 52,
    justifyContent: 'center',
  },
  segmentRow: { flexDirection: 'row', gap: Spacing.sm },
  segment: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.small, backgroundColor: Palette.gray100 },
  segOn: { backgroundColor: Palette.primaryLight },
  activeText: { color: Palette.primary },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardOn: { backgroundColor: Palette.primaryLight },
  error: { color: Palette.error },
  doneWrap: { alignItems: 'center', gap: Spacing.md, paddingTop: Spacing.xxl },
  celebrate: { width: 64, height: 64, borderRadius: Radius.full, backgroundColor: Palette.profitLight, alignItems: 'center', justifyContent: 'center' },
});
