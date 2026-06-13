import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { useColors, type AppColors } from '@/theme';

interface Props {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
  style?: StyleProp<ViewStyle>;
}

export function Button({ title, onPress, disabled, loading, variant = 'primary', style }: Props) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const variantStyle = isPrimary ? styles.primary : isDanger ? styles.danger : styles.ghost;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        variantStyle,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={isPrimary ? c.onAccent : isDanger ? c.danger : c.accent} />
      ) : (
        <Text style={[styles.text, isDanger ? styles.dangerText : !isPrimary && styles.ghostText]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    base: {
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primary: { backgroundColor: c.accent },
    ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.border },
    danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.danger },
    disabled: { opacity: 0.4 },
    pressed: { opacity: 0.8 },
    text: { color: c.onAccent, fontSize: 16, fontWeight: '600' },
    ghostText: { color: c.text },
    dangerText: { color: c.danger },
  });
}
