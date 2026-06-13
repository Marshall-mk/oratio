import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useProfile } from '@/hooks/useProfile';
import { api } from '@/lib/api';
import { colors, radius, spacing } from '@/theme';
import type { Challenge } from '@/types/api';

type IconName = keyof typeof Ionicons.glyphMap;

interface Category {
  key: string; // challenge category, or 'text' for the Text Lab
  label: string;
  blurb: string;
  icon: IconName;
  color: string;
}

const CATEGORIES: Category[] = [
  { key: 'coach', label: 'Live Coach', blurb: 'Real-time coaching', icon: 'pulse', color: '#7C5CFF' },
  { key: 'scenario', label: 'Scenario Gym', blurb: 'Roleplay with AI', icon: 'people', color: '#FF7AB6' },
  { key: 'thought', label: 'Thought Gym', blurb: 'Reasoning & ideas', icon: 'bulb', color: '#9D7BFF' },
  { key: 'structure', label: 'Structure Gym', blurb: 'Organize ideas', icon: 'git-branch', color: '#3DDC97' },
  { key: 'speaking', label: 'Speaking Gym', blurb: 'Clarity & delivery', icon: 'megaphone', color: '#E8B931' },
  { key: 'text', label: 'Text Lab', blurb: 'Reading & vocab', icon: 'book', color: '#4FB8FF' },
];

export default function Gym() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const { data: challenges } = useQuery({
    queryKey: ['challenges'],
    queryFn: () => api<Challenge[]>('/challenges'),
  });

  function count(key: string): string {
    if (key === 'text') return '2 tools';
    const n = (challenges ?? []).filter((c) => c.category === key).length;
    return `${n} ${n === 1 ? 'drill' : 'drills'}`;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>
          {profile?.display_name ? `Hey, ${profile.display_name}` : 'The Gym'}
        </Text>
        <Text style={styles.sub}>Pick a category to train</Text>
      </View>

      <View style={styles.grid}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat.key}
            style={({ pressed }) => [styles.tile, pressed && { opacity: 0.8 }]}
            onPress={() => router.push(`/gym/${cat.key}`)}>
            <View style={[styles.iconChip, { backgroundColor: `${cat.color}22` }]}>
              <Ionicons name={cat.icon} size={24} color={cat.color} />
            </View>
            <Text style={styles.tileTitle}>{cat.label}</Text>
            <Text style={styles.tileBlurb}>{cat.blurb}</Text>
            <Text style={[styles.tileCount, { color: cat.color }]}>{count(cat.key)}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  container: { padding: spacing.lg, paddingTop: 70, paddingBottom: 40 },
  header: { marginBottom: spacing.lg },
  greeting: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  sub: { fontSize: 15, color: colors.textDim, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: {
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 6,
    minHeight: 140,
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  tileTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  tileBlurb: { fontSize: 12, color: colors.textDim, flex: 1 },
  tileCount: { fontSize: 12, fontWeight: '700' },
});
