import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors, type AppColors, scoreColor, spacing } from '@/theme';

interface Dimension {
  dimension: string;
  score: number;
  rationale: string;
}

interface Props {
  stage: string;
  score: number;
  summary?: string | null;
  dimensions: Dimension[];
  previousScore?: number;
}

const STAGE_LABELS: Record<string, string> = {
  thought: 'Thought',
  structure: 'Structure',
  delivery: 'Delivery',
  social: 'Social',
};

export function ScoreCard({ stage, score, summary, dimensions, previousScore }: Props) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [expanded, setExpanded] = useState(false);
  const delta = previousScore !== undefined ? score - previousScore : null;

  return (
    <Pressable style={styles.card} onPress={() => setExpanded(!expanded)}>
      <View style={styles.headerRow}>
        <Text style={styles.stage}>{STAGE_LABELS[stage] ?? stage}</Text>
        <View style={styles.scoreRow}>
          {delta !== null && (
            <Text style={[styles.delta, { color: delta >= 0 ? c.success : c.warning }]}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}
            </Text>
          )}
          <Text style={[styles.score, { color: scoreColor(c, score) }]}>{score.toFixed(1)}</Text>
        </View>
      </View>

      {summary ? <Text style={styles.summary}>{summary}</Text> : null}

      {expanded && (
        <View style={styles.dimensions}>
          {dimensions.map((d) => (
            <View key={d.dimension} style={styles.dimensionRow}>
              <View style={styles.dimensionHeader}>
                <Text style={styles.dimensionName}>{d.dimension}</Text>
                <Text style={[styles.dimensionScore, { color: scoreColor(c, d.score) }]}>
                  {d.score.toFixed(1)}
                </Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${d.score * 10}%`, backgroundColor: scoreColor(c, d.score) },
                  ]}
                />
              </View>
              <Text style={styles.rationale}>{d.rationale}</Text>
            </View>
          ))}
        </View>
      )}
      <Text style={styles.expandHint}>{expanded ? 'Hide details' : 'Tap for details'}</Text>
    </Pressable>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      padding: spacing.md,
      gap: spacing.sm,
    },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    stage: { fontSize: 17, fontWeight: '700', color: c.textPrimary },
    scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    delta: { fontSize: 13, fontWeight: '700' },
    score: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
    summary: { fontSize: 13, color: c.textSecondary, lineHeight: 19 },
    dimensions: { gap: spacing.md, marginTop: spacing.xs },
    dimensionRow: { gap: 4 },
    dimensionHeader: { flexDirection: 'row', justifyContent: 'space-between' },
    dimensionName: { fontSize: 13, color: c.textPrimary, textTransform: 'capitalize', fontWeight: '600' },
    dimensionScore: { fontSize: 13, fontWeight: '700' },
    barTrack: { height: 4, borderRadius: 2, backgroundColor: c.progressTrack },
    barFill: { height: 4, borderRadius: 2 },
    rationale: { fontSize: 12, color: c.textSecondary, lineHeight: 17 },
    expandHint: { fontSize: 11, color: c.textSecondary, textAlign: 'center', marginTop: 2 },
  });
}
