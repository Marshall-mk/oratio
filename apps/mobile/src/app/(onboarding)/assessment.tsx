import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { useUpdateProfile } from '@/hooks/useProfile';
import { useOnboardingStore } from '@/stores/onboarding';
import { colors, spacing } from '@/theme';

const USE_CASE_OPTIONS = [
  'Research',
  'Interviews',
  'Leadership',
  'Relationships',
  'Networking',
  'Sales',
  'Teaching',
  'Content creation',
];

const CONFIDENCE_LABELS = ['Very low', 'Low', 'Okay', 'Good', 'Very high'];

function toggle(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((i) => i !== item) : [...list, item];
}

export default function OnboardingAssessment() {
  const store = useOnboardingStore();
  const updateProfile = useUpdateProfile();
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    setError(null);
    try {
      await updateProfile.mutateAsync({
        display_name: store.displayName,
        profession: store.profession,
        industry: store.industry,
        education: store.education,
        goals: store.goals,
        weaknesses: store.weaknesses,
        speaking_confidence: store.speakingConfidence,
        primary_use_cases: store.primaryUseCases,
        onboarding_completed: true,
      });
      // AuthGate sees onboarding_completed_at and redirects home.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.step}>3 of 3</Text>
      <Text style={styles.title}>Quick self-assessment</Text>

      <Text style={styles.section}>How confident are you speaking today?</Text>
      <View style={styles.confidenceRow}>
        {CONFIDENCE_LABELS.map((label, i) => {
          const value = i + 1;
          const selected = store.speakingConfidence === value;
          return (
            <Pressable
              key={label}
              onPress={() => store.set({ speakingConfidence: value })}
              style={[styles.confidence, selected && styles.confidenceSelected]}>
              <Text style={[styles.confidenceNum, selected && styles.confidenceNumSelected]}>{value}</Text>
              <Text style={styles.confidenceLabel}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.section}>Where will you use this most?</Text>
      <View style={styles.chips}>
        {USE_CASE_OPTIONS.map((u) => (
          <Chip
            key={u}
            label={u}
            selected={store.primaryUseCases.includes(u)}
            onToggle={() => store.set({ primaryUseCases: toggle(store.primaryUseCases, u) })}
          />
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Button
        title="Start training"
        onPress={finish}
        loading={updateProfile.isPending}
        disabled={!store.speakingConfidence || store.primaryUseCases.length === 0}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingTop: 80, gap: spacing.md },
  step: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  section: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.md },
  confidenceRow: { flexDirection: 'row', gap: spacing.sm },
  confidence: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 4,
  },
  confidenceSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  confidenceNum: { fontSize: 20, fontWeight: '800', color: colors.textDim },
  confidenceNumSelected: { color: colors.text },
  confidenceLabel: { fontSize: 10, color: colors.textDim, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  error: { color: colors.danger },
});
