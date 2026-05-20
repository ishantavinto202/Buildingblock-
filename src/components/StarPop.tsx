import { useEffect } from 'react';
import * as Haptics from 'expo-haptics';

interface StarPopProps {
  /** Increment this value to trigger a new burst */
  trigger: number;
}

/**
 * Fires a haptic pulse whenever `trigger` increments.
 * Rendering is handled by GameCanvas; this component owns only the side-effect.
 */
export function StarPop({ trigger }: StarPopProps) {
  useEffect(() => {
    if (trigger === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [trigger]);

  return null;
}
