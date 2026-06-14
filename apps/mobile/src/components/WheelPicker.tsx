import { useMemo, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useColors, type AppColors } from '@/theme';

const ITEM_HEIGHT = 48;
const VISIBLE = 5;

interface Props {
  items: string[];
  initialIndex?: number;
  onChange: (index: number) => void;
}

/** iOS-style snapping wheel picker — no native module. */
export function WheelPicker({ items, initialIndex = 0, onChange }: Props) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [index, setIndex] = useState(initialIndex);
  const ref = useRef<ScrollView>(null);
  const height = ITEM_HEIGHT * VISIBLE;
  const pad = (height - ITEM_HEIGHT) / 2;

  function nearest(e: NativeSyntheticEvent<NativeScrollEvent>): number {
    return Math.max(
      0,
      Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT)),
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <View pointerEvents="none" style={[styles.band, { top: pad, height: ITEM_HEIGHT }]} />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: initialIndex * ITEM_HEIGHT }}
        scrollEventThrottle={16}
        onScroll={(e) => {
          const i = nearest(e);
          if (i !== index) setIndex(i);
        }}
        onMomentumScrollEnd={(e) => {
          const i = nearest(e);
          setIndex(i);
          onChange(i);
        }}
        contentContainerStyle={{ paddingVertical: pad }}>
        {items.map((label, i) => {
          const active = i === index;
          return (
            <View key={i} style={styles.item}>
              <Text
                numberOfLines={1}
                style={[styles.label, active ? styles.labelActive : styles.labelInactive]}>
                {label}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { position: 'relative' },
    band: {
      position: 'absolute',
      left: 0,
      right: 0,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: c.borderStrong,
      backgroundColor: c.surfaceMuted,
      borderRadius: 10,
    },
    item: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
    label: { fontSize: 18 },
    labelActive: { color: c.textPrimary, fontWeight: '700', fontSize: 19 },
    labelInactive: { color: c.textMuted, fontWeight: '400' },
  });
}
