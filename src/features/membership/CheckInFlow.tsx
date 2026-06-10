import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useCreateVisit } from '@/features/membership/useCreateVisit';
import type { Membership } from '@/features/membership/useMemberships';

type Step = 'select' | 'prepare' | 'depart' | 'arrive' | 'done';

function CheckItem({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable onPress={onToggle} style={styles.checkRow} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <View style={[styles.checkbox, checked && styles.checkboxOn]}>
        {checked ? (
          <ThemedText type="smallBold" style={styles.checkMark}>
            ✓
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="default">{label}</ThemedText>
    </Pressable>
  );
}

function PrimaryBtn({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.primary, (disabled || loading) && styles.primaryDim, pressed && styles.pressed]}>
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <ThemedText type="smallBold" style={styles.primaryLabel}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

export function CheckInFlow({
  memberships,
  onClose,
}: {
  memberships: Membership[];
  onClose: () => void;
}) {
  const single = memberships.length === 1;
  const [step, setStep] = useState<Step>(single ? 'prepare' : 'select');
  const [selectedId, setSelectedId] = useState<string | null>(single ? memberships[0].id : null);
  const [phone, setPhone] = useState(false);
  const [clothes, setClothes] = useState(false);
  const { mutate, isPending, error } = useCreateVisit();

  const selected = memberships.find((m) => m.id === selectedId) ?? null;

  function checkIn() {
    if (!selected) return;
    mutate(
      { membershipId: selected.id, centerName: selected.name },
      { onSuccess: () => setStep('done') },
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="subtitle">센터 가기</ThemedText>
        <Pressable onPress={onClose} hitSlop={8}>
          <ThemedText type="default">닫기</ThemedText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {step === 'select' ? (
          <>
            <ThemedText type="default">어느 회원권으로 가시나요?</ThemedText>
            {memberships.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => {
                  setSelectedId(m.id);
                  setStep('prepare');
                }}
                style={({ pressed }) => [styles.optionBtn, pressed && styles.pressed]}>
                <ThemedText type="smallBold">{m.name}</ThemedText>
              </Pressable>
            ))}
          </>
        ) : null}

        {step === 'prepare' ? (
          <>
            <ThemedText type="small" style={styles.stepTag}>
              STEP 1 · 준비
            </ThemedText>
            <ThemedText type="subtitle">짐 챙기셨나요?</ThemedText>
            {selected ? (
              <ThemedText type="small" style={styles.dim}>
                {selected.name}
              </ThemedText>
            ) : null}
            <CheckItem label="휴대폰" checked={phone} onToggle={() => setPhone((v) => !v)} />
            <CheckItem label="운동복" checked={clothes} onToggle={() => setClothes((v) => !v)} />
            <PrimaryBtn label="준비 완료" onPress={() => setStep('depart')} />
          </>
        ) : null}

        {step === 'depart' ? (
          <>
            <ThemedText type="small" style={styles.stepTag}>
              STEP 2 · 출발
            </ThemedText>
            <ThemedText type="subtitle">지금 출발할까요?</ThemedText>
            <ThemedText type="default">파이팅! 한 걸음이면 도착이에요 🙌</ThemedText>
            <PrimaryBtn label="출발하기" onPress={() => setStep('arrive')} />
          </>
        ) : null}

        {step === 'arrive' ? (
          <>
            <ThemedText type="small" style={styles.stepTag}>
              STEP 3 · 도착
            </ThemedText>
            <ThemedText type="subtitle">센터에 거의 다 왔어요!</ThemedText>
            <ThemedText type="default">도착하면 체크인하세요. 방문이 기록돼요.</ThemedText>
            {error ? (
              <ThemedText type="small" style={styles.error}>
                체크인 실패: {(error as Error).message}
              </ThemedText>
            ) : null}
            <PrimaryBtn label="📍 도착 (체크인)" onPress={checkIn} loading={isPending} />
          </>
        ) : null}

        {step === 'done' ? (
          <>
            <ThemedText type="title">✅ 체크인 완료!</ThemedText>
            {selected ? (
              <ThemedText type="default">{selected.name} · 방문이 기록됐어요.</ThemedText>
            ) : null}
            <ThemedText type="small" style={styles.dim}>
              통계(이번 달 방문·위험도)가 갱신됩니다.
            </ThemedText>
            <PrimaryBtn label="확인" onPress={onClose} />
          </>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  body: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.four, gap: Spacing.three },
  stepTag: { opacity: 0.6 },
  dim: { opacity: 0.6 },
  error: { color: '#d33' },
  optionBtn: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.4)',
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.one },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#22c55e' },
  checkMark: { color: '#fff' },
  primary: {
    marginTop: Spacing.two,
    backgroundColor: '#22c55e',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryDim: { backgroundColor: '#bbb' },
  pressed: { opacity: 0.85 },
  primaryLabel: { color: '#fff' },
});
