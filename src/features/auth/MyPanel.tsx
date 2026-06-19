import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, ChevronLeft, ChevronRight, LogOut, Ruler, Settings, Sparkles, Target, Trash2, User, Weight, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, Icon } from '@/components/ui';
import { Palette, Radius, ScreenPadding, Spacing } from '@/constants/theme';
import { useDeleteAccountData } from '@/features/auth/useDeleteAccountData';
import { useProfile, type Gender } from '@/features/auth/useProfile';
import { getNotifySettings, setNotifySettings } from '@/features/home/notifySettings';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';

type MyView = 'main' | 'account' | 'notify';
type FitnessGoal = 'fat_loss' | 'muscle_gain' | 'health' | 'body_shape' | 'habit';

const GOALS: { value: FitnessGoal; label: string }[] = [
  { value: 'fat_loss', label: '체중 감량' },
  { value: 'muscle_gain', label: '근력 향상' },
  { value: 'health', label: '건강 관리' },
  { value: 'body_shape', label: '체형 개선' },
  { value: 'habit', label: '습관 형성' },
];
const goalLabel = (g: string | null) => GOALS.find((x) => x.value === g)?.label ?? '-';
const genderLabel = (g: Gender | null) => (g === 'M' ? '남자' : g === 'F' ? '여자' : '-');

const APP_VERSION = '1.0.0 (beta)';

export function MyPanel({ onClose }: { onClose: () => void }) {
  const user = useCurrentUser();
  const uid = user?.id ?? '';
  const { data: profile } = useProfile();
  const del = useDeleteAccountData();
  const qc = useQueryClient();

  const [view, setView] = useState<MyView>('main');

  // 운동 목표(user_preferences)
  const { data: goal } = useQuery<string | null>({
    queryKey: ['fitnessGoal', uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase.from('user_preferences').select('fitness_goal').eq('user_id', uid).maybeSingle();
      return (data as { fitness_goal: string | null } | null)?.fitness_goal ?? null;
    },
  });

  // 내 정보 인라인 편집
  const [editing, setEditing] = useState(false);
  const [eAge, setEAge] = useState('');
  const [eGender, setEGender] = useState<Gender | null>(null);
  const [eHeight, setEHeight] = useState('');
  const [eWeight, setEWeight] = useState('');
  const [eGoal, setEGoal] = useState<FitnessGoal | null>(null);

  function startEdit() {
    setEAge(profile?.age != null ? String(profile.age) : '');
    setEGender(profile?.gender ?? null);
    setEHeight(profile?.height != null ? String(profile.height) : '');
    setEWeight(profile?.weight != null ? String(profile.weight) : '');
    setEGoal((goal as FitnessGoal) ?? null);
    setEditing(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('profiles')
        .update({
          age: eAge ? Number(eAge) : null,
          gender: eGender,
          height: eHeight ? Number(eHeight) : null,
          weight: eWeight ? Number(eWeight) : null,
        })
        .eq('id', uid);
      if (error) throw error;
      if (eGoal) {
        const { error: gErr } = await supabase
          .from('user_preferences')
          .upsert({ user_id: uid, fitness_goal: eGoal }, { onConflict: 'user_id' });
        if (gErr) throw gErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile', uid] });
      qc.invalidateQueries({ queryKey: ['fitnessGoal', uid] });
      setEditing(false);
    },
  });

  // 알림 설정
  const [notify, setNotify] = useState({ enabled: false, night: false });
  useEffect(() => {
    if (uid) getNotifySettings(uid).then((s) => setNotify({ enabled: s.enabled, night: s.night }));
  }, [uid]);
  async function toggleNotify(patch: Partial<{ enabled: boolean; night: boolean }>) {
    const next = { ...notify, ...patch };
    setNotify(next);
    await setNotifySettings(uid, patch);
  }

  // 탈퇴 3단계: 붙잡기 → 경고 → 작별 → 로그아웃(랜딩으로)
  const [withdrawStep, setWithdrawStep] = useState<'idle' | 'retention' | 'warning' | 'farewell'>('idle');

  function runWithdraw() {
    del.mutate(undefined, { onSuccess: () => setWithdrawStep('farewell') });
  }
  function finishWithdraw() {
    setWithdrawStep('idle');
    supabase.auth.signOut(); // 메인 로그인 전(랜딩) 화면으로 강제 이동
  }

  const name = profile?.display_name || '회원';
  const title = view === 'account' ? '계정 설정' : view === 'notify' ? '알림 설정' : '마이';

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          {view === 'main' ? (
            <ThemedText type="h2">{title}</ThemedText>
          ) : (
            <Pressable onPress={() => setView('main')} style={styles.backRow} hitSlop={8} accessibilityRole="button">
              <Icon icon={ChevronLeft} size={20} color={Palette.gray700} />
              <ThemedText type="h2">{title}</ThemedText>
            </Pressable>
          )}
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="닫기">
            <Icon icon={X} size={22} color={Palette.gray500} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* ── 메인 ── */}
          {view === 'main' ? (
            <>
              <Card>
                <ThemedText type="h2">{name}</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">{user?.email ?? ''}</ThemedText>
              </Card>

              {/* 내 정보 — 인라인 편집 */}
              <Card>
                <View style={styles.cardHead}>
                  <ThemedText type="captionBold">내 정보</ThemedText>
                  {!editing ? (
                    <Pressable onPress={startEdit} hitSlop={6}>
                      <ThemedText type="captionBold" style={{ color: Palette.primary }}>수정</ThemedText>
                    </Pressable>
                  ) : null}
                </View>

                {!editing ? (
                  <View style={styles.infoRows}>
                    <Row icon={User} label="나이" value={profile?.age != null ? `${profile.age}세` : '-'} />
                    <Row label="성별" value={genderLabel(profile?.gender ?? null)} />
                    <Row icon={Ruler} label="키" value={profile?.height != null ? `${profile.height} cm` : '-'} />
                    <Row icon={Weight} label="몸무게" value={profile?.weight != null ? `${profile.weight} kg` : '-'} />
                    <Row icon={Target} label="운동 목표" value={goalLabel(goal ?? null)} />
                  </View>
                ) : (
                  <View style={styles.editWrap}>
                    <Field label="나이">
                      <TextInput value={eAge} onChangeText={(t) => setEAge(t.replace(/[^0-9]/g, ''))} keyboardType="numeric" placeholder="예: 30" placeholderTextColor={Palette.gray300} style={styles.input} />
                    </Field>
                    <Field label="성별">
                      <View style={styles.segmentRow}>
                        {(['F', 'M'] as Gender[]).map((g) => {
                          const on = eGender === g;
                          return (
                            <Pressable key={g} onPress={() => setEGender(g)} style={[styles.segment, on && styles.segOn]}>
                              <ThemedText type={on ? 'captionBold' : 'caption'} style={on ? styles.activeText : undefined}>{g === 'F' ? '여자' : '남자'}</ThemedText>
                            </Pressable>
                          );
                        })}
                      </View>
                    </Field>
                    <Field label="키 (cm)">
                      <TextInput value={eHeight} onChangeText={(t) => setEHeight(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="예: 168" placeholderTextColor={Palette.gray300} style={styles.input} />
                    </Field>
                    <Field label="몸무게 (kg)">
                      <TextInput value={eWeight} onChangeText={(t) => setEWeight(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="예: 58" placeholderTextColor={Palette.gray300} style={styles.input} />
                    </Field>
                    <Field label="운동 목표">
                      <View style={styles.goalGrid}>
                        {GOALS.map((g) => {
                          const on = eGoal === g.value;
                          return (
                            <Pressable key={g.value} onPress={() => setEGoal((v) => (v === g.value ? null : g.value))} style={[styles.goalChip, on && styles.segOn]}>
                              <ThemedText type={on ? 'captionBold' : 'caption'} style={on ? styles.activeText : undefined}>{g.label}</ThemedText>
                            </Pressable>
                          );
                        })}
                      </View>
                    </Field>
                    <View style={styles.editActions}>
                      <Pressable onPress={() => setEditing(false)} style={[styles.editBtn, styles.editCancel]}>
                        <ThemedText type="captionBold" themeColor="textSecondary">취소</ThemedText>
                      </Pressable>
                      <Pressable onPress={() => save.mutate()} disabled={save.isPending} style={[styles.editBtn, styles.editSave]}>
                        <ThemedText type="captionBold" style={{ color: Palette.white }}>{save.isPending ? '저장 중…' : '저장'}</ThemedText>
                      </Pressable>
                    </View>
                  </View>
                )}
              </Card>

              {/* About */}
              <Card accentColor={Palette.primary}>
                <View style={styles.aboutHead}>
                  <Icon icon={Sparkles} size={16} color={Palette.primary} />
                  <ThemedText type="captionBold" style={{ color: Palette.primary }}>FitBack은 이렇게 일해요</ThemedText>
                </View>
                <ThemedText type="caption" themeColor="textSecondary">평가하지 않아요. 데이터를 보여주고, 다음 행동을 제안해요.</ThemedText>
              </Card>

              {/* 알림 설정 진입 */}
              <Card>
                <Pressable onPress={() => setView('notify')} style={styles.navRow} accessibilityRole="button">
                  <Icon icon={Bell} size={16} color={Palette.gray500} />
                  <ThemedText type="caption" style={styles.navLabel}>알림 설정</ThemedText>
                  <Icon icon={ChevronRight} size={16} color={Palette.gray300} />
                </Pressable>
              </Card>

              {/* 계정 설정 진입 */}
              <Card>
                <Pressable onPress={() => setView('account')} style={styles.navRow} accessibilityRole="button">
                  <Icon icon={Settings} size={16} color={Palette.gray500} />
                  <ThemedText type="caption" style={styles.navLabel}>계정 설정</ThemedText>
                  <Icon icon={ChevronRight} size={16} color={Palette.gray300} />
                </Pressable>
              </Card>

              <ThemedText type="label" themeColor="textSecondary" style={styles.version}>FitBack v{APP_VERSION}</ThemedText>
            </>
          ) : null}

          {/* ── 계정 설정 ── */}
          {view === 'account' ? (
            <>
              <Card>
                <ThemedText type="captionBold">로그인 정보</ThemedText>
                <View style={styles.infoRows}>
                  <Row label="이메일" value={user?.email ?? '-'} />
                  <Row label="로그인 방식" value="이메일" />
                </View>
              </Card>
              <Pressable
                onPress={() => supabase.auth.signOut()}
                style={({ pressed }) => [styles.logoutBtn, pressed && styles.pressed]}
                accessibilityRole="button">
                <Icon icon={LogOut} size={16} color={Palette.gray500} />
                <ThemedText type="caption" themeColor="textSecondary">로그아웃</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setWithdrawStep('retention')}
                disabled={del.isPending}
                style={({ pressed }) => [styles.withdrawBtn, pressed && styles.pressed]}
                accessibilityRole="button">
                <Icon icon={Trash2} size={13} color={Palette.gray400} />
                <ThemedText type="label" themeColor="textSecondary">{del.isPending ? '처리 중…' : '회원 탈퇴'}</ThemedText>
              </Pressable>
            </>
          ) : null}

          {/* ── 알림 설정 ── */}
          {view === 'notify' ? (
            <Card>
              <View style={styles.toggleRow}>
                <View style={styles.toggleText}>
                  <ThemedText type="caption">알람 수신</ThemedText>
                  <ThemedText type="label" themeColor="textSecondary">운동 리마인드·회원권 만료 알림</ThemedText>
                </View>
                <Switch
                  value={notify.enabled}
                  onValueChange={(v) => toggleNotify({ enabled: v })}
                  trackColor={{ true: Palette.primary, false: Palette.gray300 }}
                />
              </View>
              <View style={styles.divider} />
              <View style={styles.toggleRow}>
                <View style={styles.toggleText}>
                  <ThemedText type="caption">야간 알람 수신</ThemedText>
                  <ThemedText type="label" themeColor="textSecondary">밤 시간대에도 알림을 받아요</ThemedText>
                </View>
                <Switch
                  value={notify.night}
                  onValueChange={(v) => toggleNotify({ night: v })}
                  disabled={!notify.enabled}
                  trackColor={{ true: Palette.primary, false: Palette.gray300 }}
                />
              </View>
            </Card>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      {/* 탈퇴 1) 붙잡기 */}
      <Modal visible={withdrawStep === 'retention'} transparent animationType="fade" onRequestClose={() => setWithdrawStep('idle')}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <ThemedText type="h2">정말 탈퇴하시겠어요?</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary" style={styles.dialogText}>
              그동안 쌓인 회원권·운동 기록이 모두 사라져요. 잠깐 쉬어가도 괜찮아요.
            </ThemedText>
            <Pressable onPress={() => setWithdrawStep('idle')} style={[styles.dialogBtn, styles.dialogPrimary]}>
              <ThemedText type="subtitle" style={{ color: Palette.white }}>더 써볼게요</ThemedText>
            </Pressable>
            <Pressable onPress={() => setWithdrawStep('warning')} style={styles.dialogGhost} hitSlop={6}>
              <ThemedText type="captionBold" themeColor="textSecondary">탈퇴</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 탈퇴 2) 경고 */}
      <Modal visible={withdrawStep === 'warning'} transparent animationType="fade" onRequestClose={() => setWithdrawStep('idle')}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <ThemedText type="h2">탈퇴 전 확인해주세요</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary" style={styles.dialogText}>
              회원권·방문·기록 등 모든 데이터가 삭제되고 되돌릴 수 없어요. 다시 로그인하면 처음부터 시작해요.
            </ThemedText>
            <Pressable
              onPress={runWithdraw}
              disabled={del.isPending}
              style={[styles.dialogBtn, styles.dialogDanger, del.isPending && styles.pressed]}>
              <ThemedText type="subtitle" style={{ color: Palette.white }}>
                {del.isPending ? '처리 중…' : '네, 확인했습니다'}
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => setWithdrawStep('idle')} style={styles.dialogGhost} hitSlop={6}>
              <ThemedText type="captionBold" themeColor="textSecondary">취소</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 탈퇴 3) 작별 → 랜딩 이동 */}
      <Modal visible={withdrawStep === 'farewell'} transparent animationType="fade" onRequestClose={finishWithdraw}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <ThemedText type="h2">{name}님, 우리 다시 볼 수 있겠죠?</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary" style={styles.dialogText}>
              그동안 함께해서 고마웠어요. 언제든 다시 돌아오세요.
            </ThemedText>
            <Pressable onPress={finishWithdraw} style={[styles.dialogBtn, styles.dialogPrimary]}>
              <ThemedText type="subtitle" style={{ color: Palette.white }}>확인</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

function Row({ icon, label, value }: { icon?: React.ComponentProps<typeof Icon>['icon']; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoRowLeft}>
        {icon ? <Icon icon={icon} size={16} color={Palette.gray500} /> : null}
        <ThemedText type="caption" themeColor="textSecondary">{label}</ThemedText>
      </View>
      <ThemedText type="captionBold">{value}</ThemedText>
    </View>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText type="label" themeColor="textSecondary">{label}</ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.bgBase },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ScreenPadding,
    paddingVertical: Spacing.md,
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  body: { paddingHorizontal: ScreenPadding, paddingBottom: Spacing.xl, gap: Spacing.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoRows: { gap: Spacing.sm, marginTop: Spacing.sm },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoRowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  aboutHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: 4 },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  navLabel: { flex: 1 },
  version: { textAlign: 'center', marginTop: Spacing.sm },
  editWrap: { gap: Spacing.md, marginTop: Spacing.sm },
  field: { gap: Spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: Palette.lineDefault,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    color: Palette.gray900,
    backgroundColor: Palette.gray50,
    minHeight: 44,
  },
  segmentRow: { flexDirection: 'row', gap: Spacing.sm },
  segment: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.small, backgroundColor: Palette.gray100 },
  segOn: { backgroundColor: Palette.primaryLight },
  activeText: { color: Palette.primary },
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  goalChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full, backgroundColor: Palette.gray100 },
  editActions: { flexDirection: 'row', gap: Spacing.sm },
  editBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, borderRadius: Radius.button, minHeight: 44 },
  editCancel: { backgroundColor: Palette.gray100 },
  editSave: { backgroundColor: Palette.primary },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Palette.lineStrong,
  },
  withdrawBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: Spacing.md },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  toggleText: { flex: 1, gap: 2 },
  divider: { height: 0.5, backgroundColor: Palette.lineDefault, marginVertical: Spacing.md },
  pressed: { opacity: 0.6 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: ScreenPadding,
  },
  dialog: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Palette.bgSurface,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  dialogText: { marginBottom: Spacing.sm },
  dialogBtn: { borderRadius: Radius.button, paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  dialogPrimary: { backgroundColor: Palette.primary },
  dialogDanger: { backgroundColor: Palette.loss },
  dialogGhost: { alignItems: 'center', paddingVertical: Spacing.sm },
});
