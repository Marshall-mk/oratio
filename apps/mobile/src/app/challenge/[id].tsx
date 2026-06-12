import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { useStartSession } from '@/hooks/useStartSession';
import { api } from '@/lib/api';
import { colors, spacing } from '@/theme';
import type { Challenge } from '@/types/api';

const FRAMEWORK_HINTS: Record<string, string> = {
  prep: 'Point → Reason → Example → Point',
  star: 'Situation → Task → Action → Result',
  scientific: 'Problem → Gap → Method → Result → Impact',
  story: 'Context → Conflict → Resolution → Lesson',
  pyramid: 'Conclusion first → supporting evidence after',
};

export default function ChallengeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const startSession = useStartSession();
  const { data: challenge, isLoading } = useQuery({
    queryKey: ['challenge', id],
    queryFn: () => api<Challenge>(`/challenges/${id}`),
  });

  if (isLoading || !challenge) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textDim }}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>

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
        title="Start speaking"
        onPress={() => startSession.mutate(challenge.id)}
        loading={startSession.isPending}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  container: { padding: spacing.lg, paddingTop: 70, gap: spacing.md },
  back: { color: colors.textDim, fontSize: 16, marginBottom: spacing.sm },
  category: { color: colors.accent, fontWeight: '700', fontSize: 13, textTransform: 'capitalize' },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  promptCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.sm,
  },
  promptLabel: { color: colors.textDim, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  prompt: { color: colors.text, fontSize: 17, lineHeight: 25 },
  hintCard: {
    backgroundColor: colors.accentSoft,
    borderRadius: 14,
    padding: spacing.md,
    gap: 4,
  },
  hintLabel: { color: colors.text, fontWeight: '700', fontSize: 13 },
  hint: { color: colors.textDim, fontSize: 14 },
  metaRow: { flexDirection: 'row', gap: spacing.sm },
  metaBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
  },
  metaValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  metaLabel: { fontSize: 12, color: colors.textDim, marginTop: 2 },
});
