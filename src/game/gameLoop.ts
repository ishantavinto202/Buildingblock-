import { BLOCK_H, BLOCK_W, SPAWN_ABOVE_TOWER_PX, SWAY_EDGE_INSET_PX } from './constants';

function spawnYWorklet(towerTopWorldY: number): number {
  'worklet';
  return towerTopWorldY - BLOCK_H - SPAWN_ABOVE_TOWER_PX;
}

/** 0 = swaying (idle), 1 = falling, 2 = stopped, 3 = tipping off */
export type LoopPhaseCode = 0 | 1 | 2 | 3;

export const LOOP_IDLE = 0 as const;
export const LOOP_DROPPING = 1 as const;
export const LOOP_STOPPED = 2 as const;
export const LOOP_TIPPING = 3 as const;

export interface TickResult {
  phase: LoopPhaseCode;
  swayOffset: number;
  fallY: number;
  dropSwayOffset: number;
  swayElapsedMs: number;
  isLanding: boolean;
  shouldLand: boolean;
  fallingCX: number;
}

// Worklet-safe difficulty (must stay in sync with difficulty.ts SWAY_BREAKPOINTS)
const SWAY_BP_HEIGHT = [0, 4, 8, 12, 16, 20] as const;
const SWAY_BP_REACH = [0.86, 0.9, 0.93, 0.96, 0.98, 1.0] as const;
const SWAY_BP_HALF = [950, 880, 780, 680, 580, 500] as const;

function maxSwayAmplitudeWorklet(canvasWidth: number): number {
  'worklet';
  if (canvasWidth <= 0) return 0;
  return Math.max(0, canvasWidth / 2 - BLOCK_W / 2 - SWAY_EDGE_INSET_PX);
}

function lerpWorklet(a: number, b: number, t: number): number {
  'worklet';
  return a + (b - a) * t;
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

function getSwayConfigWorklet(
  stackHeight: number,
  canvasWidth: number,
): { amplitude: number; halfPeriod: number } {
  'worklet';
  const reach = getSwayReachWorklet(stackHeight);
  return {
    amplitude: maxSwayAmplitudeWorklet(canvasWidth) * reach,
    halfPeriod: getSwayHalfPeriodWorklet(stackHeight),
  };
}

function getFallSpeedWorklet(stackHeight: number): number {
  'worklet';
  const increments = Math.floor(stackHeight / 5);
  return Math.min(6 + increments * 0.3, 12);
}

/**
 * One frame of gameplay physics — runs on the UI thread (Reanimated worklet).
 * All Y values are world-space; camera is not used here.
 */
export function tickGameFrame(
  phase: LoopPhaseCode,
  stackHeight: number,
  towerTopWorldY: number,
  canvasWidth: number,
  swayAnchorCx: number,
  fallWorldY: number,
  swayOffset: number,
  dropSwayOffset: number,
  swayElapsedMs: number,
  isLanding: boolean,
  deltaMs: number,
): TickResult {
  'worklet';
  const dt = deltaMs / 16.67;

  if (phase === LOOP_IDLE) {
    const { amplitude, halfPeriod } = getSwayConfigWorklet(stackHeight, canvasWidth);
    const elapsed = swayElapsedMs + deltaMs;
    const periodMs = halfPeriod * 2;
    const sway = amplitude * Math.sin((2 * Math.PI * elapsed) / periodMs);
    return {
      phase: LOOP_IDLE,
      swayOffset: sway,
      fallY: spawnYWorklet(towerTopWorldY),
      dropSwayOffset,
      swayElapsedMs: elapsed,
      isLanding: false,
      shouldLand: false,
      fallingCX: 0,
    };
  }

  if (phase === LOOP_DROPPING) {
    const speed = getFallSpeedWorklet(stackHeight) * dt;
    const nextFallY = fallWorldY + speed;
    const lockedSway = dropSwayOffset;
    const landingWorldY = towerTopWorldY - BLOCK_H;

    if (nextFallY + BLOCK_H >= towerTopWorldY) {
      if (!isLanding) {
        return {
          phase: LOOP_DROPPING,
          swayOffset: lockedSway,
          fallY: landingWorldY,
          dropSwayOffset: lockedSway,
          swayElapsedMs,
          isLanding: true,
          shouldLand: true,
          fallingCX: swayAnchorCx + lockedSway,
        };
      }
      return {
        phase: LOOP_DROPPING,
        swayOffset: lockedSway,
        fallY: landingWorldY,
        dropSwayOffset: lockedSway,
        swayElapsedMs,
        isLanding: true,
        shouldLand: false,
        fallingCX: 0,
      };
    }

    return {
      phase: LOOP_DROPPING,
      swayOffset: lockedSway,
      fallY: nextFallY,
      dropSwayOffset: lockedSway,
      swayElapsedMs,
      isLanding: false,
      shouldLand: false,
      fallingCX: 0,
    };
  }

  return {
    phase: LOOP_STOPPED,
    swayOffset: 0,
    fallY: spawnYWorklet(towerTopWorldY),
    dropSwayOffset: 0,
    swayElapsedMs: 0,
    isLanding: false,
    shouldLand: false,
    fallingCX: 0,
  };
}
