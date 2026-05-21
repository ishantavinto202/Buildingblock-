import { SwayConfig } from './types';
import {
  BLOCK_W,
  FALL_SPEED_INITIAL,
  FALL_SPEED_INCREMENT,
  FALL_SPEED_MAX,
  SWAY_EDGE_INSET_PX,
} from './constants';

interface SwayBreakpoint {
  height: number;
  /** 0–1 fraction of max horizontal travel (edge to edge) */
  reach: number;
  halfPeriod: number;
}

/** Must stay in sync with gameLoop.ts SWAY_BP_* worklet tables */
export const SWAY_BREAKPOINTS: SwayBreakpoint[] = [
  { height: 0, reach: 0.86, halfPeriod: 950 },
  { height: 4, reach: 0.9, halfPeriod: 880 },
  { height: 8, reach: 0.93, halfPeriod: 780 },
  { height: 12, reach: 0.96, halfPeriod: 680 },
  { height: 16, reach: 0.98, halfPeriod: 580 },
  { height: 20, reach: 1.0, halfPeriod: 500 },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Max horizontal sway (px) from center so block edges stay inside the screen.
 * centerX = anchor + sway → edges at anchor ± sway ± BLOCK_W/2
 */
export function getMaxSwayAmplitudePx(canvasWidth: number): number {
  if (canvasWidth <= 0) return 0;
  return Math.max(0, canvasWidth / 2 - BLOCK_W / 2 - SWAY_EDGE_INSET_PX);
}

export function getSwayReachFraction(stackHeight: number): number {
  if (stackHeight <= SWAY_BREAKPOINTS[0].height) {
    return SWAY_BREAKPOINTS[0].reach;
  }

  const last = SWAY_BREAKPOINTS[SWAY_BREAKPOINTS.length - 1];
  if (stackHeight >= last.height) {
    return last.reach;
  }

  for (let i = 1; i < SWAY_BREAKPOINTS.length; i++) {
    const prev = SWAY_BREAKPOINTS[i - 1];
    const curr = SWAY_BREAKPOINTS[i];
    if (stackHeight <= curr.height) {
      const t = (stackHeight - prev.height) / (curr.height - prev.height);
      return lerp(prev.reach, curr.reach, t);
    }
  }

  return last.reach;
}

function getSwayHalfPeriod(stackHeight: number): number {
  if (stackHeight <= SWAY_BREAKPOINTS[0].height) {
    return SWAY_BREAKPOINTS[0].halfPeriod;
  }

  const last = SWAY_BREAKPOINTS[SWAY_BREAKPOINTS.length - 1];
  if (stackHeight >= last.height) {
    return last.halfPeriod;
  }

  for (let i = 1; i < SWAY_BREAKPOINTS.length; i++) {
    const prev = SWAY_BREAKPOINTS[i - 1];
    const curr = SWAY_BREAKPOINTS[i];
    if (stackHeight <= curr.height) {
      const t = (stackHeight - prev.height) / (curr.height - prev.height);
      return lerp(prev.halfPeriod, curr.halfPeriod, t);
    }
  }

  return last.halfPeriod;
}

/**
 * Returns sway amplitude (px) and half-period (ms) for a given stack height.
 * Amplitude scales with canvas width so movement spans nearly the full screen.
 */
export function getSwayConfig(stackHeight: number, canvasWidth: number): SwayConfig {
  const reach = getSwayReachFraction(stackHeight);
  return {
    amplitude: getMaxSwayAmplitudePx(canvasWidth) * reach,
    halfPeriod: getSwayHalfPeriod(stackHeight),
  };
}

/**
 * Fall speed (px/frame at 60fps) for a given stack height.
 */
export function getFallSpeed(stackHeight: number): number {
  const increments = Math.floor(stackHeight / 5);
  return Math.min(FALL_SPEED_INITIAL + increments * FALL_SPEED_INCREMENT, FALL_SPEED_MAX);
}
