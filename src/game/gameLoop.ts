import { getBlockGameplayHWorklet } from './blockCatalog';
import {
  FALL_SPEED_INITIAL,
  FALL_SPEED_LATE_MAX,
  FALL_SPEED_LATE_RAMP_BLOCKS,
  FALL_SPEED_LATE_START_HEIGHT,
  FALL_SPEED_MAX,
  FALL_SPEED_RAMP_BLOCKS,
  MISS_FALL_GAME_OVER_DELAY_MS,
} from './constants';
import { computeSpawnWorldY, getMaxSwayAmplitudePxWorklet } from './coordinates';
import { computePingPongSwayFromElapsedWorklet } from './swayMotion';

/** 0 = swaying (idle), 1 = falling, 2 = stopped, 3 = tipping off */
export type LoopPhaseCode = 0 | 1 | 2 | 3;

export const LOOP_IDLE = 0 as const;
export const LOOP_DROPPING = 1 as const;
export const LOOP_STOPPED = 2 as const;
export const LOOP_TIPPING = 3 as const;

export interface TickResult {
  phase: LoopPhaseCode;
  swayOffset: number;
  traverseSign: number;
  fallY: number;
  dropSwayOffset: number;
  swayElapsedMs: number;
  isLanding: boolean;
  shouldLand: boolean;
  shouldEndMissFall: boolean;
  fallingCX: number;
  missFallElapsedMs: number;
}

// Worklet-safe difficulty (must stay in sync with difficulty.ts SWAY_BREAKPOINTS)
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

export function getSwayConfigWorklet(
  stackHeight: number,
  canvasWidth: number,
): { amplitude: number; halfPeriod: number } {
  'worklet';
  const reach = getSwayReachWorklet(stackHeight);
  return {
    amplitude: getMaxSwayAmplitudePxWorklet(canvasWidth) * reach,
    halfPeriod: getSwayHalfPeriodWorklet(stackHeight),
  };
}

function getFallSpeedEarlyWorklet(stackHeight: number): number {
  'worklet';
  if (stackHeight <= 1) return FALL_SPEED_INITIAL;
  const t = Math.min(1, (stackHeight - 1) / FALL_SPEED_RAMP_BLOCKS);
  return FALL_SPEED_INITIAL + smoothstepWorklet(t) * (FALL_SPEED_MAX - FALL_SPEED_INITIAL);
}

function getFallSpeedWorklet(stackHeight: number): number {
  'worklet';
  if (stackHeight <= FALL_SPEED_LATE_START_HEIGHT) {
    return getFallSpeedEarlyWorklet(stackHeight);
  }
  const anchor = getFallSpeedEarlyWorklet(FALL_SPEED_LATE_START_HEIGHT);
  const t = Math.min(
    1,
    (stackHeight - FALL_SPEED_LATE_START_HEIGHT) / FALL_SPEED_LATE_RAMP_BLOCKS,
  );
  return anchor + smoothstepWorklet(t) * (FALL_SPEED_LATE_MAX - anchor);
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
  traverseSign: number,
  isLanding: boolean,
  isMissFall: boolean,
  missFallElapsedMs: number,
  nextImageIndex: number,
  deltaMs: number,
): TickResult {
  'worklet';
  const dt = deltaMs / 16.67;
  const fallingH = getBlockGameplayHWorklet(nextImageIndex);

  if (phase === LOOP_IDLE) {
    const { amplitude, halfPeriod } = getSwayConfigWorklet(stackHeight, canvasWidth);
    const nextElapsed = swayElapsedMs + deltaMs;
    const ping = computePingPongSwayFromElapsedWorklet(nextElapsed, amplitude, halfPeriod);
    return {
      phase: LOOP_IDLE,
      swayOffset: ping.swayOffset,
      traverseSign: ping.traverseSign,
      fallY: fallWorldY,
      dropSwayOffset,
      swayElapsedMs: nextElapsed,
      isLanding: false,
      shouldLand: false,
      shouldEndMissFall: false,
      fallingCX: 0,
      missFallElapsedMs,
    };
  }

  if (phase === LOOP_DROPPING) {
    const speed = getFallSpeedWorklet(stackHeight) * dt;
    const lockedSway = dropSwayOffset;

    if (isMissFall) {
      const nextElapsed = missFallElapsedMs + deltaMs;
      return {
        phase: LOOP_DROPPING,
        swayOffset: lockedSway,
        traverseSign,
        fallY: fallWorldY + speed,
        dropSwayOffset: lockedSway,
        swayElapsedMs,
        isLanding: false,
        shouldLand: false,
        shouldEndMissFall: nextElapsed >= MISS_FALL_GAME_OVER_DELAY_MS,
        fallingCX: 0,
        missFallElapsedMs: nextElapsed,
      };
    }

    const nextFallY = fallWorldY + speed;
    const landingWorldY = towerTopWorldY - fallingH;

    if (nextFallY + fallingH >= towerTopWorldY) {
      if (!isLanding) {
        return {
          phase: LOOP_DROPPING,
          swayOffset: lockedSway,
          traverseSign,
          fallY: landingWorldY,
          dropSwayOffset: lockedSway,
          swayElapsedMs,
          isLanding: true,
          shouldLand: true,
          shouldEndMissFall: false,
          fallingCX: swayAnchorCx + lockedSway,
          missFallElapsedMs,
        };
      }
      return {
        phase: LOOP_DROPPING,
        swayOffset: lockedSway,
        traverseSign,
        fallY: landingWorldY,
        dropSwayOffset: lockedSway,
        swayElapsedMs,
        isLanding: true,
        shouldLand: false,
        shouldEndMissFall: false,
        fallingCX: 0,
        missFallElapsedMs,
      };
    }

    return {
      phase: LOOP_DROPPING,
      swayOffset: lockedSway,
      traverseSign,
      fallY: nextFallY,
      dropSwayOffset: lockedSway,
      swayElapsedMs,
      isLanding: false,
      shouldLand: false,
      shouldEndMissFall: false,
      fallingCX: 0,
      missFallElapsedMs,
    };
  }

  return {
    phase: LOOP_STOPPED,
    swayOffset: 0,
    traverseSign: 1,
    fallY: computeSpawnWorldY(towerTopWorldY, fallingH),
    dropSwayOffset: 0,
    swayElapsedMs: 0,
    isLanding: false,
    shouldLand: false,
    shouldEndMissFall: false,
    fallingCX: 0,
    missFallElapsedMs: 0,
  };
}
