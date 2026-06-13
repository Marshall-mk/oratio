import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme';

const GOAL_OPTIONS = [
  'Public speaking', 'Research communication', 'Interviews', 'Storytelling', 'Persuasion',
  'Leadership', 'Networking', 'Relationships', 'Critical thinking', 'Vocabulary',
];
const WEAKNESS_OPTIONS = [
  'Rambling', 'Filler words', 'Poor structure', 'Low confidence', 'Too much jargon',
  'Overexplaining', 'Weak arguments', 'Speaking too fast',
];
const USE_CASE_OPTIONS = [
  'Research', 'Interviews', 'Leadership', 'Relationships', 'Networking', 'Sales',
  'Teaching', 'Content creation',
];
const CONFIDENCE_LABELS = ['Very low', 'Low', 'Okay', 'Good', 'Very high'];

function toggle(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((i) => i !== item) : [...list, item];
}

export default function Profile() {
  const { session } = useSupabaseSession();
  const { data: profile, isLoading } = useProfile();
  const update = useUpdateProfile();

  const [displayName, setDisplayName] = useState('');
  const [profession, setProfession] = useState('');
  const [industry, setIndustry] = useState('');
  const [education, setEducation] = useState('');
  const [goals, setGoals] = useState<string[]>([]);
  const [weaknesses, setWeaknesses] = useState<string[]>([]);
  const [useCases, setUseCases] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? '');
    setProfession(profile.profession ?? '');
    setIndustry(profile.industry ?? '');
    setEducation(profile.education ?? '');
    setGoals(profile.goals ?? []);
    setWeaknesses(profile.weaknesses ?? []);
    setUseCases(profile.primary_use_cases ?? []);
    setConfidence(profile.speaking_confidence ?? null);
  }, [profile]);

  async function save() {
    setSaved(false);
    await update.mutateAsync({
      display_name: displayName,
      profession,
      industry,
      education,
      goals,
      weaknesses,
      primary_use_cases: useCases,
      speaking_confidence: confidence,
    });
    setSaved(true);
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Profile</Text>
        {session?.user.email && <Text style={styles.email}>{session.user.email}</Text>}

        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="Your name" placeholderTextColor={colors.textDim} />

        <Text style={styles.label}>Profession</Text>
        <TextInput style={styles.input} value={profession} onChangeText={setProfession} placeholder="e.g. PhD student, founder" placeholderTextColor={colors.textDim} />

        <Text style={styles.label}>Industry / field</Text>
        <TextInput style={styles.input} value={industry} onChangeText={setIndustry} placeholder="Industry" placeholderTextColor={colors.textDim} />

        <Text style={styles.label}>Education</Text>
        <TextInput style={styles.input} value={education} onChangeText={setEducation} placeholder="Education" placeholderTextColor={colors.textDim} />

        <Text style={styles.label}>Goals</Text>
        <View style={styles.chips}>
          {GOAL_OPTIONS.map((g) => (
            <Chip key={g} label={g} selected={goals.includes(g)} onToggle={() => setGoals(toggle(goals, g))} />
          ))}
        </View>

        <Text style={styles.label}>Where you struggle</Text>
        <View style={styles.chips}>
          {WEAKNESS_OPTIONS.map((w) => (
            <Chip key={w} label={w} selected={weaknesses.includes(w)} onToggle={() => setWeaknesses(toggle(weaknesses, w))} />
          ))}
        </View>

        <Text style={styles.label}>Primary use cases</Text>
        <View style={styles.chips}>
          {USE_CASE_OPTIONS.map((u) => (
            <Chip key={u} label={u} selected={useCases.includes(u)} onToggle={() => setUseCases(toggle(useCases, u))} />
          ))}
        </View>

        <Text style={styles.label}>Speaking confidence</Text>
        <View style={styles.confidenceRow}>
          {CONFIDENCE_LABELS.map((lbl, i) => {
            const value = i + 1;
            const selected = confidence === value;
            return (
              <Pressable key={lbl} onPress={() => setConfidence(value)} style={[styles.conf, selected && styles.confSelected]}>
                <Text style={[styles.confNum, selected && styles.confNumSelected]}>{value}</Text>
                <Text style={styles.confLabel}>{lbl}</Text>
              </Pressable>
            );
          })}
        </View>

        {saved && <Text style={styles.saved}>Saved ✓</Text>}
        <Button title="Save changes" onPress={save} loading={update.isPending} />

        <View style={styles.divider} />
        <Button title="Sign out" variant="ghost" onPress={() => supabase.auth.signOut()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  container: { padding: spacing.lg, paddingTop: 70, paddingBottom: 40, gap: spacing.sm },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  email: { fontSize: 14, color: colors.textDim, marginBottom: spacing.sm },
  label: { fontSize: 13, fontWeight: '700', color: colors.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    color: colors.text,
    fontSize: 16,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  confidenceRow: { flexDirection: 'row', gap: spacing.sm },
  conf: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 4,
  },
  confSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  confNum: { fontSize: 18, fontWeight: '800', color: colors.textDim },
  confNumSelected: { color: colors.text },
  confLabel: { fontSize: 9, color: colors.textDim, textAlign: 'center' },
  saved: { color: colors.success, textAlign: 'center', fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
});
