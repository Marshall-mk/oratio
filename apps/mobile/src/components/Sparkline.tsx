import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

/** Dependency-free bar sparkline for 1-10 score series. */
export function Sparkline({ points, color }: { points: number[]; color: string }) {
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

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', height: 48, gap: 3 },
  slot: { flex: 1, height: '100%', justifyContent: 'flex-end', backgroundColor: colors.bg, borderRadius: 3 },
  bar: { borderRadius: 3, minHeight: 3 },
});
