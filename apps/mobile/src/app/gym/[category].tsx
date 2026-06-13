import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api } from '@/lib/api';
import { colors, radius, spacing } from '@/theme';
import type { Challenge } from '@/types/api';

const META: Record<string, { label: string; blurb: string }> = {
  coach: { label: 'Live Coach', blurb: 'Speak freely with real-time pacing, clarity & filler nudges' },
  scenario: { label: 'Scenario Gym', blurb: 'Hold a live conversation with an AI persona' },
  thought: { label: 'Thought Gym', blurb: 'Sharpen reasoning and idea generation' },
  structure: { label: 'Structure Gym', blurb: 'Organize ideas with proven frameworks' },
  speaking: { label: 'Speaking Gym', blurb: 'Deliver with clarity and confidence' },
  text: { label: 'Text Lab', blurb: 'Train reading and vocabulary — no mic needed' },
};

export default function GymCategory() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const router = useRouter();
  const meta = META[category] ?? { label: 'Training', blurb: '' };

  const { data: challenges, isLoading } = useQuery({
    queryKey: ['challenges', category],
    queryFn: () => api<Challenge[]>(`/challenges?category=${category}`),
    enabled: category !== 'text',
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>‹ Gym</Text>
      </Pressable>
      <Text style={styles.title}>{meta.label}</Text>
      <Text style={styles.blurb}>{meta.blurb}</Text>

      {category === 'text' ? (
        <View style={styles.list}>
          <Row
            title="Reading Lab"
            meta="Paste or upload text → study pack + quiz"
            onPress={() => router.push('/text-lab/reading')}
          />
          <Row
            title="Vocabulary Lab"
            meta="Upgrade, rewrite, and sharpen your writing"
            onPress={() => router.push('/text-lab/vocabulary')}
          />
        </View>
      ) : (
        <View style={styles.list}>
          {isLoading && <Text style={styles.blurb}>Loading…</Text>}
          {(challenges ?? []).map((c) => (
            <Row
              key={c.id}
              title={c.title}
              meta={`${c.difficulty} · ${Math.round(c.max_speak_seconds / 60) || 1} min${
                c.mode === 'roleplay' && c.persona_name
                  ? ` · with ${c.persona_name}`
                  : c.framework
                    ? ` · ${c.framework.toUpperCase()}`
                    : ''
              }`}
              onPress={() => router.push(`/challenge/${c.id}`)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function Row({ title, meta, onPress }: { title: string; meta: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowMeta}>{meta}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  container: { padding: spacing.lg, paddingTop: 70, paddingBottom: 40, gap: spacing.sm },
  back: { color: colors.textDim, fontSize: 16 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  blurb: { fontSize: 14, color: colors.textDim, marginBottom: spacing.sm },
  list: { gap: spacing.sm, marginTop: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowMeta: { fontSize: 12, color: colors.textFaint, marginTop: 3, textTransform: 'capitalize' },
  chevron: { fontSize: 24, color: colors.textDim },
});
