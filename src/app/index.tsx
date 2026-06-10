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
import { HomeDashboard } from '@/features/membership/HomeDashboard';
import { MembershipForm } from '@/features/membership/MembershipForm';
import {
  type Membership,
  type MembershipStatus,
  useMemberships,
} from '@/features/membership/useMemberships';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';

const statusLabels: Record<MembershipStatus, string> = {
  active: '사용중',
  expired: '만료',
};

function statusBadgeColor(status: MembershipStatus) {
  return status === 'active' ? '#22c55e' : '#9ca3af';
}

// PART 3(센터 이동 흐름)에서 마이크로 스텝으로 연결 예정. 지금은 안내만.
function notifyGoCenter() {
  const msg = '센터 가기 흐름은 다음 단계(PART 3)에서 연결됩니다.';
  if (Platform.OS === 'web') window.alert(msg);
  else Alert.alert('센터 가기', msg);
}

function MembershipCard({ item }: { item: Membership }) {
  // free(자유이용권)는 횟수 개념이 없다. session/class만 횟수를 노출.
  // 남은 횟수 = max_visits - 사용(visits) 수. useMemberships()에서 집계해 전달.
  const showVisits = item.type !== 'free';
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText type="subtitle">{item.name}</ThemedText>
        <View style={[styles.badge, { backgroundColor: statusBadgeColor(item.status) }]}>
          <ThemedText type="smallBold" style={styles.badgeText}>
            {statusLabels[item.status]}
          </ThemedText>
        </View>
      </View>
      {showVisits && (
        <ThemedText type="default">
          {item.maxVisits != null
            ? `남은 ${item.remainingVisits} / ${item.maxVisits}회`
            : '무제한'}
        </ThemedText>
      )}
      <ThemedText type="small">만료일 · {item.endDate}</ThemedText>
    </ThemedView>
  );
}

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
  const [showForm, setShowForm] = useState(false);
  const isEmpty = !isLoading && !isError && (memberships?.length ?? 0) === 0;

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
          {/* PART 2: 홈 대시보드 (현황 카드 + 이번달 통계 + 센터 가기) */}
          <HomeDashboard memberships={memberships ?? []} onGoCenter={notifyGoCenter} />

          <ThemedText type="subtitle" style={styles.listHeading}>
            회원권 목록
          </ThemedText>

          {isLoading && (
            <View style={styles.stateBox}>
              <ActivityIndicator />
            </View>
          )}
          {isError && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="default">회원권을 불러오지 못했어요.</ThemedText>
              <ThemedText type="small">{(error as Error)?.message ?? '알 수 없는 오류'}</ThemedText>
            </ThemedView>
          )}
          {isEmpty && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="default">등록된 회원권이 없어요.</ThemedText>
              <ThemedText type="small">오른쪽 위 “+ 회원권 추가”로 등록해 보세요.</ThemedText>
            </ThemedView>
          )}
          {memberships?.map((m) => (
            <MembershipCard key={m.id} item={m} />
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
  listHeading: { marginTop: Spacing.two },
  stateBox: {
    paddingVertical: Spacing.four,
    alignItems: 'center',
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.two,
  },
  badgeText: { color: '#fff' },
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
