import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useColors, type AppColors } from '@/theme';

/** Dependency-free bar sparkline for 1-10 score series. */
export function Sparkline({ points, color }: { points: number[]; color: string }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  if (points.length === 0) return null;
  return (
    <View style={styles.row}>
      {points.slice(-14).map((p, i) => (
        <View key={i} style={styles.slot}>
          <View style={[styles.bar, { height: `${p * 10}%`, backgroundColor: color }]} />
        </View>
      ))}
    </View>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    // Bars are capped at maxWidth so a handful of attempts render as slender
    // bars (not wide squares); with many attempts flex shrinks them to fit.
    row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-start', height: 44, gap: 6 },
    slot: { flex: 1, maxWidth: 22, height: '100%', justifyContent: 'flex-end', backgroundColor: c.progressTrack, borderRadius: 4 },
    bar: { borderRadius: 4, minHeight: 3 },
  });
}
