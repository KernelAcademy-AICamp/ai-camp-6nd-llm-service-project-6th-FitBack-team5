import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
      } else if (!data.session) {
        setInfoMessage('확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요.');
      } else {
        logEvent(EVENTS.signup);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setErrorMessage(error.message);
    }
    setSubmitting(false);
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

        <View style={styles.devBox}>
          <ThemedText type="label" style={styles.devTitle}>
            테스트 계정 (개발용)
          </ThemedText>
          <ThemedText type="label" themeColor="textSecondary">
            이메일: {TEST_EMAIL || '(.env 미설정)'}
          </ThemedText>
          <ThemedText type="label" themeColor="textSecondary">
            비밀번호: {TEST_PASSWORD || '(.env 미설정)'}
          </ThemedText>
          {TEST_EMAIL && TEST_PASSWORD ? (
            <Pressable onPress={fillTestCredentials} style={styles.devButton}>
              <ThemedText type="label" style={styles.devButtonLabel}>
                입력란에 자동으로 채우기
              </ThemedText>
            </Pressable>
          ) : (
            <ThemedText type="label" themeColor="textSecondary" style={styles.devHint}>
              .env에 EXPO_PUBLIC_DEV_TEST_EMAIL / EXPO_PUBLIC_DEV_TEST_PASSWORD를 채우세요.
            </ThemedText>
          )}
        </View>
      </View>
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
});
