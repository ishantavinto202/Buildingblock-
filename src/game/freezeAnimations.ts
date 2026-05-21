import { cancelAnimation, SharedValue } from 'react-native-reanimated';

/** Stops in-flight Reanimated animations without changing current values. */
export function freezeReanimatedAnimations(
  values: SharedValue<number>[],
): void {
  for (const sv of values) {
    cancelAnimation(sv);
  }
}
