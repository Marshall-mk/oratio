import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useProfile } from '@/hooks/useProfile';
import { api } from '@/lib/api';
import { useColors, type AppColors, radius, spacing } from '@/theme';
import type { Challenge } from '@/types/api';

type IconName = keyof typeof Ionicons.glyphMap;

interface Category {
  key: string; // challenge category, or 'text' for the Text Lab
  label: string;
  blurb: string;
  icon: IconName;
}

const CATEGORIES: Category[] = [
  { key: 'coach', label: 'Live Coach', blurb: 'Real-time coaching', icon: 'pulse' },
  { key: 'scenario', label: 'Scenario', blurb: 'Roleplay with AI', icon: 'people' },
  { key: 'thought', label: 'Thought', blurb: 'Reasoning & ideas', icon: 'bulb' },
  { key: 'structure', label: 'Structure', blurb: 'Organize ideas', icon: 'git-branch' },
  { key: 'speaking', label: 'Speaking', blurb: 'Clarity & delivery', icon: 'megaphone' },
  { key: 'text', label: 'Text Lab', blurb: 'Reading & vocab', icon: 'book' },
  { key: 'debate', label: 'Debate', blurb: 'Compete with friends', icon: 'trophy' },
];

export default function Gym() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const { data: profile } = useProfile();
  const { data: challenges } = useQuery({
    queryKey: ['challenges'],
    queryFn: () => api<Challenge[]>('/challenges'),
  });

  function count(key: string): string {
    if (key === 'text') return '2 tools';
    if (key === 'debate') return 'Group game';
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
            onPress={() => router.push(cat.key === 'debate' ? '/debate' : `/gym/${cat.key}`)}>
            <View style={[styles.iconChip, { backgroundColor: c.primaryMuted }]}>
              <Ionicons name={cat.icon} size={24} color={c.primary} />
            </View>
            <Text style={styles.tileTitle}>{cat.label}</Text>
            <Text style={styles.tileBlurb}>{cat.blurb}</Text>
            <Text style={[styles.tileCount, { color: c.primary }]}>{count(cat.key)}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
  screen: { backgroundColor: c.background },
  container: { padding: spacing.lg, paddingTop: 70, paddingBottom: 40 },
  header: { marginBottom: spacing.lg },
  greeting: { fontSize: 28, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.5 },
  sub: { fontSize: 15, color: c.textSecondary, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: {
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
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
  tileTitle: { fontSize: 16, fontWeight: '700', color: c.textPrimary },
  tileBlurb: { fontSize: 12, color: c.textSecondary, flex: 1 },
  tileCount: { fontSize: 12, fontWeight: '700' },
});
}
