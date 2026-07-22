import { useQueryClient } from '@tanstack/react-query';
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
import { useTransient } from '@/hooks/useTransient';
import { api } from '@/lib/api';
import {
  deleteWhisperModel,
  downloadWhisperModel,
  isWhisperModelDownloaded,
} from '@/lib/captions/whisperModel';
import { supabase } from '@/lib/supabase';
import { useCaptionEngine, type CaptionEngine } from '@/stores/captionEngine';
import { useColors, useTheme, type AppColors, type ThemeMode, spacing } from '@/theme';

const APPEARANCE_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const ENGINE_OPTIONS: { value: CaptionEngine; label: string; description: string }[] = [
  {
    value: 'gemini',
    label: 'Gemini Live (cloud)',
    description: 'Streams your audio to the server for captions. Needs internet.',
  },
  {
    value: 'device',
    label: 'System recognizer (on-device)',
    description: "Your device's built-in speech engine. Fastest captions; no pause during a take.",
  },
  {
    value: 'whisper',
    label: 'Whisper (on-device AI)',
    description: 'Runs Whisper locally. Needs a one-time ~77 MB model download.',
  },
];

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
  const c = useColors();
  const { mode, setMode } = useTheme();
  const styles = makeStyles(c);
  const { session } = useSupabaseSession();
  const { data: profile, isLoading } = useProfile();
  const update = useUpdateProfile();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();

  const captionEngine = useCaptionEngine((s) => s.engine);
  const setCaptionEngine = useCaptionEngine((s) => s.setEngine);
  const [whisperReady, setWhisperReady] = useState(isWhisperModelDownloaded);
  const [whisperProgress, setWhisperProgress] = useState<number | null>(null);

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
  const [saved, flashSaved] = useTransient();
  const [cleared, flashCleared] = useTransient();
  const [modelDownloaded, flashModelDownloaded] = useTransient();
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const queryClient = useQueryClient();

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
      flashSaved();
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function handleDownloadModel() {
    setError(null);
    setWhisperProgress(0);
    try {
      await downloadWhisperModel(setWhisperProgress);
      setWhisperReady(true);
      flashModelDownloaded();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setWhisperProgress(null);
    }
  }

  function handleDeleteModel() {
    deleteWhisperModel();
    setWhisperReady(false);
    if (captionEngine === 'whisper') setCaptionEngine('gemini');
  }

  async function clearKey() {
    setError(null);
    try {
      await updateSettings.mutateAsync({ gemini_api_key: '' });
    } catch (e) {
      setError(errorText(e));
    }
  }

  function confirmClearAttempts() {
    Alert.alert(
      'Clear attempt history',
      'This permanently deletes all your attempts, transcripts, scores and recordings — your Progress starts fresh. Debates and Text Lab results are kept. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear history',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            setError(null);
            try {
              await api('/me/attempts', { method: 'DELETE' });
              // Progress and attempt lists are all derived from this data.
              await queryClient.invalidateQueries({ queryKey: ['progress'] });
              flashCleared();
            } catch (e) {
              setError(errorText(e));
            } finally {
              setClearing(false);
            }
          },
        },
      ],
    );
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
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Profile</Text>

        <Text style={styles.label}>Email</Text>
        <View style={[styles.input, styles.readOnly]}>
          <Text style={styles.readOnlyText}>{session?.user.email ?? '—'}</Text>
        </View>

        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="Your name" placeholderTextColor={c.textSecondary} />

        <Text style={styles.label}>Profession</Text>
        <TextInput style={styles.input} value={profession} onChangeText={setProfession} placeholder="e.g. PhD student, founder" placeholderTextColor={c.textSecondary} />

        <Text style={styles.label}>Industry / field</Text>
        <TextInput style={styles.input} value={industry} onChangeText={setIndustry} placeholder="Industry" placeholderTextColor={c.textSecondary} />

        <Text style={styles.label}>Education</Text>
        <TextInput style={styles.input} value={education} onChangeText={setEducation} placeholder="Education" placeholderTextColor={c.textSecondary} />

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

        <Text style={styles.sectionHeading}>Appearance</Text>
        <View style={styles.segment}>
          {APPEARANCE_OPTIONS.map((o) => {
            const active = mode === o.value;
            return (
              <Pressable
                key={o.value}
                onPress={() => setMode(o.value)}
                style={[styles.segmentItem, active && styles.segmentItemActive]}>
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
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

        <Text style={styles.label}>Live captions engine</Text>
        {ENGINE_OPTIONS.map((o) => {
          const selected = captionEngine === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => setCaptionEngine(o.value)}
              style={[styles.engineCard, selected && styles.engineCardSelected]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.engineTitle, selected && { color: c.textPrimary }]}>
                  {o.label}
                </Text>
                <Text style={styles.engineDesc}>{o.description}</Text>
              </View>
              <View style={[styles.radio, selected && styles.radioSelected]} />
            </Pressable>
          );
        })}

        {(captionEngine === 'whisper' || whisperReady) && (
          <View style={styles.modelRow}>
            {whisperProgress != null ? (
              <>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.round(whisperProgress * 100)}%` }]} />
                </View>
                <Text style={styles.modelStatus}>{Math.round(whisperProgress * 100)}%</Text>
              </>
            ) : whisperReady ? (
              <>
                {modelDownloaded && <Text style={styles.saved}>Model downloaded ✓</Text>}
                <Button title="Delete model" variant="ghost" onPress={handleDeleteModel} />
              </>
            ) : (
              <>
                <Text style={styles.modelStatus}>Model required for Whisper captions</Text>
                <Button title="Download (77 MB)" variant="ghost" onPress={handleDownloadModel} />
              </>
            )}
          </View>
        )}

        <Text style={styles.label}>Gemini API key</Text>
        <TextInput
          style={styles.input}
          value={apiKey}
          onChangeText={setApiKey}
          placeholder={settings?.has_api_key ? 'Enter a new key to replace it' : 'Paste your Gemini API key'}
          placeholderTextColor={c.textSecondary}
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
        {cleared && <Text style={styles.saved}>Attempt history cleared ✓</Text>}
        <Button
          title="Clear attempt history"
          variant="ghost"
          onPress={confirmClearAttempts}
          loading={clearing}
          style={styles.actionBtn}
        />
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

function makeStyles(c: AppColors) {
  return StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
  container: { padding: spacing.lg, paddingTop: 70, paddingBottom: 40, gap: spacing.sm },
  title: { fontSize: 28, fontWeight: '800', color: c.textPrimary },
  readOnly: { backgroundColor: c.background, justifyContent: 'center' },
  readOnlyText: { color: c.textSecondary, fontSize: 16 },
  actionBtn: { alignSelf: 'center', paddingHorizontal: 40, marginTop: spacing.xs },
  label: { fontSize: 13, fontWeight: '700', color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.sm },
  input: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    padding: 14,
    color: c.textPrimary,
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
    borderColor: c.border,
    backgroundColor: c.surface,
    gap: 4,
  },
  confSelected: { borderColor: c.primary, backgroundColor: c.primaryMuted },
  confNum: { fontSize: 18, fontWeight: '800', color: c.textSecondary },
  confNumSelected: { color: c.textPrimary },
  confLabel: { fontSize: 9, color: c.textSecondary, textAlign: 'center' },
  engineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    padding: spacing.md,
  },
  engineCardSelected: { borderColor: c.primary, backgroundColor: c.primaryMuted },
  engineTitle: { fontSize: 15, fontWeight: '700', color: c.textSecondary },
  engineDesc: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: c.border,
  },
  radioSelected: { borderColor: c.primary, backgroundColor: c.primary },
  modelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 40 },
  modelStatus: { fontSize: 13, color: c.textSecondary, flexShrink: 1 },
  progressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: c.border,
    overflow: 'hidden',
  },
  progressFill: { height: 8, borderRadius: 999, backgroundColor: c.primary },
  saved: { color: c.success, textAlign: 'center', fontWeight: '600' },
  error: { color: c.danger, textAlign: 'center' },
  divider: { height: 1, backgroundColor: c.border, marginVertical: spacing.md },
  sectionHeading: { fontSize: 20, fontWeight: '800', color: c.textPrimary },
  aiNote: { fontSize: 13, color: c.textSecondary, marginBottom: spacing.xs },
  segment: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 9 },
  segmentItemActive: { backgroundColor: c.primary },
  segmentText: { color: c.textSecondary, fontSize: 14, fontWeight: '600' },
  segmentTextActive: { color: c.onPrimary },
});
}
