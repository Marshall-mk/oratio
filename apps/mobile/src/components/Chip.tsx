import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '@/theme';

interface Props {
  label: string;
  selected: boolean;
  onToggle: () => void;
}

export function Chip({ label, selected, onToggle }: Props) {
  return (
    <Pressable onPress={onToggle} style={[styles.chip, selected && styles.selected]}>
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  selected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  label: { color: colors.textDim, fontSize: 14 },
  labelSelected: { color: colors.text, fontWeight: '600' },
});
