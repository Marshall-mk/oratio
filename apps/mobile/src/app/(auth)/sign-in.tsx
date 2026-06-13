import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { supabase } from '@/lib/supabase';
import { useColors, type AppColors, spacing } from '@/theme';

export default function SignIn() {
  const c = useColors();
  const styles = makeStyles(c);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const fn =
      mode === 'sign-in'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });
    const { error: err } = await fn;
    if (err) setError(err.message);
    setBusy(false);
    // Success: onAuthStateChange fires and the AuthGate redirects.
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.inner}>
        <Text style={styles.logo}>ōrātiō</Text>
        <Text style={styles.tagline}>Your communication gym.</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={c.textSecondary}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={c.textSecondary}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Button
          title={mode === 'sign-in' ? 'Sign in' : 'Create account'}
          onPress={submit}
          loading={busy}
          disabled={!email || password.length < 8}
        />
        <Button
          title={mode === 'sign-in' ? 'New here? Create an account' : 'Have an account? Sign in'}
          variant="ghost"
          onPress={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background, justifyContent: 'center' },
  inner: { padding: spacing.lg, gap: spacing.md },
  logo: { fontSize: 42, fontWeight: '800', color: c.textPrimary, textAlign: 'center' },
  tagline: {
    fontSize: 16,
    color: c.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  input: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    padding: 14,
    color: c.textPrimary,
    fontSize: 16,
  },
  error: { color: c.danger, textAlign: 'center' },
});
}
