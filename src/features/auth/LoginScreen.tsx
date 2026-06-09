import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';

const TEST_EMAIL = process.env.EXPO_PUBLIC_DEV_TEST_EMAIL ?? '';
const TEST_PASSWORD = process.env.EXPO_PUBLIC_DEV_TEST_PASSWORD ?? '';

export function LoginScreen() {
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
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.title}>FitBack 로그인</Text>
        <Text style={styles.subtitle}>개발용 화면 — 테스트 계정으로만 로그인됩니다.</Text>

        <Text style={styles.label}>이메일</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="dev@fitback.local"
          placeholderTextColor="#aab"
          style={styles.input}
        />

        <Text style={styles.label}>비밀번호</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          placeholder="••••••••"
          placeholderTextColor="#aab"
          style={styles.input}
          onSubmitEditing={canSubmit ? handleLogin : undefined}
        />

        {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

        <Pressable
          onPress={handleLogin}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.button,
            !canSubmit && styles.buttonDisabled,
            pressed && canSubmit && styles.buttonPressed,
          ]}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonLabel}>로그인</Text>
          )}
        </Pressable>

        <View style={styles.devBox}>
          <Text style={styles.devTitle}>테스트 계정 (개발용)</Text>
          <Text style={styles.devText}>이메일: {TEST_EMAIL || '(.env 미설정)'}</Text>
          <Text style={styles.devText}>
            비밀번호: {TEST_PASSWORD || '(.env 미설정)'}
          </Text>
          {TEST_EMAIL && TEST_PASSWORD ? (
            <Pressable onPress={fillTestCredentials} style={styles.devButton}>
              <Text style={styles.devButtonLabel}>입력란에 자동으로 채우기</Text>
            </Pressable>
          ) : (
            <Text style={styles.devHint}>
              .env에 EXPO_PUBLIC_DEV_TEST_EMAIL / EXPO_PUBLIC_DEV_TEST_PASSWORD를 채우세요.
            </Text>
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
    padding: 16,
    backgroundColor: '#f5f5f7',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111',
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    color: '#555',
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111',
    backgroundColor: '#fafafa',
  },
  button: {
    marginTop: 18,
    backgroundColor: '#111',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#bbb',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#d33',
    fontSize: 13,
    marginTop: 8,
  },
  devBox: {
    marginTop: 24,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f0f4ff',
    borderWidth: 1,
    borderColor: '#dbe4ff',
    gap: 4,
  },
  devTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334',
  },
  devText: {
    fontSize: 12,
    color: '#445',
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
  },
  devButton: {
    marginTop: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: '#dbe4ff',
  },
  devButtonLabel: {
    fontSize: 12,
    color: '#334',
    fontWeight: '600',
  },
  devHint: {
    marginTop: 4,
    fontSize: 11,
    color: '#88a',
  },
});
