import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useColors, type AppColors } from '@/theme';

interface Props {
  label: string;
  selected: boolean;
  onToggle: () => void;
}

export function Chip({ label, selected, onToggle }: Props) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable onPress={onToggle} style={[styles.chip, selected && styles.selected]}>
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    chip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
    },
    selected: { backgroundColor: c.accentSoft, borderColor: c.accent },
    label: { color: c.textDim, fontSize: 14 },
    labelSelected: { color: c.accent, fontWeight: '600' },
  });
}
