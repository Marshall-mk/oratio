import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { WheelPicker } from '@/components/WheelPicker';
import { api } from '@/lib/api';
import { useColors, type AppColors, spacing } from '@/theme';
import type { Challenge } from '@/types/api';

interface Props {
  drills: Challenge[];
  noun?: string;
  category: string;
  group?: string;
  /** When true, "Random" AI-generates a fresh drill instead of picking one. */
  aiRandom?: boolean;
}

/** Wheel picker over a set of drills + a Random option, with a prompt preview. */
export function DrillWheel({ drills, noun = 'drill', category, group, aiRandom = false }: Props) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const generate = useMutation({
    mutationFn: () =>
      api<Challenge>('/challenges/generate', {
        method: 'POST',
        body: JSON.stringify({ category, group }),
      }),
    onSuccess: (drill) => router.push(`/challenge/${drill.id}`),
    onError: () => setError("Couldn't generate a drill — try again."),
  });

  if (drills.length === 0) {
    return <Text style={styles.empty}>No {noun}s here yet.</Text>;
  }

  const items = [...drills.map((d) => d.title), 'Random'];
  const selected = index < drills.length ? drills[index] : null; // null = Random

  function start() {
    setError(null);
    if (selected) {
      router.push(`/challenge/${selected.id}`);
      return;
    }
    if (aiRandom && group) {
      generate.mutate();
    } else {
      const drill = drills[Math.floor(Math.random() * drills.length)];
      router.push(`/challenge/${drill.id}`);
    }
  }

  return (
    <>
      <View style={styles.pickerWrap}>
        <WheelPicker items={items} onChange={setIndex} />
      </View>

      <View style={styles.previewCard}>
        {selected ? (
          <>
            <Text style={styles.previewMeta}>
              {selected.difficulty} · {Math.round(selected.max_speak_seconds / 60) || 1} min
              {selected.mode === 'roleplay' && selected.persona_name
                ? ` · with ${selected.persona_name}`
                : ''}
            </Text>
            <Text style={styles.previewPrompt} numberOfLines={3}>
              {selected.prompt}
            </Text>
          </>
        ) : (
          <Text style={styles.previewPrompt}>
            {aiRandom
              ? `We'll create a fresh ${noun} just for you, based on your profile.`
              : `We'll pick a ${noun} for you.`}
          </Text>
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      <Button
        title={
          selected
            ? `Start ${noun}`
            : aiRandom
              ? generate.isPending
                ? 'Creating your drill…'
                : `Generate a ${noun}`
              : `Start random ${noun}`
        }
        loading={generate.isPending}
        onPress={start}
      />
    </>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    empty: { color: c.textSecondary, fontSize: 14, fontStyle: 'italic', marginTop: spacing.md },
    pickerWrap: { marginVertical: spacing.sm },
    previewCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      padding: spacing.md,
      gap: spacing.sm,
      minHeight: 96,
    },
    previewMeta: { color: c.primary, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
    previewPrompt: { color: c.textPrimary, fontSize: 16, lineHeight: 23 },
    error: { color: c.danger, textAlign: 'center' },
  });
}
