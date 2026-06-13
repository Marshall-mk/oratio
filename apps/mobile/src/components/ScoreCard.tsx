import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme';

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

function scoreColor(score: number): string {
  if (score >= 7.5) return colors.success;
  if (score >= 5.5) return '#E8B931';
  return colors.danger;
}

export function ScoreCard({ stage, score, summary, dimensions, previousScore }: Props) {
  const [expanded, setExpanded] = useState(false);
  const delta = previousScore !== undefined ? score - previousScore : null;

  return (
    <Pressable style={styles.card} onPress={() => setExpanded(!expanded)}>
      <View style={styles.headerRow}>
        <Text style={styles.stage}>{STAGE_LABELS[stage] ?? stage}</Text>
        <View style={styles.scoreRow}>
          {delta !== null && (
            <Text style={[styles.delta, { color: delta >= 0 ? colors.success : colors.danger }]}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}
            </Text>
          )}
          <Text style={[styles.score, { color: scoreColor(score) }]}>{score.toFixed(1)}</Text>
        </View>
      </View>

      {summary ? <Text style={styles.summary}>{summary}</Text> : null}

      {expanded && (
        <View style={styles.dimensions}>
          {dimensions.map((d) => (
            <View key={d.dimension} style={styles.dimensionRow}>
              <View style={styles.dimensionHeader}>
                <Text style={styles.dimensionName}>{d.dimension}</Text>
                <Text style={[styles.dimensionScore, { color: scoreColor(d.score) }]}>
                  {d.score.toFixed(1)}
                </Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${d.score * 10}%`, backgroundColor: scoreColor(d.score) },
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stage: { fontSize: 17, fontWeight: '700', color: colors.text },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  delta: { fontSize: 13, fontWeight: '700' },
  score: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  summary: { fontSize: 13, color: colors.textDim, lineHeight: 19 },
  dimensions: { gap: spacing.md, marginTop: spacing.xs },
  dimensionRow: { gap: 4 },
  dimensionHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  dimensionName: { fontSize: 13, color: colors.text, textTransform: 'capitalize', fontWeight: '600' },
  dimensionScore: { fontSize: 13, fontWeight: '700' },
  barTrack: { height: 4, borderRadius: 2, backgroundColor: colors.border },
  barFill: { height: 4, borderRadius: 2 },
  rationale: { fontSize: 12, color: colors.textDim, lineHeight: 17 },
  expandHint: { fontSize: 11, color: colors.textDim, textAlign: 'center', marginTop: 2 },
});
