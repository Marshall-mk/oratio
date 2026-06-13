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

import { Button } from '@/components/Button';
import { api } from '@/lib/api';
import { colors, spacing } from '@/theme';
import { VOCAB_DRILLS, type TextExercise } from '@/types/textlab';

export default function VocabularyLab() {
  const router = useRouter();
  const [subtype, setSubtype] = useState(VOCAB_DRILLS[0].subtype);
  const [text, setText] = useState('');

  const run = useMutation({
    mutationFn: () =>
      api<TextExercise>('/vocabulary', {
        method: 'POST',
        body: JSON.stringify({ subtype, source_text: text }),
      }),
  });

  const result = run.data;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Vocabulary Lab</Text>

        <Text style={styles.sectionLabel}>Choose a drill</Text>
        <View style={styles.drills}>
          {VOCAB_DRILLS.map((d) => (
            <Pressable
              key={d.subtype}
              onPress={() => setSubtype(d.subtype)}
              style={[styles.drill, subtype === d.subtype && styles.drillActive]}>
              <Text style={[styles.drillLabel, subtype === d.subtype && styles.drillLabelActive]}>
                {d.label}
              </Text>
              <Text style={styles.drillHint}>{d.hint}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Enter your sentence or paragraph…"
          placeholderTextColor={colors.textDim}
          value={text}
          onChangeText={setText}
          multiline
        />

        {run.isError && <Text style={styles.error}>Something went wrong — try again.</Text>}

        <Button
          title="Upgrade my writing"
          loading={run.isPending}
          disabled={text.trim().length < 3}
          onPress={() => run.mutate()}
        />

        {result && (
          <>
            <View style={styles.scoreCard}>
              <Text style={styles.scoreBig}>{result.score?.toFixed(1)}/10</Text>
              <Text style={styles.subtitle}>{result.feedback?.feedback}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Upgraded version</Text>
              <Text style={styles.improved}>{result.content?.improved}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>What changed</Text>
              {result.content?.changes.map((c, i) => (
                <View key={i} style={styles.change}>
                  <Text style={styles.changeLine}>
                    <Text style={styles.original}>{c.original}</Text>
                    {'  →  '}
                    <Text style={styles.replacement}>{c.replacement}</Text>
                  </Text>
                  <Text style={styles.reason}>{c.reason}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingTop: 70, paddingBottom: 60, gap: spacing.md },
  back: { color: colors.textDim, fontSize: 16 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textDim, lineHeight: 20 },
  sectionLabel: { color: colors.accent, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  drills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  drill: {
    width: '48%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    gap: 2,
  },
  drillActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  drillLabel: { color: colors.textDim, fontSize: 14, fontWeight: '700' },
  drillLabelActive: { color: colors.text },
  drillHint: { color: colors.textDim, fontSize: 11 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    color: colors.text,
    fontSize: 16,
  },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  error: { color: colors.danger },
  scoreCard: {
    backgroundColor: colors.accentSoft,
    borderRadius: 14,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  scoreBig: { fontSize: 32, fontWeight: '800', color: colors.text },
  section: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.sm,
  },
  improved: { color: colors.text, fontSize: 16, lineHeight: 24 },
  change: { gap: 2, marginBottom: spacing.sm },
  changeLine: { fontSize: 14, lineHeight: 20 },
  original: { color: colors.danger, textDecorationLine: 'line-through' },
  replacement: { color: colors.success, fontWeight: '600' },
  reason: { color: colors.textDim, fontSize: 13 },
});
