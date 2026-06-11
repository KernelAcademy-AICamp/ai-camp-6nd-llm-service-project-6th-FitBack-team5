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
        // 이메일 확인이 켜져 있는 경우: 세션이 없고 확인 메일이 발송된다.
        setInfoMessage('확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요.');
      }
      // 확인 OFF면 data.session 이 바로 생기고 onAuthStateChange 가 자동 진입시킨다.
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
        <Text style={styles.title}>{isSignup ? 'FitBack 회원가입' : 'FitBack 로그인'}</Text>
        <Text style={styles.subtitle}>
          {isSignup
            ? '이메일과 비밀번호로 새 계정을 만드세요.'
            : '이메일과 비밀번호로 로그인하세요.'}
        </Text>

        <Text style={styles.label}>이메일</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor="#aab"
          style={styles.input}
        />

        <Text style={styles.label}>비밀번호</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          placeholder="6자 이상"
          placeholderTextColor="#aab"
          style={styles.input}
          onSubmitEditing={canSubmit ? handleSubmit : undefined}
        />
        {isSignup && password.length > 0 && !passwordOk && (
          <Text style={styles.hint}>비밀번호는 6자 이상이어야 해요.</Text>
        )}

        {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
        {infoMessage && <Text style={styles.info}>{infoMessage}</Text>}

        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.button,
            !canSubmit && styles.buttonDisabled,
            pressed && canSubmit && styles.buttonPressed,
          ]}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonLabel}>{isSignup ? '회원가입' : '로그인'}</Text>
          )}
        </Pressable>

        <Pressable onPress={toggleMode} style={styles.switchRow} hitSlop={6}>
          <Text style={styles.switchText}>
            {isSignup ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
          </Text>
        </Pressable>

        <View style={styles.devBox}>
          <Text style={styles.devTitle}>테스트 계정 (개발용)</Text>
          <Text style={styles.devText}>이메일: {TEST_EMAIL || '(.env 미설정)'}</Text>
          <Text style={styles.devText}>비밀번호: {TEST_PASSWORD || '(.env 미설정)'}</Text>
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
  title: { fontSize: 24, fontWeight: '700', color: '#111' },
  subtitle: { fontSize: 13, color: '#888', marginBottom: 12 },
  label: { fontSize: 13, color: '#555', marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111',
    backgroundColor: '#fafafa',
  },
  hint: { fontSize: 12, color: '#a70', marginTop: 4 },
  button: {
    marginTop: 18,
    backgroundColor: '#111',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: '#bbb' },
  buttonPressed: { opacity: 0.85 },
  buttonLabel: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#d33', fontSize: 13, marginTop: 8 },
  info: { color: '#176', fontSize: 13, marginTop: 8 },
  switchRow: { marginTop: 14, alignItems: 'center' },
  switchText: { fontSize: 13, color: '#3457d5', fontWeight: '600' },
  devBox: {
    marginTop: 24,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f0f4ff',
    borderWidth: 1,
    borderColor: '#dbe4ff',
    gap: 4,
  },
  devTitle: { fontSize: 13, fontWeight: '600', color: '#334' },
  devText: {
    fontSize: 12,
    color: '#445',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  devButton: {
    marginTop: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: '#dbe4ff',
  },
  devButtonLabel: { fontSize: 12, color: '#334', fontWeight: '600' },
  devHint: { marginTop: 4, fontSize: 11, color: '#88a' },
});