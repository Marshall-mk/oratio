import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Sparkline } from '@/components/Sparkline';
import { api } from '@/lib/api';
import { colors, radius, scoreColor, spacing } from '@/theme';

interface StageSeries {
  stage: string;
  points: number[];
  average: number | null;
  latest: number | null;
  delta_vs_first: number | null;
}

interface DimensionStat {
  dimension: string;
  stage: string;
  average: number;
}

interface RecentAttempt {
  attempt_id: string;
  challenge_title: string;
  challenge_category: string;
  attempt_number: number;
  overall_score: number | null;
  created_at: string;
}

interface Progress {
  total_attempts: number;
  total_speaking_seconds: number;
  communication_iq: number | null;
  iq_delta: number | null;
  stages: StageSeries[];
  recent_attempts: RecentAttempt[];
  advanced_metrics: Record<string, number | null> | null;
  detection_counts: Record<string, number>;
  strengths: DimensionStat[];
  weaknesses: DimensionStat[];
}

const STAGE_COLORS: Record<string, string> = {
  thought: '#7C5CFF',
  structure: '#3DDC97',
  delivery: '#E8B931',
  social: '#FF7AB6',
  comprehension: '#4FB8FF',
  vocabulary: '#5EE6C4',
};

const STAGE_LABELS: Record<string, string> = {
  thought: 'Thought',
  structure: 'Structure',
  delivery: 'Delivery',
  social: 'Social',
  comprehension: 'Comprehension',
  vocabulary: 'Vocabulary',
};

const METRIC_LABELS: Record<string, string> = {
  wpm: 'Words / min',
  filler_rate: 'Fillers /100',
  unique_ratio: 'Vocab variety',
  avg_sentence_length: 'Avg sentence',
  reading_ease: 'Readability',
  questions_per_attempt: 'Questions',
};

function Delta({ value, suffix }: { value: number; suffix?: string }) {
  if (value === 0) return null;
  const up = value > 0;
  return (
    <Text style={[styles.delta, { color: up ? colors.success : colors.danger }]}>
      {up ? '▲' : '▼'} {Math.abs(value)}
      {suffix}
    </Text>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ProgressScreen() {
  const router = useRouter();
  const { data } = useQuery({ queryKey: ['progress'], queryFn: () => api<Progress>('/me/progress') });

  const stages = (data?.stages ?? []).filter((s) => s.points.length > 0);
  const hasData = (data?.total_attempts ?? 0) > 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Progress</Text>

      {/* Communication IQ hero */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.heroLabel}>Communication IQ</Text>
          {data?.iq_delta != null && <Delta value={data.iq_delta} />}
        </View>
        <Text style={styles.heroValue}>{data?.communication_iq ?? '—'}</Text>
        <Text style={styles.heroHint}>
          {hasData ? 'Composite of every score you earn' : 'Complete a challenge to begin'}
        </Text>
      </View>

      {/* Secondary stats */}
      <View style={styles.statRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{data?.total_attempts ?? 0}</Text>
          <Text style={styles.statLabel}>Attempts</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            {data ? Math.round(data.total_speaking_seconds / 60) : 0}
          </Text>
          <Text style={styles.statLabel}>Minutes spoken</Text>
        </View>
      </View>

      {/* By stage */}
      {stages.length > 0 && (
        <>
          <Text style={styles.sectionHeader}>By stage</Text>
          <View style={styles.card}>
            {stages.map((s, i) => {
              const color = STAGE_COLORS[s.stage] ?? colors.accent;
              const pct = Math.max(4, Math.min(100, (s.latest ?? 0) * 10));
              return (
                <View key={s.stage} style={[styles.stageRow, i > 0 && styles.stageDivider]}>
                  <View style={styles.stageHead}>
                    <Text style={styles.stageName}>{STAGE_LABELS[s.stage] ?? s.stage}</Text>
                    <Text style={[styles.stageScore, { color }]}>{s.latest?.toFixed(1) ?? '—'}</Text>
                  </View>
                  <View style={styles.meterTrack}>
                    <View style={[styles.meterFill, { width: `${pct}%`, backgroundColor: color }]} />
                  </View>
                  <View style={styles.stageMeta}>
                    <Text style={styles.metaDim}>
                      avg {s.average?.toFixed(1) ?? '—'} · {s.points.length}{' '}
                      {s.points.length === 1 ? 'attempt' : 'attempts'}
                    </Text>
                    {s.delta_vs_first != null && <Delta value={s.delta_vs_first} suffix=" since start" />}
                  </View>
                  {s.points.length > 1 && (
                    <View style={styles.spark}>
                      <Sparkline points={s.points} color={color} />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Speaking metrics */}
      {data?.advanced_metrics && (
        <>
          <Text style={styles.sectionHeader}>Speaking metrics</Text>
          <View style={[styles.card, styles.metricGrid]}>
            {Object.entries(data.advanced_metrics)
              .filter(([, v]) => v != null)
              .map(([k, v]) => (
                <View key={k} style={styles.metricItem}>
                  <Text style={styles.metricValue}>{v}</Text>
                  <Text style={styles.metricLabel}>{METRIC_LABELS[k] ?? k}</Text>
                </View>
              ))}
          </View>
        </>
      )}

      {/* Strengths / weaknesses */}
      {data && (data.strengths.length > 0 || data.weaknesses.length > 0) && (
        <View style={styles.twoCol}>
          <View style={[styles.card, styles.dimCard]}>
            <Text style={[styles.dimHeader, { color: colors.success }]}>Strengths</Text>
            {data.strengths.map((d, i) => (
              <View key={i} style={styles.dimRow}>
                <Text style={styles.dimName} numberOfLines={1}>{d.dimension}</Text>
                <Text style={[styles.dimScore, { color: colors.success }]}>{d.average.toFixed(1)}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.card, styles.dimCard]}>
            <Text style={[styles.dimHeader, { color: colors.danger }]}>Work on</Text>
            {data.weaknesses.map((d, i) => (
              <View key={i} style={styles.dimRow}>
                <Text style={styles.dimName} numberOfLines={1}>{d.dimension}</Text>
                <Text style={[styles.dimScore, { color: colors.danger }]}>{d.average.toFixed(1)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Habits to watch */}
      {data && Object.keys(data.detection_counts).length > 0 && (
        <>
          <Text style={styles.sectionHeader}>Habits to watch</Text>
          <View style={styles.pills}>
            {Object.entries(data.detection_counts)
              .sort((a, b) => b[1] - a[1])
              .map(([name, count]) => (
                <View key={name} style={styles.pill}>
                  <Text style={styles.pillText}>{name.replace(/_/g, ' ')}</Text>
                  <Text style={styles.pillCount}>{count}</Text>
                </View>
              ))}
          </View>
        </>
      )}

      {/* Recent attempts */}
      <Text style={styles.sectionHeader}>Recent attempts</Text>
      {(data?.recent_attempts ?? []).map((a) => (
        <Pressable
          key={a.attempt_id}
          style={({ pressed }) => [styles.attemptRow, pressed && { opacity: 0.7 }]}
          onPress={() =>
            router.push({ pathname: '/results/[attemptId]', params: { attemptId: a.attempt_id } })
          }>
          <View style={styles.attemptLeft}>
            <Text style={styles.attemptTitle} numberOfLines={1}>{a.challenge_title}</Text>
            <Text style={styles.attemptMeta}>
              {a.challenge_category} · #{a.attempt_number} · {fmtDate(a.created_at)}
            </Text>
          </View>
          <View
            style={[
              styles.scorePill,
              { backgroundColor: `${scoreColor(a.overall_score ?? 0)}22` },
            ]}>
            <Text style={[styles.scorePillText, { color: scoreColor(a.overall_score ?? 0) }]}>
              {a.overall_score?.toFixed(1) ?? '–'}
            </Text>
          </View>
        </Pressable>
      ))}
      {data && data.recent_attempts.length === 0 && (
        <Text style={styles.empty}>Complete your first challenge to see it here.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  container: { padding: spacing.lg, paddingTop: 70, paddingBottom: 48, gap: spacing.md },
  title: { fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },

  hero: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 2,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: {
    color: '#C8BEFF',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroValue: { color: colors.text, fontSize: 52, fontWeight: '900', letterSpacing: -1 },
  heroHint: { color: colors.textDim, fontSize: 13 },

  statRow: { flexDirection: 'row', gap: spacing.md },
  statBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  statValue: { fontSize: 26, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, color: colors.textDim, marginTop: 2 },

  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.sm,
  },

  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },

  stageRow: { gap: spacing.sm },
  stageDivider: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, marginTop: spacing.md },
  stageHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  stageName: { fontSize: 17, fontWeight: '700', color: colors.text },
  stageScore: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  meterTrack: { height: 10, borderRadius: radius.pill, backgroundColor: colors.track, overflow: 'hidden' },
  meterFill: { height: 10, borderRadius: radius.pill },
  stageMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaDim: { fontSize: 12, color: colors.textFaint },
  delta: { fontSize: 12, fontWeight: '700' },
  spark: { marginTop: spacing.xs },

  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.lg, columnGap: spacing.sm },
  metricItem: { width: '30%' },
  metricValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  metricLabel: { fontSize: 11, color: colors.textDim, marginTop: 2 },

  twoCol: { flexDirection: 'row', gap: spacing.md },
  dimCard: { flex: 1, padding: spacing.md, gap: spacing.sm },
  dimHeader: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  dimRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dimName: { color: colors.text, fontSize: 13, textTransform: 'capitalize', flex: 1, marginRight: 6 },
  dimScore: { fontSize: 14, fontWeight: '800' },

  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  pillText: { color: colors.text, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  pillCount: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
    backgroundColor: '#3a1414',
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    overflow: 'hidden',
  },

  attemptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  attemptLeft: { flex: 1 },
  attemptTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  attemptMeta: { fontSize: 12, color: colors.textFaint, marginTop: 3, textTransform: 'capitalize' },
  scorePill: {
    minWidth: 48,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  scorePillText: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },

  empty: { color: colors.textDim, fontSize: 14, fontStyle: 'italic' },
});
