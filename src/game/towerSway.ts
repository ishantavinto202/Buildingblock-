import {
  BLOCK_W,
  SWAY_EDGE_INSET_PX,
  TOWER_MIN_STACK_HEIGHT_FOR_SWAY,
  TOWER_SWAY_FRACTION,
  TOWER_SWAY_MAX_DEG,
} from './constants';

// Worklet tables — keep in sync with difficulty.ts / gameLoop.ts
const SWAY_BP_HEIGHT = [0, 4, 8, 12, 16, 20] as const;
const SWAY_BP_REACH = [0.86, 0.9, 0.93, 0.96, 0.98, 1.0] as const;
const SWAY_BP_HALF = [950, 880, 780, 680, 580, 500] as const;

function lerpWorklet(a: number, b: number, t: number): number {
  'worklet';
  return a + (b - a) * t;
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

/**
 * Tower rotation (rad) around its base, 180° out of phase with the falling block sway.
 */
export function computeTowerSwayAngleRad(
  stackHeight: number,
  canvasWidth: number,
  swayElapsedMs: number,
): number {
  'worklet';
  if (stackHeight < TOWER_MIN_STACK_HEIGHT_FOR_SWAY || canvasWidth <= 0) {
    return 0;
  }

  const reach = getSwayReachWorklet(stackHeight);
  const halfPeriod = getSwayHalfPeriodWorklet(stackHeight);
  const periodMs = halfPeriod * 2;
  const phase = (2 * Math.PI * swayElapsedMs) / periodMs;
  const maxRad = ((TOWER_SWAY_MAX_DEG * Math.PI) / 180) * reach * TOWER_SWAY_FRACTION;
  return maxRad * Math.sin(phase + Math.PI);
}
