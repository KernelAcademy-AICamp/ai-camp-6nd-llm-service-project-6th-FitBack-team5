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
import { Elevation, Radius, ScreenPaddingX, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

const TEST_EMAIL = process.env.EXPO_PUBLIC_DEV_TEST_EMAIL ?? '';
const TEST_PASSWORD = process.env.EXPO_PUBLIC_DEV_TEST_PASSWORD ?? '';

export function LoginScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = !submitting && email.length > 0 && password.length > 0;

  async function handleLogin() {
    setErrorMessage(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) setErrorMessage(error.message);
  }

  function fillTestCredentials() {
    setEmail(TEST_EMAIL);
    setPassword(TEST_PASSWORD);
    setErrorMessage(null);
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View
        style={[
          styles.card,
          { backgroundColor: theme.backgroundElement, borderColor: theme.lineDefault },
          Elevation.level1,
        ]}>
        <ThemedText type="title">FitBack 로그인</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          개발용 화면이에요. 아래 테스트 계정으로 들어와주세요.
        </ThemedText>

        <ThemedText type="smallBold" style={styles.label}>
          이메일
        </ThemedText>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="dev@fitback.local"
          placeholderTextColor={theme.textDisabled}
          style={[
            styles.input,
            {
              backgroundColor: theme.backgroundMuted,
              color: theme.text,
              borderColor: theme.lineDefault,
            },
          ]}
        />

        <ThemedText type="smallBold" style={styles.label}>
          비밀번호
        </ThemedText>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          placeholder="••••••••"
          placeholderTextColor={theme.textDisabled}
          style={[
            styles.input,
            {
              backgroundColor: theme.backgroundMuted,
              color: theme.text,
              borderColor: theme.lineDefault,
            },
          ]}
          onSubmitEditing={canSubmit ? handleLogin : undefined}
        />

        {errorMessage && (
          <ThemedText type="small" themeColor="error" style={styles.error}>
            {errorMessage}
          </ThemedText>
        )}

        <Pressable
          onPress={handleLogin}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: !canSubmit
                ? theme.textDisabled
                : pressed
                  ? theme.primaryPressed
                  : theme.primary,
            },
          ]}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText type="smallBold" style={styles.buttonLabel}>
              로그인
            </ThemedText>
          )}
        </Pressable>

        <View style={[styles.devBox, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold" themeColor="textBody">
            테스트 계정 (개발용)
          </ThemedText>
          <ThemedText type="small" themeColor="textBody" style={styles.devText}>
            이메일: {TEST_EMAIL || '(.env 미설정)'}
          </ThemedText>
          <ThemedText type="small" themeColor="textBody" style={styles.devText}>
            비밀번호: {TEST_PASSWORD || '(.env 미설정)'}
          </ThemedText>
          {TEST_EMAIL && TEST_PASSWORD ? (
            <Pressable
              onPress={fillTestCredentials}
              style={({ pressed }) => [
                styles.devButton,
                { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
              ]}>
              <ThemedText type="smallBold" style={styles.buttonLabel}>
                입력란에 자동 채우기
              </ThemedText>
            </Pressable>
          ) : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.devHint}>
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
    paddingHorizontal: ScreenPaddingX,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  subtitle: {
    marginBottom: Spacing.md,
  },
  label: {
    marginTop: Spacing.sm,
  },
  input: {
    height: 52,
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  error: {
    marginTop: Spacing.xs,
  },
  button: {
    marginTop: Spacing.md,
    height: 52,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  devBox: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: Radius.small,
    gap: Spacing.xs,
  },
  devText: {
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
  },
  devButton: {
    marginTop: Spacing.sm,
    height: 36,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devHint: {
    marginTop: Spacing.xs,
  },
});
