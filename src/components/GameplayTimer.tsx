import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { runOnJS, SharedValue, useAnimatedReaction } from 'react-native-reanimated';

interface GameplayTimerProps {
  remainingMs: SharedValue<number>;
  visible: boolean;
}

export function GameplayTimer({ remainingMs, visible }: GameplayTimerProps) {
  const [label, setLabel] = useState('15.0');

  useAnimatedReaction(
    () => remainingMs.value,
    (ms) => {
      runOnJS(setLabel)((Math.max(0, ms) / 1000).toFixed(1));
    },
    [remainingMs],
  );

  if (!visible) return null;

  return <Text style={styles.timer}>{label}s</Text>;
}

const styles = StyleSheet.create({
  timer: {
    fontSize: 17,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },
});
