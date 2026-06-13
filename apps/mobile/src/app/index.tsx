import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useProfile } from '@/hooks/useProfile';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme';
import type { Challenge } from '@/types/api';

const CATEGORY_META: Record<Challenge['category'], { label: string; blurb: string }> = {
  thought: { label: 'Thought Gym', blurb: 'Sharpen reasoning and idea generation' },
  structure: { label: 'Structure Gym', blurb: 'Organize ideas with proven frameworks' },
  speaking: { label: 'Speaking Gym', blurb: 'Deliver with clarity and confidence' },
  scenario: { label: 'Scenario Gym', blurb: 'Live roleplay with an AI persona' },
  coach: { label: 'Live Coach', blurb: 'Real-time nudges while you speak' },
};

const CATEGORY_ORDER = ['coach', 'scenario', 'thought', 'structure', 'speaking'] as const;

export default function Home() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const { data: challenges, isLoading } = useQuery({
    queryKey: ['challenges'],
    queryFn: () => api<Challenge[]>('/challenges'),
  });

  const byCategory = (cat: Challenge['category']) =>
    (challenges ?? []).filter((c) => c.category === cat);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            {profile?.display_name ? `Hey, ${profile.display_name}` : 'Welcome'}
          </Text>
          <Text style={styles.sub}>What are we training today?</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push('/progress')}>
            <Text style={styles.headerLink}>Progress</Text>
          </Pressable>
          <Pressable onPress={() => supabase.auth.signOut()}>
            <Text style={styles.signOut}>Sign out</Text>
          </Pressable>
        </View>
      </View>

      {isLoading && <Text style={styles.sub}>Loading challenges…</Text>}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Text Lab</Text>
        <Text style={styles.sectionBlurb}>Train reading and vocabulary — no mic needed</Text>
        <Pressable
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
          onPress={() => router.push('/text-lab/reading')}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Reading Lab</Text>
            <Text style={styles.cardMeta}>Paste or upload text → study pack + comprehension quiz</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
          onPress={() => router.push('/text-lab/vocabulary')}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Vocabulary Lab</Text>
            <Text style={styles.cardMeta}>Upgrade, rewrite, and sharpen your writing</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>

      {CATEGORY_ORDER.map((cat) => {
        const items = byCategory(cat);
        if (items.length === 0) return null;
        return (
          <View key={cat} style={styles.section}>
            <Text style={styles.sectionTitle}>{CATEGORY_META[cat].label}</Text>
            <Text style={styles.sectionBlurb}>{CATEGORY_META[cat].blurb}</Text>
            {items.map((c) => (
              <Pressable
                key={c.id}
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
                onPress={() => router.push(`/challenge/${c.id}`)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{c.title}</Text>
                  <Text style={styles.cardMeta}>
                    {c.difficulty} · {Math.round(c.max_speak_seconds / 60) || 1} min
                    {c.mode === 'roleplay' && c.persona_name
                      ? ` · with ${c.persona_name}`
                      : c.framework
                        ? ` · ${c.framework.toUpperCase()}`
                        : ''}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  container: { padding: spacing.lg, paddingTop: 70, paddingBottom: 60, gap: spacing.sm },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  greeting: { fontSize: 26, fontWeight: '800', color: colors.text },
  sub: { fontSize: 15, color: colors.textDim, marginTop: 2 },
  headerActions: { alignItems: 'flex-end', gap: 6 },
  headerLink: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  signOut: { color: colors.textDim, fontSize: 13 },
  section: { marginTop: spacing.md, gap: spacing.sm },
  sectionTitle: { fontSize: 19, fontWeight: '700', color: colors.text },
  sectionBlurb: { fontSize: 13, color: colors.textDim, marginBottom: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  cardMeta: { fontSize: 12, color: colors.textDim, marginTop: 3, textTransform: 'capitalize' },
  chevron: { fontSize: 24, color: colors.textDim },
});
