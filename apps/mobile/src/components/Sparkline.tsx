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
    row: { flexDirection: 'row', alignItems: 'flex-end', height: 48, gap: 3 },
    slot: { flex: 1, height: '100%', justifyContent: 'flex-end', backgroundColor: c.track, borderRadius: 3 },
    bar: { borderRadius: 3, minHeight: 3 },
  });
}
