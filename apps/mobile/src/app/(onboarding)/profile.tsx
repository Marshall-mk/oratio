import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { Button } from '@/components/Button';
import { useOnboardingStore } from '@/stores/onboarding';
import { colors, spacing } from '@/theme';

export default function OnboardingProfile() {
  const router = useRouter();
  const { displayName, profession, industry, education, set } = useOnboardingStore();

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.step}>1 of 3</Text>
        <Text style={styles.title}>Tell us about yourself</Text>
        <Text style={styles.subtitle}>
          Veritas personalizes challenges and feedback to who you are.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="What should we call you?"
          placeholderTextColor={colors.textDim}
          value={displayName}
          onChangeText={(v) => set({ displayName: v })}
        />
        <TextInput
          style={styles.input}
          placeholder="Profession (e.g. PhD student, founder)"
          placeholderTextColor={colors.textDim}
          value={profession}
          onChangeText={(v) => set({ profession: v })}
        />
        <TextInput
          style={styles.input}
          placeholder="Industry or field"
          placeholderTextColor={colors.textDim}
          value={industry}
          onChangeText={(v) => set({ industry: v })}
        />
        <TextInput
          style={styles.input}
          placeholder="Education (optional)"
          placeholderTextColor={colors.textDim}
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

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingTop: 80, gap: spacing.md },
  step: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 15, color: colors.textDim, marginBottom: spacing.md },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    color: colors.text,
    fontSize: 16,
  },
});
