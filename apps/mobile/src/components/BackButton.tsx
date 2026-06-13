import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useColors, type AppColors, spacing } from '@/theme';

/** A comfortably-sized back control: chevron + label, tinted, with a large hit area. */
export function BackButton({ label = 'Back', onPress }: { label?: string; onPress: () => void }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={16}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.6 }]}>
      <Ionicons name="chevron-back" size={24} color={c.accent} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      alignSelf: 'flex-start',
      paddingVertical: spacing.sm,
      paddingRight: spacing.md,
      marginLeft: -4,
      marginBottom: spacing.xs,
    },
    label: { color: c.accent, fontSize: 17, fontWeight: '600' },
  });
}
