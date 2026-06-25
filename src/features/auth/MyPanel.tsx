import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react-native';
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
import { useMemberships } from '@/features/membership/useMemberships';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';

type MyView = 'main' | 'notify';
type FitnessGoal = 'fat_loss' | 'muscle_gain' | 'health' | 'body_shape' | 'habit';

const GOALS: { value: FitnessGoal; label: string }[] = [
  { value: 'fat_loss', label: '체중 감량' },
  { value: 'muscle_gain', label: '근력 향상' },
  { value: 'health', label: '건강 관리' },
  { value: 'body_shape', label: '체형 개선' },
  { value: 'habit', label: '습관 형성' },
];
const goalLabel = (g: string | null) => GOALS.find((x) => x.value === g)?.label ?? '-';

// 피해야 할 운동 부위 — exercises.contraindicated_parts 기준. 코치 운동 추천 회피에 사용.
const AVOID_PARTS = ['목', '어깨', '허리', '무릎', '손목'];
const genderLabel = (g: Gender | null) => (g === 'M' ? '남자' : g === 'F' ? '여자' : '-');
const APP_VERSION = '1.0.0 (beta)';

function joinedDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `가입일 : ${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

export function MyPanel({ onClose }: { onClose: () => void }) {
  const user = useCurrentUser();
  const uid = user?.id ?? '';
  const { data: profile } = useProfile();
  const { data: memberships } = useMemberships();
  const del = useDeleteAccountData();
  const qc = useQueryClient();

  const [view, setView] = useState<MyView>('main');
  const [showTerms, setShowTerms] = useState(false);
  const [withdrawStep, setWithdrawStep] = useState<'idle' | 'retention' | 'warning' | 'farewell'>('idle');

  // 운동 목표(user_preferences)
  const { data: goal } = useQuery<string | null>({
    queryKey: ['fitnessGoal', uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase.from('user_preferences').select('fitness_goal').eq('user_id', uid).maybeSingle();
      return (data as { fitness_goal: string | null } | null)?.fitness_goal ?? null;
    },
  });

  // 운동 가는 횟수(주당) — 활성 기간권의 주당 목표 최댓값
  const weeklyTarget = (memberships ?? [])
    .filter((m) => m.type === 'period' && m.status !== 'expired' && m.weeklyGoal)
    .reduce((mx, m) => Math.max(mx, m.weeklyGoal ?? 0), 0);

  // 내 정보 인라인 편집
  const [editInfo, setEditInfo] = useState(false);
  const [eAge, setEAge] = useState('');
  const [eGender, setEGender] = useState<Gender | null>(null);
  const [eHeight, setEHeight] = useState('');
  const [eWeight, setEWeight] = useState('');
  const [eAvoidParts, setEAvoidParts] = useState<string[]>([]);
  function startInfo() {
    setEAge(profile?.age != null ? String(profile.age) : '');
    setEGender(profile?.gender ?? null);
    setEHeight(profile?.height != null ? String(profile.height) : '');
    setEWeight(profile?.weight != null ? String(profile.weight) : '');
    setEAvoidParts(profile?.avoid_exercise_parts ?? []);
    setEditInfo(true);
  }
  const saveInfo = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('profiles')
        .update({
          age: eAge ? Number(eAge) : null,
          gender: eGender,
          height: eHeight ? Number(eHeight) : null,
          weight: eWeight ? Number(eWeight) : null,
          avoid_exercise_parts: eAvoidParts,
        })
        .eq('id', uid);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile', uid] });
      setEditInfo(false);
    },
  });

  // 목표 설정 인라인 편집
  const [editGoal, setEditGoal] = useState(false);
  const [eGoal, setEGoal] = useState<FitnessGoal | null>(null);
  const [eWeekly, setEWeekly] = useState('');
  function startGoal() {
    setEGoal((goal as FitnessGoal) ?? null);
    setEWeekly(weeklyTarget > 0 ? String(weeklyTarget) : '');
    setEditGoal(true);
  }
  const saveGoal = useMutation({
    mutationFn: async () => {
      if (eGoal) {
        const { error } = await supabase
          .from('user_preferences')
          .upsert({ user_id: uid, fitness_goal: eGoal }, { onConflict: 'user_id' });
        if (error) throw error;
      }
      if (eWeekly) {
        // 활성 기간권의 주당 목표 갱신(있을 때만)
        await supabase.from('memberships').update({ weekly_goal: Number(eWeekly) }).eq('user_id', uid).eq('type', 'period');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fitnessGoal', uid] });
      qc.invalidateQueries({ queryKey: ['memberships', uid] });
      setEditGoal(false);
    },
  });

  // 알림 설정
  const [notify, setNotify] = useState({ enabled: false, night: false });
  useEffect(() => {
    if (uid) getNotifySettings(uid).then((s) => setNotify({ enabled: s.enabled, night: s.night }));
  }, [uid]);
  async function toggleNotify(patch: Partial<{ enabled: boolean; night: boolean }>) {
    setNotify((n) => ({ ...n, ...patch }));
    await setNotifySettings(uid, patch);
  }

  function runWithdraw() {
    del.mutate(undefined, { onSuccess: () => setWithdrawStep('farewell') });
  }
  function finishWithdraw() {
    setWithdrawStep('idle');
    supabase.auth.signOut(); // 메인 로그인 전(랜딩) 화면으로 강제 이동
  }

  const name = profile?.display_name || '회원';
  const title = view === 'notify' ? '알림 설정' : '앱 설정';

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
          {view === 'main' ? (
            <>
              {/* 회원 정보 */}
              <Card>
                <ThemedText type="captionBold">{name}</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary" style={styles.profileEmail}>{user?.email ?? ''}</ThemedText>
                {profile?.created_at ? (
                  <ThemedText type="label" themeColor="textSecondary" style={styles.profileJoin}>{joinedDate(profile.created_at)}</ThemedText>
                ) : null}
              </Card>

              {/* 내 정보 수정 */}
              <Card>
                <Pressable onPress={() => (editInfo ? setEditInfo(false) : startInfo())} style={styles.cardHead} accessibilityRole="button">
                  <ThemedText type="captionBold">내 정보 수정</ThemedText>
                  <Icon icon={ChevronRight} size={18} color={Palette.gray300} />
                </Pressable>
                {!editInfo ? (
                  <View style={styles.infoRows}>
                    <Row label="나이" value={profile?.age != null ? `${profile.age}세` : '-'} />
                    <Row label="성별" value={genderLabel(profile?.gender ?? null)} />
                    <Row label="키" value={profile?.height != null ? `${profile.height} cm` : '-'} />
                    <Row label="몸무게" value={profile?.weight != null ? `${profile.weight} kg` : '-'} />
                    <Row
                      label="피해야 할 부위"
                      value={profile?.avoid_exercise_parts?.length ? profile.avoid_exercise_parts.join(', ') : '없음'}
                    />
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
                    <Field label="피해야 할 운동 부위 (선택)">
                      <View style={styles.goalGrid}>
                        {AVOID_PARTS.map((p) => {
                          const on = eAvoidParts.includes(p);
                          return (
                            <Pressable
                              key={p}
                              onPress={() =>
                                setEAvoidParts((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))
                              }
                              style={[styles.goalChip, on && styles.segOn]}>
                              <ThemedText type={on ? 'captionBold' : 'caption'} style={on ? styles.activeText : undefined}>
                                {p}
                              </ThemedText>
                            </Pressable>
                          );
                        })}
                      </View>
                    </Field>
                    <EditActions onCancel={() => setEditInfo(false)} onSave={() => saveInfo.mutate()} saving={saveInfo.isPending} />
                  </View>
                )}
              </Card>

              {/* 목표 설정 */}
              <Card>
                <Pressable onPress={() => (editGoal ? setEditGoal(false) : startGoal())} style={styles.cardHead} accessibilityRole="button">
                  <ThemedText type="captionBold">목표 설정</ThemedText>
                  <Icon icon={ChevronRight} size={18} color={Palette.gray300} />
                </Pressable>
                {!editGoal ? (
                  <View style={styles.infoRows}>
                    <Row label="운동 목표" value={goalLabel(goal ?? null)} />
                    <Row label="운동 가는 횟수" value={weeklyTarget > 0 ? `주 ${weeklyTarget}회` : '-'} />
                  </View>
                ) : (
                  <View style={styles.editWrap}>
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
                    <Field label="운동 가는 횟수 (주당)">
                      <TextInput value={eWeekly} onChangeText={(t) => setEWeekly(t.replace(/[^0-9]/g, ''))} keyboardType="numeric" placeholder="예: 3" placeholderTextColor={Palette.gray300} style={styles.input} />
                    </Field>
                    <EditActions onCancel={() => setEditGoal(false)} onSave={() => saveGoal.mutate()} saving={saveGoal.isPending} />
                  </View>
                )}
              </Card>

              {/* 알림 설정 진입 */}
              <Card>
                <Pressable onPress={() => setView('notify')} style={styles.navRow} accessibilityRole="button">
                  <Icon icon={Bell} size={16} color={Palette.gray500} />
                  <ThemedText type="caption" style={styles.navLabel}>알림 설정</ThemedText>
                  <Icon icon={ChevronRight} size={16} color={Palette.gray300} />
                </Pressable>
              </Card>

              {/* About */}
              <Card accentColor={Palette.primary}>
                <View style={styles.aboutHead}>
                  <Icon icon={Sparkles} size={16} color={Palette.primary} />
                  <ThemedText type="captionBold" style={{ color: Palette.primary }}>FitBack은 이렇게 일해요</ThemedText>
                </View>
                <ThemedText type="caption" themeColor="textSecondary">평가하지 않아요. 데이터를 보여주고, 다음 행동을 제안해요.</ThemedText>
              </Card>

              {/* 하단 회색 링크 */}
              <View style={styles.bottomLinks}>
                <Pressable onPress={() => setShowTerms(true)} style={styles.bottomLink} hitSlop={6}>
                  <ThemedText type="label" themeColor="textSecondary">약관 및 보안</ThemedText>
                </Pressable>
                <Pressable onPress={() => supabase.auth.signOut()} style={styles.bottomLink} hitSlop={6}>
                  <ThemedText type="label" themeColor="textSecondary">로그아웃</ThemedText>
                </Pressable>
                <Pressable onPress={() => setWithdrawStep('retention')} disabled={del.isPending} style={styles.bottomLink} hitSlop={6}>
                  <ThemedText type="label" themeColor="textSecondary">{del.isPending ? '처리 중…' : '회원 탈퇴'}</ThemedText>
                </Pressable>
              </View>
              <ThemedText type="label" themeColor="textSecondary" style={styles.version}>FitBack v{APP_VERSION}</ThemedText>
            </>
          ) : null}

          {/* 알림 설정 */}
          {view === 'notify' ? (
            <Card>
              <View style={styles.toggleRow}>
                <View style={styles.toggleText}>
                  <ThemedText type="caption">알람 수신</ThemedText>
                  <ThemedText type="label" themeColor="textSecondary">운동 리마인드·회원권 만료 알림</ThemedText>
                </View>
                <Switch value={notify.enabled} onValueChange={(v) => toggleNotify({ enabled: v })} trackColor={{ true: Palette.primary, false: Palette.gray300 }} />
              </View>
              <View style={styles.divider} />
              <View style={styles.toggleRow}>
                <View style={styles.toggleText}>
                  <ThemedText type="caption">야간 알람 수신</ThemedText>
                  <ThemedText type="label" themeColor="textSecondary">밤 시간대에도 알림을 받아요</ThemedText>
                </View>
                <Switch value={notify.night} onValueChange={(v) => toggleNotify({ night: v })} disabled={!notify.enabled} trackColor={{ true: Palette.primary, false: Palette.gray300 }} />
              </View>
            </Card>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      {/* 약관 및 보안 */}
      <Modal visible={showTerms} transparent animationType="fade" onRequestClose={() => setShowTerms(false)}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <ThemedText type="h2">약관 및 보안</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary" style={styles.dialogText}>
              FitBack은 서비스 제공·개선을 위해 최소한의 정보만 모으고, 내부에서 안전하게 보관해요.
            </ThemedText>
            <View style={styles.policyList}>
              <ThemedText type="caption">· 수집 항목: 이메일, 신체 정보(생년월일·성별·키·체중), 운동·회원권·식단 기록</ThemedText>
              <ThemedText type="caption">· 이용 목적: 회원권 활용도 분석·맞춤 코칭·서비스 개선</ThemedText>
              <ThemedText type="caption">· 보관·파기: 내부 안전 보관, 회원 탈퇴 시 관련 데이터 삭제</ThemedText>
            </View>
            <Pressable onPress={() => setShowTerms(false)} style={[styles.dialogBtn, styles.dialogPrimary]}>
              <ThemedText type="subtitle" style={{ color: Palette.white }}>확인</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

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
            <Pressable onPress={runWithdraw} disabled={del.isPending} style={[styles.dialogBtn, styles.dialogDanger, del.isPending && styles.pressed]}>
              <ThemedText type="subtitle" style={{ color: Palette.white }}>{del.isPending ? '처리 중…' : '네, 확인했습니다'}</ThemedText>
            </Pressable>
            <Pressable onPress={() => setWithdrawStep('idle')} style={styles.dialogGhost} hitSlop={6}>
              <ThemedText type="captionBold" themeColor="textSecondary">취소</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 탈퇴 3) 작별 → 랜딩 */}
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <ThemedText type="caption" themeColor="textSecondary">{label}</ThemedText>
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
function EditActions({ onCancel, onSave, saving }: { onCancel: () => void; onSave: () => void; saving: boolean }) {
  return (
    <View style={styles.editActions}>
      <Pressable onPress={onCancel} style={[styles.editBtn, styles.editCancel]}>
        <ThemedText type="captionBold" themeColor="textSecondary">취소</ThemedText>
      </Pressable>
      <Pressable onPress={onSave} disabled={saving} style={[styles.editBtn, styles.editSave]}>
        <ThemedText type="captionBold" style={{ color: Palette.white }}>{saving ? '저장 중…' : '저장'}</ThemedText>
      </Pressable>
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
  aboutHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: 4 },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  navLabel: { flex: 1 },
  profileEmail: { marginTop: Spacing.xs },
  profileJoin: { marginTop: Spacing.xs },
  bottomLinks: { alignItems: 'flex-start', gap: Spacing.md, marginTop: Spacing.lg },
  bottomLink: { paddingVertical: 2 },
  version: { marginTop: Spacing.sm },
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
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  toggleText: { flex: 1, gap: 2 },
  divider: { height: 0.5, backgroundColor: Palette.lineDefault, marginVertical: Spacing.md },
  pressed: { opacity: 0.6 },
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', alignItems: 'center', justifyContent: 'center', padding: ScreenPadding },
  dialog: { width: '100%', maxWidth: 360, backgroundColor: Palette.bgSurface, borderRadius: Radius.card, padding: Spacing.lg, gap: Spacing.sm },
  dialogText: { marginBottom: Spacing.sm },
  policyList: { gap: Spacing.xs, marginBottom: Spacing.sm },
  dialogBtn: { borderRadius: Radius.button, paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  dialogPrimary: { backgroundColor: Palette.primary },
  dialogDanger: { backgroundColor: Palette.loss },
  dialogGhost: { alignItems: 'center', paddingVertical: Spacing.sm },
});
