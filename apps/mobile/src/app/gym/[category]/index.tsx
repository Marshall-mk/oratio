import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { DrillWheel } from '@/components/DrillWheel';
import { api } from '@/lib/api';
import { drillsInGroup, gymLayout } from '@/lib/subcategories';
import { useColors, type AppColors, radius, spacing } from '@/theme';
import type { Challenge } from '@/types/api';

const META: Record<string, { label: string; blurb: string }> = {
  coach: { label: 'Live Coach', blurb: 'Free practice with real-time coaching' },
  scenario: { label: 'Scenario', blurb: 'Pick a level, then a roleplay' },
  thought: { label: 'Thought', blurb: 'Pick a kind of thinking to train' },
  structure: { label: 'Structure', blurb: 'Pick a framework to practice' },
  speaking: { label: 'Speaking', blurb: 'Pick a level to practice' },
  text: { label: 'Text Lab', blurb: 'Train reading and vocabulary' },
};

export default function GymCategory() {
  const c = useColors();
  const styles = makeStyles(c);
  const { category } = useLocalSearchParams<{ category: string }>();
  const router = useRouter();
  const meta = META[category] ?? { label: 'Training', blurb: '' };
  const layout = gymLayout(category);

  const { data: challenges, isLoading } = useQuery({
    queryKey: ['challenges', category],
    queryFn: () => api<Challenge[]>(`/challenges?category=${category}`),
    enabled: category !== 'text',
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BackButton label="Train" onPress={() => router.back()} />
      <Text style={styles.title}>{meta.label}</Text>
      <Text style={styles.blurb}>{meta.blurb}</Text>

      {layout.kind === 'groups' ? (
        <View style={styles.list}>
          {layout.groups
            .map((g) => ({ g, count: drillsInGroup(category, g.key, challenges ?? []).length }))
            .filter(({ count }) => count > 0)
            .map(({ g, count }) => (
              <Row
                key={g.key}
                title={g.label}
                meta={`${g.blurb ? g.blurb + ' · ' : ''}${count} drills`}
                onPress={() => router.push(`/gym/${category}/${g.key}`)}
              />
            ))}
        </View>
      ) : layout.kind === 'wheel' ? (
        <View style={{ gap: spacing.sm }}>
          {!isLoading && <DrillWheel drills={challenges ?? []} noun="mode" category={category} />}
        </View>
      ) : category === 'text' ? (
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
          {(challenges ?? []).map((d) => (
            <Row
              key={d.id}
              title={d.title}
              meta={`${d.difficulty} · ${Math.round(d.max_speak_seconds / 60) || 1} min`}
              onPress={() => router.push(`/challenge/${d.id}`)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function Row({ title, meta, onPress }: { title: string; meta: string; onPress: () => void }) {
  const c = useColors();
  const styles = makeStyles(c);
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

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    screen: { backgroundColor: c.background },
    container: { padding: spacing.lg, paddingTop: 70, paddingBottom: 40, gap: spacing.sm },
    title: { fontSize: 28, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.5 },
    blurb: { fontSize: 14, color: c.textSecondary, marginBottom: spacing.sm },
    list: { gap: spacing.sm, marginTop: spacing.xs },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: spacing.sm,
    },
    rowTitle: { fontSize: 16, fontWeight: '600', color: c.textPrimary },
    rowMeta: { fontSize: 12, color: c.textMuted, marginTop: 3, textTransform: 'capitalize' },
    chevron: { fontSize: 24, color: c.textSecondary },
  });
}
