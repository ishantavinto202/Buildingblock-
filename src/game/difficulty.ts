import { SwayConfig } from './types';
import {
  FALL_SPEED_INITIAL,
  FALL_SPEED_LATE_MAX,
  FALL_SPEED_LATE_RAMP_BLOCKS,
  FALL_SPEED_LATE_START_HEIGHT,
  FALL_SPEED_MAX,
  FALL_SPEED_RAMP_BLOCKS,
} from './constants';
import { getMaxSwayAmplitudePx } from './coordinates';

interface SwayBreakpoint {
  height: number;
  /** 0–1 fraction of max horizontal travel (edge to edge) */
  reach: number;
  halfPeriod: number;
}

/** Must stay in sync with gameLoop.ts SWAY_BP_* worklet tables */
export const SWAY_BREAKPOINTS: SwayBreakpoint[] = [
  { height: 0, reach: 0.74, halfPeriod: 1350 },
  { height: 10, reach: 0.78, halfPeriod: 1260 },
  { height: 20, reach: 0.85, halfPeriod: 1100 },
  { height: 30, reach: 0.92, halfPeriod: 860 },
  { height: 50, reach: 0.94, halfPeriod: 780 },
  { height: 75, reach: 0.97, halfPeriod: 660 },
  { height: 100, reach: 1.0, halfPeriod: 560 },
];

function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * smoothstep(t);
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

function getFallSpeedEarly(stackHeight: number): number {
  if (stackHeight <= 1) return FALL_SPEED_INITIAL;
  const t = Math.min(1, (stackHeight - 1) / FALL_SPEED_RAMP_BLOCKS);
  return FALL_SPEED_INITIAL + smoothstep(t) * (FALL_SPEED_MAX - FALL_SPEED_INITIAL);
}

/**
 * Fall speed (px/frame at 60fps). Early curve unchanged through LATE_START_HEIGHT;
 * a second softer phase caps late-game drop speed.
 */
export function getFallSpeed(stackHeight: number): number {
  if (stackHeight <= FALL_SPEED_LATE_START_HEIGHT) {
    return getFallSpeedEarly(stackHeight);
  }
  const anchor = getFallSpeedEarly(FALL_SPEED_LATE_START_HEIGHT);
  const t = Math.min(
    1,
    (stackHeight - FALL_SPEED_LATE_START_HEIGHT) / FALL_SPEED_LATE_RAMP_BLOCKS,
  );
  return anchor + smoothstep(t) * (FALL_SPEED_LATE_MAX - anchor);
}
