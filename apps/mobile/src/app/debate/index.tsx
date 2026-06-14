import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { api } from '@/lib/api';
import { useColors, type AppColors, radius, spacing } from '@/theme';
import { FORMAT_OPTIONS, type Debate, type DebateFormat } from '@/types/debate';

export default function DebateSetup() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();

  const [format, setFormat] = useState<DebateFormat>('ranked');
  const [names, setNames] = useState<string[]>(['', '']);
  const [sides, setSides] = useState<string[]>(['For', 'Against']);
  const [motion, setMotion] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const genMotions = useMutation({
    mutationFn: () => api<string[]>('/debates/motions', { method: 'POST' }),
    onSuccess: (m) => setOptions(m),
    onError: () => setError("Couldn't generate topics — try again."),
  });

  const create = useMutation({
    mutationFn: () =>
      api<Debate>('/debates', {
        method: 'POST',
        body: JSON.stringify({
          motion: motion.trim(),
          format,
          participants: names
            .map((n, i) => ({ name: n.trim(), side: format === 'sides' ? sides[i] : null }))
            .filter((p) => p.name),
        }),
      }),
    onSuccess: (d) => router.replace(`/debate/${d.id}`),
    onError: () => setError('Could not start the debate.'),
  });

  const validNames = names.map((n) => n.trim()).filter(Boolean);
  const canStart = validNames.length >= 2 && motion.trim().length > 0;

  function setName(i: number, v: string) {
    setNames((p) => p.map((n, idx) => (idx === i ? v : n)));
  }
  function toggleSide(i: number) {
    setSides((p) => p.map((s, idx) => (idx === i ? (s === 'For' ? 'Against' : 'For') : s)));
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <BackButton label="Gym" onPress={() => router.back()} />
        <Text style={styles.title}>Debate Arena</Text>
        <Text style={styles.blurb}>Gather your friends, pass the phone, let the AI judge.</Text>

        <Text style={styles.label}>Format</Text>
        <View style={styles.formatList}>
          {FORMAT_OPTIONS.map((f) => (
            <Pressable
              key={f.value}
              onPress={() => setFormat(f.value)}
              style={[styles.formatCard, format === f.value && styles.formatActive]}>
              <Text style={[styles.formatLabel, format === f.value && { color: c.primary }]}>{f.label}</Text>
              <Text style={styles.formatBlurb}>{f.blurb}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Players</Text>
        {names.map((n, i) => (
          <View key={i} style={styles.playerRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder={`Player ${i + 1}`}
              placeholderTextColor={c.textMuted}
              value={n}
              onChangeText={(v) => setName(i, v)}
            />
            {format === 'sides' && (
              <Pressable onPress={() => toggleSide(i)} style={styles.sideChip}>
                <Text style={styles.sideText}>{sides[i] ?? 'For'}</Text>
              </Pressable>
            )}
            {names.length > 2 && (
              <Pressable onPress={() => { setNames((p) => p.filter((_, idx) => idx !== i)); }}>
                <Text style={styles.remove}>✕</Text>
              </Pressable>
            )}
          </View>
        ))}
        <Pressable onPress={() => { setNames((p) => [...p, '']); setSides((p) => [...p, p.length % 2 ? 'Against' : 'For']); }}>
          <Text style={styles.addPlayer}>+ Add player</Text>
        </Pressable>

        <Text style={styles.label}>Motion</Text>
        <TextInput
          style={[styles.input, styles.motionInput]}
          placeholder="Write your own motion…"
          placeholderTextColor={c.textMuted}
          value={motion}
          onChangeText={setMotion}
          multiline
        />
        <Button
          title={genMotions.isPending ? 'Generating…' : 'Suggest 3 topics'}
          variant="ghost"
          loading={genMotions.isPending}
          onPress={() => genMotions.mutate()}
        />
        {options.map((o) => (
          <Pressable
            key={o}
            onPress={() => setMotion(o)}
            style={[styles.optionCard, motion === o && styles.optionActive]}>
            <Text style={styles.optionText}>{o}</Text>
          </Pressable>
        ))}

        {error && <Text style={styles.error}>{error}</Text>}
        <View style={{ height: spacing.sm }} />
        <Button
          title="Start debate"
          disabled={!canStart}
          loading={create.isPending}
          onPress={() => create.mutate()}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, paddingTop: 70, paddingBottom: 48, gap: spacing.sm },
    title: { fontSize: 28, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.5 },
    blurb: { fontSize: 14, color: c.textSecondary, marginBottom: spacing.sm },
    label: { fontSize: 13, fontWeight: '700', color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.md },
    formatList: { gap: spacing.sm },
    formatCard: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.md },
    formatActive: { borderColor: c.primary, backgroundColor: c.primaryMuted },
    formatLabel: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
    formatBlurb: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
    playerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    input: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: 14,
      color: c.textPrimary,
      fontSize: 16,
    },
    motionInput: { minHeight: 70, textAlignVertical: 'top' },
    sideChip: { backgroundColor: c.primaryMuted, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
    sideText: { color: c.primary, fontWeight: '700', fontSize: 13, width: 56, textAlign: 'center' },
    remove: { color: c.textMuted, fontSize: 18, paddingHorizontal: 4 },
    addPlayer: { color: c.primary, fontWeight: '700', fontSize: 14, paddingVertical: spacing.sm },
    optionCard: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.md },
    optionActive: { borderColor: c.primary, backgroundColor: c.primaryMuted },
    optionText: { color: c.textPrimary, fontSize: 14, lineHeight: 20 },
    error: { color: c.danger, textAlign: 'center', marginTop: spacing.sm },
  });
}
