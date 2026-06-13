import { useMutation, useQuery } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { api } from '@/lib/api';
import { colors, spacing } from '@/theme';
import type { TextExercise } from '@/types/textlab';

export default function ReadingLab() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (body: { source_title?: string; source_text?: string; pdf_base64?: string }) =>
      api<TextExercise>('/reading', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (ex) => setExerciseId(ex.id),
    onError: (e) => setError(e instanceof Error ? e.message : 'failed'),
  });

  const { data: exercise } = useQuery({
    queryKey: ['text-exercise', exerciseId],
    queryFn: () => api<TextExercise>(`/text-exercises/${exerciseId}`),
    enabled: !!exerciseId,
    refetchInterval: (q) =>
      q.state.data && ['ready', 'scored', 'failed'].includes(q.state.data.status) ? false : 2000,
  });

  const submit = useMutation({
    mutationFn: (body: { answers: number[] }) =>
      api<TextExercise>(`/reading/${exerciseId}/submit`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {},
  });

  async function pickPdf() {
    setError(null);
    try {
      const res = await File.pickFileAsync({ mimeTypes: ['application/pdf'] });
      if (res.canceled) return;
      const base64 = await res.result.base64();
      create.mutate({ source_title: res.result.name ?? 'Document', pdf_base64: base64 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'could not read file');
    }
  }

  // ---- Input phase ----
  if (!exerciseId) {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container}>
          <BackButton onPress={() => router.back()} />
          <Text style={styles.title}>Reading Lab</Text>
          <Text style={styles.subtitle}>
            Paste an article, essay, or paper — or pick a PDF. You'll get a study pack and a quiz.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Title (optional)"
            placeholderTextColor={colors.textDim}
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Paste the text here…"
            placeholderTextColor={colors.textDim}
            value={text}
            onChangeText={setText}
            multiline
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Button
            title="Generate study pack"
            loading={create.isPending}
            disabled={text.trim().length < 100}
            onPress={() => create.mutate({ source_title: title || undefined, source_text: text })}
          />
          <Button title="Or pick a PDF" variant="ghost" onPress={pickPdf} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ---- Generating ----
  if (!exercise || exercise.status === 'generating') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.subtitle}>Building your study pack…</Text>
      </View>
    );
  }

  if (exercise.status === 'failed') {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Couldn't generate a study pack from that text.</Text>
        <Button title="Try again" onPress={() => setExerciseId(null)} />
      </View>
    );
  }

  const content = exercise.content!;
  const scored = exercise.status === 'scored';
  const result = submit.data ?? (scored ? exercise : null);

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.container}>
      <BackButton label="Gym" onPress={() => router.dismissTo('/gym')} />
      <Text style={styles.title}>{exercise.source_title ?? 'Study pack'}</Text>

      <Section label="Summary">
        <Text style={styles.body}>{content.summary}</Text>
      </Section>

      <Section label="Key terms">
        {content.definitions.map((d, i) => (
          <View key={i} style={{ marginBottom: spacing.sm }}>
            <Text style={styles.term}>{d.term}</Text>
            <Text style={styles.body}>{d.meaning}</Text>
          </View>
        ))}
      </Section>

      <Section label="Key ideas">
        {content.key_ideas.map((k, i) => (
          <Text key={i} style={styles.body}>• {k}</Text>
        ))}
      </Section>

      <Section label="Argument map">
        {content.argument_map.map((a, i) => (
          <View key={i} style={styles.argNode}>
            <Text style={styles.claim}>{a.claim}</Text>
            <Text style={styles.support}>↳ {a.support}</Text>
          </View>
        ))}
      </Section>

      <Text style={styles.quizHeader}>Comprehension quiz</Text>
      {content.quiz.map((q, qi) => {
        const graded = result?.feedback?.per_question?.[qi];
        return (
          <View key={qi} style={styles.quizCard}>
            <Text style={styles.question}>
              {qi + 1}. {q.question}
            </Text>
            {q.options.map((opt, oi) => {
              const selected = answers[qi] === oi;
              const isCorrect = graded && graded.correct_index === oi;
              const isWrongPick = graded && graded.your_answer === oi && !graded.is_correct;
              return (
                <Pressable
                  key={oi}
                  disabled={scored || submit.isSuccess}
                  onPress={() => setAnswers((p) => ({ ...p, [qi]: oi }))}
                  style={[
                    styles.option,
                    selected && !graded && styles.optionSelected,
                    isCorrect && styles.optionCorrect,
                    isWrongPick && styles.optionWrong,
                  ]}>
                  <Text style={styles.optionText}>{opt}</Text>
                </Pressable>
              );
            })}
            {graded && <Text style={styles.explanation}>{graded.explanation}</Text>}
          </View>
        );
      })}

      {result?.feedback ? (
        <View style={styles.scoreCard}>
          <Text style={styles.scoreBig}>
            {result.feedback.correct}/{result.feedback.total} correct
          </Text>
          <Text style={styles.subtitle}>Comprehension score {result.score?.toFixed(1)}/10</Text>
          <Button title="Done" onPress={() => router.dismissTo('/gym')} />
        </View>
      ) : (
        <Button
          title="Submit answers"
          loading={submit.isPending}
          disabled={Object.keys(answers).length < content.quiz.length}
          onPress={() =>
            submit.mutate({ answers: content.quiz.map((_, i) => answers[i] ?? -1) })
          }
        />
      )}
    </ScrollView>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingTop: 70, paddingBottom: 60, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.bg, padding: spacing.lg },
  back: { color: colors.textDim, fontSize: 16 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textDim, lineHeight: 20 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    color: colors.text,
    fontSize: 16,
  },
  textArea: { minHeight: 200, textAlignVertical: 'top' },
  error: { color: colors.danger },
  section: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.xs,
  },
  sectionLabel: { color: colors.accent, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  term: { color: colors.text, fontSize: 15, fontWeight: '700' },
  argNode: { marginBottom: spacing.sm },
  claim: { color: colors.text, fontSize: 15, fontWeight: '600' },
  support: { color: colors.textDim, fontSize: 14, lineHeight: 20, marginTop: 2 },
  quizHeader: { fontSize: 19, fontWeight: '800', color: colors.text, marginTop: spacing.sm },
  quizCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.sm,
  },
  question: { color: colors.text, fontSize: 15, fontWeight: '600', lineHeight: 21 },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: colors.bg,
  },
  optionSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  optionCorrect: { borderColor: colors.success, backgroundColor: '#10301f' },
  optionWrong: { borderColor: colors.danger, backgroundColor: '#3a1414' },
  optionText: { color: colors.text, fontSize: 14 },
  explanation: { color: colors.textDim, fontSize: 13, fontStyle: 'italic', lineHeight: 19 },
  scoreCard: {
    backgroundColor: colors.accentSoft,
    borderRadius: 14,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  scoreBig: { fontSize: 28, fontWeight: '800', color: colors.text },
});
