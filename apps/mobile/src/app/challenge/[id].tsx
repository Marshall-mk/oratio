import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { useStartSession } from '@/hooks/useStartSession';
import { api } from '@/lib/api';
import { useColors, type AppColors, spacing } from '@/theme';
import type { Challenge } from '@/types/api';

const FRAMEWORK_HINTS: Record<string, string> = {
  prep: 'Point → Reason → Example → Point',
  star: 'Situation → Task → Action → Result',
  scientific: 'Problem → Gap → Method → Result → Impact',
  story: 'Context → Conflict → Resolution → Lesson',
  pyramid: 'Conclusion first → supporting evidence after',
};

export default function ChallengeDetail() {
  const c = useColors();
  const styles = makeStyles(c);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const startSession = useStartSession();
  const { data: challenge, isLoading } = useQuery({
    queryKey: ['challenge', id],
    queryFn: () => api<Challenge>(`/challenges/${id}`),
  });
  const example = useMutation({
    mutationFn: () => api<{ example: string }>(`/challenges/${id}/example`, { method: 'POST' }),
  });

  if (isLoading || !challenge) {
    return (
      <View style={styles.center}>
        <Text style={{ color: c.textSecondary }}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.container}>
      <BackButton onPress={() => router.back()} />

      <Text style={styles.category}>
        {challenge.category} · {challenge.difficulty}
      </Text>
      <Text style={styles.title}>{challenge.title}</Text>

      <View style={styles.promptCard}>
        <Text style={styles.promptLabel}>Your challenge</Text>
        <Text style={styles.prompt}>{challenge.prompt}</Text>
      </View>

      {challenge.framework && (
        <View style={styles.hintCard}>
          <Text style={styles.hintLabel}>Framework: {challenge.framework.toUpperCase()}</Text>
          <Text style={styles.hint}>{FRAMEWORK_HINTS[challenge.framework]}</Text>
        </View>
      )}

      {challenge.mode === 'roleplay' && challenge.persona_name && (
        <View style={styles.hintCard}>
          <Text style={styles.hintLabel}>You'll talk with {challenge.persona_name}</Text>
          {challenge.persona_opener && (
            <Text style={styles.hint}>“{challenge.persona_opener}”</Text>
          )}
        </View>
      )}

      <View style={styles.metaRow}>
        <View style={styles.metaBox}>
          <Text style={styles.metaValue}>{challenge.prep_seconds}s</Text>
          <Text style={styles.metaLabel}>to prepare</Text>
        </View>
        <View style={styles.metaBox}>
          <Text style={styles.metaValue}>
            {challenge.max_speak_seconds >= 60
              ? `${Math.round(challenge.max_speak_seconds / 60)}m`
              : `${challenge.max_speak_seconds}s`}
          </Text>
          <Text style={styles.metaLabel}>to speak</Text>
        </View>
      </View>

      <Button
        title={
          challenge.mode === 'roleplay'
            ? 'Start conversation'
            : challenge.mode === 'live_coach'
              ? 'Start coaching'
              : 'Start speaking'
        }
        onPress={() => startSession.mutate({ challengeId: challenge.id, mode: challenge.mode })}
        loading={startSession.isPending}
      />

      <Button
        title={example.isPending ? 'Generating…' : example.data ? 'Show another example' : 'Show example'}
        variant="ghost"
        loading={example.isPending}
        onPress={() => example.mutate()}
      />

      {example.isError && (
        <Text style={styles.exampleError}>Couldn’t generate an example — try again.</Text>
      )}

      {example.data && (
        <View style={styles.exampleCard}>
          <Text style={styles.exampleLabel}>Model example</Text>
          <Text style={styles.exampleText}>{example.data.example}</Text>
          <Text style={styles.exampleNote}>One way to do it — your own take is what counts.</Text>
        </View>
      )}
    </ScrollView>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
  container: { padding: spacing.lg, paddingTop: 70, gap: spacing.md },
  back: { color: c.textSecondary, fontSize: 16, marginBottom: spacing.sm },
  category: { color: c.primary, fontWeight: '700', fontSize: 13, textTransform: 'capitalize' },
  title: { fontSize: 28, fontWeight: '800', color: c.textPrimary },
  promptCard: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.sm,
  },
  promptLabel: { color: c.textSecondary, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  prompt: { color: c.textPrimary, fontSize: 17, lineHeight: 25 },
  hintCard: {
    backgroundColor: c.primaryMuted,
    borderRadius: 14,
    padding: spacing.md,
    gap: 4,
  },
  hintLabel: { color: c.textPrimary, fontWeight: '700', fontSize: 13 },
  hint: { color: c.textSecondary, fontSize: 14 },
  metaRow: { flexDirection: 'row', gap: spacing.sm },
  metaBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 14,
    padding: spacing.md,
  },
  metaValue: { fontSize: 22, fontWeight: '800', color: c.textPrimary },
  metaLabel: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
  exampleError: { color: c.danger, fontSize: 13, textAlign: 'center' },
  exampleCard: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.sm,
  },
  exampleLabel: { color: c.primary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  exampleText: { color: c.textPrimary, fontSize: 16, lineHeight: 24 },
  exampleNote: { color: c.textMuted, fontSize: 12, fontStyle: 'italic' },
});
}
