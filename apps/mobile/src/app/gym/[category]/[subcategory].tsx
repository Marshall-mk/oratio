import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { DrillWheel } from '@/components/DrillWheel';
import { api } from '@/lib/api';
import { drillsInGroup, groupLabel } from '@/lib/subcategories';
import { useColors, type AppColors, spacing } from '@/theme';
import type { Challenge } from '@/types/api';

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : 'Back';
}

export default function SubcategoryPicker() {
  const c = useColors();
  const styles = makeStyles(c);
  const { category, subcategory } = useLocalSearchParams<{ category: string; subcategory: string }>();
  const router = useRouter();

  const { data: challenges, isLoading } = useQuery({
    queryKey: ['challenges', category],
    queryFn: () => api<Challenge[]>(`/challenges?category=${category}`),
  });

  const drills = drillsInGroup(category, subcategory, challenges ?? []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BackButton label={cap(category)} onPress={() => router.back()} />
      <Text style={styles.title}>{groupLabel(category, subcategory)}</Text>
      <Text style={styles.blurb}>Scroll to choose a drill, or pick Random.</Text>

      {isLoading ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <DrillWheel drills={drills} category={category} group={subcategory} aiRandom />
      )}
    </ScrollView>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    screen: { backgroundColor: c.background },
    container: { padding: spacing.lg, paddingTop: 70, paddingBottom: 40, gap: spacing.sm },
    title: { fontSize: 28, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.5 },
    blurb: { fontSize: 14, color: c.textSecondary, marginBottom: spacing.sm },
  });
}
