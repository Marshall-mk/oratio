import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A boolean that flips on via `trigger()` and clears itself shortly after —
 * for ephemeral success notes ("Saved ✓") that shouldn't linger on screen.
 */
export function useTransient(ms = 2000): [boolean, () => void] {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = useCallback(() => {
    setOn(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), ms);
  }, [ms]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return [on, trigger];
}
