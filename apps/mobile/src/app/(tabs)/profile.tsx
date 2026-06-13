import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme';

function errorText(e: unknown): string {
  if (e instanceof Error) {
    try {
      return JSON.parse(e.message).detail ?? e.message;
    } catch {
      return e.message;
    }
  }
  return 'Something went wrong';
}

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
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();

  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [profession, setProfession] = useState('');
  const [industry, setIndustry] = useState('');
  const [education, setEducation] = useState('');
  const [goals, setGoals] = useState<string[]>([]);
  const [weaknesses, setWeaknesses] = useState<string[]>([]);
  const [useCases, setUseCases] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (settings) setModel(settings.eval_model);
  }, [settings]);

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

  const saving = update.isPending || updateSettings.isPending;

  // One Save covers both profile fields and AI settings.
  async function save() {
    setError(null);
    setSaved(false);
    try {
      await Promise.all([
        update.mutateAsync({
          display_name: displayName,
          profession,
          industry,
          education,
          goals,
          weaknesses,
          primary_use_cases: useCases,
          speaking_confidence: confidence,
        }),
        updateSettings.mutateAsync({
          eval_model: model ?? undefined,
          gemini_api_key: apiKey.trim() ? apiKey.trim() : undefined,
        }),
      ]);
      setApiKey('');
      setSaved(true);
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function clearKey() {
    setError(null);
    setSaved(false);
    try {
      await updateSettings.mutateAsync({ gemini_api_key: '' });
    } catch (e) {
      setError(errorText(e));
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Delete account',
      'This permanently deletes your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            setError(null);
            try {
              await api('/me/account', { method: 'DELETE' });
              await supabase.auth.signOut();
            } catch (e) {
              setError(errorText(e));
              setDeleting(false);
            }
          },
        },
      ],
    );
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

        <Text style={styles.label}>Email</Text>
        <View style={[styles.input, styles.readOnly]}>
          <Text style={styles.readOnlyText}>{session?.user.email ?? '—'}</Text>
        </View>

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

        <View style={styles.divider} />

        <Text style={styles.sectionHeading}>AI settings</Text>
        <Text style={styles.aiNote}>
          {settings?.using_own_key
            ? `Using your own API key (${settings.api_key_hint})`
            : "Using ōrātiō's default key"}
        </Text>

        <Text style={styles.label}>Evaluation model</Text>
        <View style={styles.chips}>
          {(settings?.available_models ?? []).map((m) => (
            <Chip key={m} label={m.replace('gemini-', '')} selected={model === m} onToggle={() => setModel(m)} />
          ))}
        </View>

        <Text style={styles.label}>Gemini API key</Text>
        <TextInput
          style={styles.input}
          value={apiKey}
          onChangeText={setApiKey}
          placeholder={settings?.has_api_key ? 'Enter a new key to replace it' : 'Paste your Gemini API key'}
          placeholderTextColor={colors.textDim}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />

        {settings?.has_api_key && (
          <Button
            title="Use default key"
            variant="ghost"
            onPress={clearKey}
            style={styles.actionBtn}
          />
        )}

        {error && <Text style={styles.error}>{error}</Text>}
        {saved && <Text style={styles.saved}>Saved ✓</Text>}
        <Button title="Save" onPress={save} loading={saving} style={styles.actionBtn} />

        <View style={styles.divider} />
        <Button
          title="Sign out"
          variant="ghost"
          onPress={() => supabase.auth.signOut()}
          style={styles.actionBtn}
        />
        <Button
          title="Delete account"
          variant="danger"
          onPress={confirmDelete}
          loading={deleting}
          style={styles.actionBtn}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  container: { padding: spacing.lg, paddingTop: 70, paddingBottom: 40, gap: spacing.sm },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  readOnly: { backgroundColor: colors.bg, justifyContent: 'center' },
  readOnlyText: { color: colors.textDim, fontSize: 16 },
  actionBtn: { alignSelf: 'center', paddingHorizontal: 40, marginTop: spacing.xs },
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
  error: { color: colors.danger, textAlign: 'center' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  sectionHeading: { fontSize: 20, fontWeight: '800', color: colors.text },
  aiNote: { fontSize: 13, color: colors.textDim, marginBottom: spacing.xs },
});
