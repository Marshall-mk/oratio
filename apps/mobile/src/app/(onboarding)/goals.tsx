import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { useOnboardingStore } from '@/stores/onboarding';
import { useColors, type AppColors, spacing } from '@/theme';

const GOAL_OPTIONS = [
  'Public speaking',
  'Research communication',
  'Interviews',
  'Storytelling',
  'Persuasion',
  'Leadership',
  'Networking',
  'Relationships',
  'Critical thinking',
  'Vocabulary',
];

const WEAKNESS_OPTIONS = [
  'Rambling',
  'Filler words',
  'Poor structure',
  'Low confidence',
  'Too much jargon',
  'Overexplaining',
  'Weak arguments',
  'Speaking too fast',
];

function toggle(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((i) => i !== item) : [...list, item];
}

export default function OnboardingGoals() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const { goals, weaknesses, set } = useOnboardingStore();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.step}>2 of 3</Text>
      <Text style={styles.title}>What do you want to improve?</Text>

      <Text style={styles.section}>Goals</Text>
      <View style={styles.chips}>
        {GOAL_OPTIONS.map((g) => (
          <Chip key={g} label={g} selected={goals.includes(g)} onToggle={() => set({ goals: toggle(goals, g) })} />
        ))}
      </View>

      <Text style={styles.section}>Where do you struggle?</Text>
      <View style={styles.chips}>
        {WEAKNESS_OPTIONS.map((w) => (
          <Chip
            key={w}
            label={w}
            selected={weaknesses.includes(w)}
            onToggle={() => set({ weaknesses: toggle(weaknesses, w) })}
          />
        ))}
      </View>

      <Button
        title="Continue"
        onPress={() => router.push('/(onboarding)/assessment')}
        disabled={goals.length === 0}
      />
    </ScrollView>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
  container: { padding: spacing.lg, paddingTop: 80, gap: spacing.md },
  step: { color: c.primary, fontWeight: '700', fontSize: 13 },
  title: { fontSize: 28, fontWeight: '800', color: c.textPrimary },
  section: { fontSize: 16, fontWeight: '700', color: c.textPrimary, marginTop: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
}
