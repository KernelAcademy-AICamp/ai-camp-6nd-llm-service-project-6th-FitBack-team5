import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { CheckInFlow } from '@/features/membership/CheckInFlow';
import { computeRisk, sortByRisk, summarize, type RiskInfo } from '@/features/membership/dashboard';
import { MembershipDetail } from '@/features/membership/MembershipDetail';
import { MembershipForm } from '@/features/membership/MembershipForm';
import { MembershipStatsCard, SummaryHeader } from '@/features/membership/MembershipStatsCard';
import { type Membership, useMemberships } from '@/features/membership/useMemberships';
import { useMonthlyStats } from '@/features/membership/useMonthlyStats';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';

function AuthFooter() {
  const user = useCurrentUser();
  async function handleSignOut() {
    await supabase.auth.signOut();
  }
  return (
    <ThemedView type="backgroundElement" style={styles.authFooter}>
      <ThemedText type="small" style={styles.authEmail}>
        {user?.email ?? '(no session)'}
      </ThemedText>
      <Pressable
        onPress={handleSignOut}
        style={({ pressed }) => [styles.authButton, pressed && styles.authButtonPressed]}>
        <ThemedText type="small">로그아웃</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

export default function MembershipScreen() {
  const { data: memberships, isLoading, isError, error } = useMemberships();
  const { data: stats } = useMonthlyStats();
  const [showForm, setShowForm] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [detail, setDetail] = useState<{
    m: Membership;
    risk: RiskInfo;
    monthlyVisits: number;
  } | null>(null);

  const list = memberships ?? [];
  const visitsOf = (id: string) => stats?.byMembership[id] ?? 0;
  const withRisk = list.map((m) => ({
    m,
    risk: computeRisk(m, visitsOf(m.id)),
    visits: visitsOf(m.id),
  }));
  const sorted = sortByRisk(withRisk, (x) => x.risk); // spec: 위험순 정렬
  const summary = summarize(
    withRisk.map((x) => ({ risk: x.risk, monthlyVisits: x.visits, name: x.m.name })),
  );
  const isEmpty = !isLoading && !isError && list.length === 0;

  function handleGoCenter() {
    if (list.length === 0) {
      const msg = '먼저 회원권을 등록해 주세요.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('센터 가기', msg);
      return;
    }
    setShowCheckIn(true);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.titleRow}>
          <ThemedText type="title">내 회원권</ThemedText>
          <Pressable
            onPress={() => setShowForm(true)}
            style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}>
            <ThemedText type="smallBold" style={styles.addButtonLabel}>
              + 회원권 추가
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {/* spec 4-A 요약 헤더: 집계 + 비율막대 + 히어로 금액 + 보조 줄 + 센터 가기 CTA */}
          {!isLoading && !isError && list.length > 0 ? (
            <SummaryHeader summary={summary} count={list.length} onGoCenter={handleGoCenter} />
          ) : null}

          {isLoading && (
            <View style={styles.stateBox}>
              <ActivityIndicator />
            </View>
          )}
          {isError && (
            <ThemedView type="backgroundElement" style={styles.stateCard}>
              <ThemedText type="default">회원권을 불러오지 못했어요.</ThemedText>
              <ThemedText type="small">{(error as Error)?.message ?? '알 수 없는 오류'}</ThemedText>
            </ThemedView>
          )}
          {isEmpty && (
            <ThemedView type="backgroundElement" style={styles.stateCard}>
              <ThemedText type="default">등록된 회원권이 없어요.</ThemedText>
              <ThemedText type="small">오른쪽 위 “+ 회원권 추가”로 등록해 보세요.</ThemedText>
            </ThemedView>
          )}

          {/* 위험순 회원권 카드 */}
          {sorted.map((x) => (
            <MembershipStatsCard
              key={x.m.id}
              m={x.m}
              risk={x.risk}
              monthlyVisits={x.visits}
              onPress={() => setDetail({ m: x.m, risk: x.risk, monthlyVisits: x.visits })}
            />
          ))}
        </ScrollView>

        <AuthFooter />
      </SafeAreaView>

      <Modal
        visible={showForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowForm(false)}>
        <ThemedView style={styles.modalRoot}>
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            <MembershipForm onClose={() => setShowForm(false)} />
          </SafeAreaView>
        </ThemedView>
      </Modal>

      <Modal
        visible={showCheckIn}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCheckIn(false)}>
        <ThemedView style={styles.modalRoot}>
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            <CheckInFlow memberships={list} onClose={() => setShowCheckIn(false)} />
          </SafeAreaView>
        </ThemedView>
      </Modal>

      <Modal
        visible={!!detail}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetail(null)}>
        <ThemedView style={styles.modalRoot}>
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            {detail ? (
              <MembershipDetail
                m={detail.m}
                risk={detail.risk}
                monthlyVisits={detail.monthlyVisits}
                onClose={() => setDetail(null)}
              />
            ) : null}
          </SafeAreaView>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.three,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: '#111',
  },
  addButtonPressed: { opacity: 0.8 },
  addButtonLabel: { color: '#fff' },
  list: {
    gap: Spacing.three,
    paddingBottom: Spacing.three,
  },
  stateBox: {
    paddingVertical: Spacing.four,
    alignItems: 'center',
  },
  stateCard: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.two,
  },
  authFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    gap: Spacing.three,
  },
  authEmail: { flex: 1 },
  authButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.4)',
  },
  authButtonPressed: { opacity: 0.6 },
  modalRoot: { flex: 1 },
  modalSafe: { flex: 1 },
});
