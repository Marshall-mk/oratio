import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useColors, type AppColors, radius, scoreColor, spacing } from '@/theme';

/** A completed attempt, as returned in `/me/progress` → `recent_attempts`. */
export interface AttemptRowData {
  challenge_title: string;
  challenge_category: string;
  attempt_number: number;
  overall_score: number | null;
  created_at: string;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * A non-interactive record of a past attempt: title, category · number · date, and score.
 * Purely informational — it's how you see what you've worked on, not a link to a detail view.
 */
export function AttemptRow({ attempt }: { attempt: AttemptRowData }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const color = scoreColor(c, attempt.overall_score ?? 0);

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.title} numberOfLines={1}>
          {attempt.challenge_title}
        </Text>
        <Text style={styles.meta}>
          {attempt.challenge_category} · #{attempt.attempt_number} · {fmtDate(attempt.created_at)}
        </Text>
      </View>
      <View style={[styles.scorePill, { backgroundColor: `${color}22` }]}>
        <Text style={[styles.scorePillText, { color }]}>
          {attempt.overall_score?.toFixed(1) ?? '–'}
        </Text>
      </View>
    </View>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: spacing.md,
    },
    left: { flex: 1 },
    title: { fontSize: 16, fontWeight: '700', color: c.textPrimary },
    meta: { fontSize: 12, color: c.textMuted, marginTop: 3, textTransform: 'capitalize' },
    scorePill: {
      minWidth: 48,
      height: 40,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
    },
    scorePillText: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  });
}
