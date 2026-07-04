import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { AttemptRow, type AttemptRowData } from '@/components/AttemptRow';
import { BackButton } from '@/components/BackButton';
import { api } from '@/lib/api';
import { useColors, type AppColors, spacing } from '@/theme';

interface RecentAttempt extends AttemptRowData {
  attempt_id: string;
}

interface ProgressAttempts {
  total_attempts: number;
  recent_attempts: RecentAttempt[];
}

export default function AttemptsScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();

  // Same query key as the Progress tab, so this reuses the already-fetched list.
  const { data } = useQuery({
    queryKey: ['progress'],
    queryFn: () => api<ProgressAttempts>('/me/progress'),
  });

  const attempts = data?.recent_attempts ?? [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <BackButton label="Progress" onPress={() => router.back()} />
      <Text style={styles.title}>All attempts</Text>
      {data != null && (
        <Text style={styles.subtitle}>
          {attempts.length} of {data.total_attempts} shown
        </Text>
      )}

      {attempts.map((a) => (
        <AttemptRow key={a.attempt_id} attempt={a} />
      ))}

      {data != null && attempts.length === 0 && (
        <Text style={styles.empty}>Complete your first challenge to see it here.</Text>
      )}
    </ScrollView>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    screen: { backgroundColor: c.background },
    container: { padding: spacing.lg, paddingTop: 70, paddingBottom: 48, gap: spacing.md },
    title: { fontSize: 30, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.5 },
    subtitle: { fontSize: 13, color: c.textSecondary, marginTop: -spacing.sm },
    empty: { color: c.textSecondary, fontSize: 14, fontStyle: 'italic' },
  });
}
