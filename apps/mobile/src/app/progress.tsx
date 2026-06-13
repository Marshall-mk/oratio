import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Sparkline } from '@/components/Sparkline';
import { api } from '@/lib/api';
import { colors, spacing } from '@/theme';

interface StageSeries {
  stage: string;
  points: number[];
  average: number | null;
  latest: number | null;
  delta_vs_first: number | null;
}

interface Progress {
  total_attempts: number;
  total_speaking_seconds: number;
  communication_iq: number | null;
  stages: StageSeries[];
  recent_attempts: {
    attempt_id: string;
    challenge_title: string;
    challenge_category: string;
    attempt_number: number;
    overall_score: number | null;
    created_at: string;
  }[];
}

const STAGE_COLORS: Record<string, string> = {
  thought: '#7C5CFF',
  structure: '#3DDC97',
  delivery: '#E8B931',
  social: '#FF7AB6',
  comprehension: '#4FB8FF',
  vocabulary: '#5EE6C4',
};

export default function ProgressScreen() {
  const router = useRouter();
  const { data } = useQuery({
    queryKey: ['progress'],
    queryFn: () => api<Progress>('/me/progress'),
  });

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>
      <Text style={styles.title}>Your progress</Text>

      <View style={styles.statRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{data?.communication_iq ?? '—'}</Text>
          <Text style={styles.statLabel}>Communication IQ</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{data?.total_attempts ?? '—'}</Text>
          <Text style={styles.statLabel}>Attempts</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            {data ? Math.round(data.total_speaking_seconds / 60) : '—'}
          </Text>
          <Text style={styles.statLabel}>Minutes spoken</Text>
        </View>
      </View>

      {(data?.stages ?? []).filter((s) => s.points.length > 0).map((s) => (
        <View key={s.stage} style={styles.stageCard}>
          <View style={styles.stageHeader}>
            <Text style={styles.stageName}>{s.stage}</Text>
            <View style={styles.stageNumbers}>
              {s.delta_vs_first !== null && (
                <Text
                  style={[
                    styles.delta,
                    { color: s.delta_vs_first >= 0 ? colors.success : colors.danger },
                  ]}>
                  {s.delta_vs_first >= 0 ? '▲' : '▼'} {Math.abs(s.delta_vs_first).toFixed(1)} since first
                </Text>
              )}
              <Text style={[styles.stageScore, { color: STAGE_COLORS[s.stage] }]}>
                {s.latest?.toFixed(1) ?? '—'}
              </Text>
            </View>
          </View>
          {s.points.length > 0 ? (
            <Sparkline points={s.points} color={STAGE_COLORS[s.stage]} />
          ) : (
            <Text style={styles.empty}>No attempts yet</Text>
          )}
          <Text style={styles.average}>avg {s.average?.toFixed(1) ?? '—'} · {s.points.length} scored attempts</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Recent attempts</Text>
      {(data?.recent_attempts ?? []).map((a) => (
        <Pressable
          key={a.attempt_id}
          style={styles.attemptRow}
          onPress={() =>
            router.push({ pathname: '/results/[attemptId]', params: { attemptId: a.attempt_id } })
          }>
          <View style={{ flex: 1 }}>
            <Text style={styles.attemptTitle}>{a.challenge_title}</Text>
            <Text style={styles.attemptMeta}>
              {a.challenge_category} · attempt #{a.attempt_number} ·{' '}
              {new Date(a.created_at).toLocaleDateString()}
            </Text>
          </View>
          <Text style={styles.attemptScore}>{a.overall_score?.toFixed(1) ?? '…'}</Text>
        </Pressable>
      ))}
      {data && data.recent_attempts.length === 0 && (
        <Text style={styles.empty}>Complete your first challenge to see progress here.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingTop: 70, paddingBottom: 60, gap: spacing.md },
  back: { color: colors.textDim, fontSize: 16 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  statBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 11, color: colors.textDim, textAlign: 'center' },
  stageCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.sm,
  },
  stageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stageName: { fontSize: 16, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
  stageNumbers: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  delta: { fontSize: 12, fontWeight: '600' },
  stageScore: { fontSize: 22, fontWeight: '800' },
  average: { fontSize: 12, color: colors.textDim },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  attemptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  attemptTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  attemptMeta: { fontSize: 12, color: colors.textDim, marginTop: 2, textTransform: 'capitalize' },
  attemptScore: { fontSize: 18, fontWeight: '800', color: colors.accent },
  empty: { color: colors.textDim, fontSize: 14, fontStyle: 'italic' },
});
