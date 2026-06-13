import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { Button } from '@/components/Button';
import { useOnboardingStore } from '@/stores/onboarding';
import { useColors, type AppColors, spacing } from '@/theme';

export default function OnboardingProfile() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const { displayName, profession, industry, education, set } = useOnboardingStore();

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.step}>1 of 3</Text>
        <Text style={styles.title}>Tell us about yourself</Text>
        <Text style={styles.subtitle}>
          ōrātiō personalizes challenges and feedback to who you are.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="What should we call you?"
          placeholderTextColor={c.textSecondary}
          value={displayName}
          onChangeText={(v) => set({ displayName: v })}
        />
        <TextInput
          style={styles.input}
          placeholder="Profession (e.g. PhD student, founder)"
          placeholderTextColor={c.textSecondary}
          value={profession}
          onChangeText={(v) => set({ profession: v })}
        />
        <TextInput
          style={styles.input}
          placeholder="Industry or field"
          placeholderTextColor={c.textSecondary}
          value={industry}
          onChangeText={(v) => set({ industry: v })}
        />
        <TextInput
          style={styles.input}
          placeholder="Education (optional)"
          placeholderTextColor={c.textSecondary}
          value={education}
          onChangeText={(v) => set({ education: v })}
        />

        <Button
          title="Continue"
          onPress={() => router.push('/(onboarding)/goals')}
          disabled={!displayName || !profession}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
  container: { padding: spacing.lg, paddingTop: 80, gap: spacing.md },
  step: { color: c.primary, fontWeight: '700', fontSize: 13 },
  title: { fontSize: 28, fontWeight: '800', color: c.textPrimary },
  subtitle: { fontSize: 15, color: c.textSecondary, marginBottom: spacing.md },
  input: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    padding: 14,
    color: c.textPrimary,
    fontSize: 16,
  },
});
}
