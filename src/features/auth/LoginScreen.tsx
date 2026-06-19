import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Elevation, Palette, Radius, ScreenPadding, Spacing } from '@/constants/theme';
import { EVENTS, logEvent } from '@/features/analytics/events';
import { supabase } from '@/lib/supabase';

const TEST_EMAIL = process.env.EXPO_PUBLIC_DEV_TEST_EMAIL ?? '';
const TEST_PASSWORD = process.env.EXPO_PUBLIC_DEV_TEST_PASSWORD ?? '';

type Mode = 'login' | 'signup';

export function LoginScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [showSignupDone, setShowSignupDone] = useState(false);
  const [signupNeedsConfirm, setSignupNeedsConfirm] = useState(false);

  const isSignup = mode === 'signup';
  const passwordOk = password.length >= 6;
  const canSubmit =
    !submitting && email.length > 0 && password.length > 0 && (!isSignup || passwordOk);

  async function handleSubmit() {
    setErrorMessage(null);
    setInfoMessage(null);
    setSubmitting(true);
    if (isSignup) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setErrorMessage(error.message);
      } else {
        logEvent(EVENTS.signup);
        // 자동 로그인 세션이 생겼으면 해제 → 로그인 페이지에서 직접 로그인하도록.
        setSignupNeedsConfirm(!data.session);
        if (data.session) await supabase.auth.signOut();
        setShowSignupDone(true);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setErrorMessage(error.message);
    }
    setSubmitting(false);
  }

  // 가입 완료 팝업 닫기 → 로그인 모드로 전환(이메일 유지, 비번 비움)
  function closeSignupDone() {
    setShowSignupDone(false);
    setMode('login');
    setPassword('');
    setErrorMessage(null);
    setInfoMessage(null);
  }

  function toggleMode() {
    setMode((m) => (m === 'login' ? 'signup' : 'login'));
    setErrorMessage(null);
    setInfoMessage(null);
  }

  function fillTestCredentials() {
    setEmail(TEST_EMAIL);
    setPassword(TEST_PASSWORD);
    setErrorMessage(null);
    setInfoMessage(null);
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <ThemedText type="h1">{isSignup ? 'FitBack 회원가입' : 'FitBack 로그인'}</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary" style={styles.subtitle}>
          {isSignup
            ? '이메일과 비밀번호로 새 계정을 만드세요.'
            : '이메일과 비밀번호로 로그인하세요.'}
        </ThemedText>

        <ThemedText type="label" themeColor="textSecondary" style={styles.fieldLabel}>
          이메일
        </ThemedText>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={Palette.gray300}
          style={styles.input}
        />

        <ThemedText type="label" themeColor="textSecondary" style={styles.fieldLabel}>
          비밀번호
        </ThemedText>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          placeholder="6자 이상"
          placeholderTextColor={Palette.gray300}
          style={styles.input}
          onSubmitEditing={canSubmit ? handleSubmit : undefined}
        />
        {isSignup && password.length > 0 && !passwordOk && (
          <ThemedText type="label" style={styles.hint}>
            비밀번호는 6자 이상이어야 해요.
          </ThemedText>
        )}

        {errorMessage && (
          <ThemedText type="caption" style={styles.error}>
            {errorMessage}
          </ThemedText>
        )}
        {infoMessage && (
          <ThemedText type="caption" style={styles.info}>
            {infoMessage}
          </ThemedText>
        )}

        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.button,
            !canSubmit && styles.buttonDisabled,
            pressed && canSubmit && styles.buttonPressed,
          ]}>
          {submitting ? (
            <ActivityIndicator color={Palette.white} />
          ) : (
            <ThemedText type="subtitle" style={styles.buttonLabel}>
              {isSignup ? '회원가입' : '로그인'}
            </ThemedText>
          )}
        </Pressable>

        <Pressable onPress={toggleMode} style={styles.switchRow} hitSlop={6}>
          <ThemedText type="captionBold" style={styles.switchText}>
            {isSignup ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
          </ThemedText>
        </Pressable>

        {/* 테스트 계정 — 개발 빌드에서만 노출(배포/프로덕션 숨김) */}
        {__DEV__ && TEST_EMAIL && TEST_PASSWORD ? (
          <View style={styles.devBox}>
            <ThemedText type="label" style={styles.devTitle}>
              테스트 계정 (개발용)
            </ThemedText>
            <ThemedText type="label" themeColor="textSecondary">
              이메일: {TEST_EMAIL}
            </ThemedText>
            <ThemedText type="label" themeColor="textSecondary">
              비밀번호: {TEST_PASSWORD}
            </ThemedText>
            <Pressable onPress={fillTestCredentials} style={styles.devButton}>
              <ThemedText type="label" style={styles.devButtonLabel}>
                입력란에 자동으로 채우기
              </ThemedText>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* 가입 완료 팝업 → 로그인 페이지로 전환 */}
      <Modal visible={showSignupDone} transparent animationType="fade" onRequestClose={closeSignupDone}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ThemedText type="h2">가입 완료</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary" style={styles.modalText}>
              {signupNeedsConfirm
                ? '확인 메일을 보냈어요. 메일 인증 후 로그인해 주세요.'
                : '회원가입이 완료됐어요. 방금 만든 계정으로 로그인해 주세요.'}
            </ThemedText>
            <Pressable onPress={closeSignupDone} style={styles.modalButton}>
              <ThemedText type="subtitle" style={styles.buttonLabel}>
                로그인하러 가기
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: ScreenPadding,
    backgroundColor: Palette.bgBase,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Palette.bgSurface,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    gap: Spacing.xs,
    ...Elevation.level1,
  },
  subtitle: { marginBottom: Spacing.sm },
  fieldLabel: { marginTop: Spacing.sm },
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
  hint: { color: Palette.warning, marginTop: Spacing.xs },
  button: {
    marginTop: Spacing.md,
    backgroundColor: Palette.primary,
    borderRadius: Radius.button,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  buttonDisabled: { backgroundColor: Palette.gray300 },
  buttonPressed: { backgroundColor: Palette.primaryPressed },
  buttonLabel: { color: Palette.white },
  error: { color: Palette.error, marginTop: Spacing.xs },
  info: { color: Palette.success, marginTop: Spacing.xs },
  switchRow: { marginTop: Spacing.sm, alignItems: 'center' },
  switchText: { color: Palette.primary },
  devBox: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: Radius.small,
    backgroundColor: Palette.primaryLight,
    borderWidth: 1,
    borderColor: Palette.lineDefault,
    gap: Spacing.xs,
  },
  devTitle: { color: Palette.gray700 },
  devButton: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: Radius.small,
    backgroundColor: Palette.bgSurface,
  },
  devButtonLabel: { color: Palette.primary },
  devHint: { marginTop: Spacing.xs },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: ScreenPadding,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Palette.bgSurface,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...Elevation.level2,
  },
  modalText: { marginBottom: Spacing.sm },
  modalButton: {
    backgroundColor: Palette.primary,
    borderRadius: Radius.button,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
});
