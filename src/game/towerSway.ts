import {
  SWAY_HORIZONTAL_SPEED_MULT,
  TOWER_MIN_STACK_HEIGHT_FOR_SWAY,
  TOWER_SWAY_FRACTION,
  TOWER_SWAY_MAX_DEG,
} from './constants';

// Worklet tables — keep in sync with difficulty.ts / gameLoop.ts
const SWAY_BP_HEIGHT = [0, 10, 20, 30, 50, 75, 100] as const;
const SWAY_BP_REACH = [0.74, 0.78, 0.85, 0.92, 0.94, 0.97, 1.0] as const;
const SWAY_BP_HALF = [1350, 1260, 1100, 860, 780, 660, 560] as const;

function smoothstepWorklet(t: number): number {
  'worklet';
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function lerpWorklet(a: number, b: number, t: number): number {
  'worklet';
  return a + (b - a) * smoothstepWorklet(t);
}

function getSwayReachWorklet(stackHeight: number): number {
  'worklet';
  if (stackHeight <= SWAY_BP_HEIGHT[0]) return SWAY_BP_REACH[0];
  const last = SWAY_BP_HEIGHT.length - 1;
  if (stackHeight >= SWAY_BP_HEIGHT[last]) return SWAY_BP_REACH[last];
  for (let i = 1; i < SWAY_BP_HEIGHT.length; i++) {
    const prevH = SWAY_BP_HEIGHT[i - 1];
    const currH = SWAY_BP_HEIGHT[i];
    if (stackHeight <= currH) {
      const t = (stackHeight - prevH) / (currH - prevH);
      return lerpWorklet(SWAY_BP_REACH[i - 1], SWAY_BP_REACH[i], t);
    }
  }
  return SWAY_BP_REACH[last];
}

function getSwayHalfPeriodWorklet(stackHeight: number): number {
  'worklet';
  if (stackHeight <= SWAY_BP_HEIGHT[0]) return SWAY_BP_HALF[0];
  const last = SWAY_BP_HEIGHT.length - 1;
  if (stackHeight >= SWAY_BP_HEIGHT[last]) return SWAY_BP_HALF[last];
  for (let i = 1; i < SWAY_BP_HEIGHT.length; i++) {
    const prevH = SWAY_BP_HEIGHT[i - 1];
    const currH = SWAY_BP_HEIGHT[i];
    if (stackHeight <= currH) {
      const t = (stackHeight - prevH) / (currH - prevH);
      return lerpWorklet(SWAY_BP_HALF[i - 1], SWAY_BP_HALF[i], t);
    }
  }
  return SWAY_BP_HALF[last];
}

/** Max tower lean (radians) for a stack height — pairs with ping-pong sway in swayMotion. */
export function computeTowerMaxLeanRadWorklet(stackHeight: number): number {
  'worklet';
  if (stackHeight < TOWER_MIN_STACK_HEIGHT_FOR_SWAY) {
    return 0;
  }
  const reach = getSwayReachWorklet(stackHeight);
  return ((TOWER_SWAY_MAX_DEG * Math.PI) / 180) * reach * TOWER_SWAY_FRACTION;
}

/**
 * Tower lean from a continuous clock — kept for reference; runtime uses ping-pong coupling.
 * Phase only resets on full game restart.
 */
export function computeTowerSwayAngleRad(
  stackHeight: number,
  elapsedMs: number,
): number {
  'worklet';
  const maxRad = computeTowerMaxLeanRadWorklet(stackHeight);
  if (maxRad <= 0) return 0;

  const halfPeriod = getSwayHalfPeriodWorklet(stackHeight);
  const periodMs = halfPeriod * 2;
  const phase = (2 * Math.PI * elapsedMs * SWAY_HORIZONTAL_SPEED_MULT) / periodMs;
  return maxRad * Math.sin(phase);
}
