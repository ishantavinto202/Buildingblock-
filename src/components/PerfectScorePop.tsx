import { StyleSheet } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { PERFECT_POINTS } from '../game/constants';

const LABEL = `+${PERFECT_POINTS}`;

interface PerfectScorePopProps {
  y: SharedValue<number>;
  opacity: SharedValue<number>;
  cameraOffsetY: SharedValue<number>;
  cameraShakeY: SharedValue<number>;
  canvasWidth: number;
}

/** Floating "+500" label driven by Reanimated shared values from the game hook. */
export function PerfectScorePop({
  y,
  opacity,
  cameraOffsetY,
  cameraShakeY,
  canvasWidth,
}: PerfectScorePopProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    top: y.value + cameraOffsetY.value + cameraShakeY.value,
    left: canvasWidth / 2 - 20,
    opacity: opacity.value,
  }));

  return (
    <Animated.Text style={[styles.label, animatedStyle]} pointerEvents="none">
      {LABEL}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  label: {
    position: 'absolute',
    fontSize: 24,
    fontWeight: '800',
    color: '#FFD700',
    letterSpacing: 1,
  },
});
