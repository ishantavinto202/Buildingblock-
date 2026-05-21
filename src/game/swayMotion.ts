import { SWAY_HORIZONTAL_SPEED_MULT } from './constants';

/** 1 = moving toward +amplitude (right); -1 = moving toward -amplitude (left) */
export type TraverseSignCode = 1 | -1;

export type SpawnDirection = 'ltr' | 'rtl';

/** Initial lane side + first travel direction when a new block spawns */
export function spawnDirectionToCode(dir: SpawnDirection): TraverseSignCode {
  return dir === 'ltr' ? 1 : -1;
}

export function flipSpawnDirection(dir: SpawnDirection): SpawnDirection {
  return dir === 'ltr' ? 'rtl' : 'ltr';
}

/** Starting sway offset at spawn: left for ltr, right for rtl */
export function spawnSwayOffset(amplitude: number, dir: SpawnDirection): number {
  return dir === 'ltr' ? -amplitude : amplitude;
}

export function spawnSwayOffsetWorklet(amplitude: number, spawnDirection: number): number {
  'worklet';
  return spawnDirection >= 0 ? -amplitude : amplitude;
}

/**
 * Continuous ping-pong between lane bounds.
 * One half-crossing scales with halfPeriodMs / SWAY_HORIZONTAL_SPEED_MULT.
 */
export function tickPingPongSwayWorklet(
  swayOffset: number,
  traverseSign: number,
  amplitude: number,
  halfPeriodMs: number,
  deltaMs: number,
): { swayOffset: number; traverseSign: number } {
  'worklet';
  if (amplitude <= 0) {
    return { swayOffset: 0, traverseSign: 1 };
  }

  const periodMs = halfPeriodMs * 2;
  const step = ((2 * amplitude * deltaMs) / periodMs) * SWAY_HORIZONTAL_SPEED_MULT;
  let next = swayOffset + traverseSign * step;
  let sign = traverseSign;

  if (next >= amplitude) {
    next = amplitude;
    sign = -1;
  } else if (next <= -amplitude) {
    next = -amplitude;
    sign = 1;
  }

  return { swayOffset: next, traverseSign: sign };
}

/** Preserve lane position when difficulty amplitude changes after a placement. */
export function rescaleSwayOffsetForAmplitudeWorklet(
  swayOffset: number,
  oldAmplitude: number,
  newAmplitude: number,
): number {
  'worklet';
  if (newAmplitude <= 0) return 0;
  if (oldAmplitude <= 0) return Math.max(-newAmplitude, Math.min(newAmplitude, swayOffset));
  const scaled = (swayOffset / oldAmplitude) * newAmplitude;
  return Math.max(-newAmplitude, Math.min(newAmplitude, scaled));
}

export function rescaleSwayOffsetForAmplitude(
  swayOffset: number,
  oldAmplitude: number,
  newAmplitude: number,
): number {
  if (newAmplitude <= 0) return 0;
  if (oldAmplitude <= 0) return Math.max(-newAmplitude, Math.min(newAmplitude, swayOffset));
  const scaled = (swayOffset / oldAmplitude) * newAmplitude;
  return Math.max(-newAmplitude, Math.min(newAmplitude, scaled));
}

/** Tower lean opposite to instantaneous travel direction */
export function computeTowerLeanFromPingPongWorklet(
  maxRad: number,
  swayOffset: number,
  amplitude: number,
  traverseSign: number,
): number {
  'worklet';
  if (amplitude <= 0) return 0;
  const norm = Math.max(-1, Math.min(1, swayOffset / amplitude));
  return maxRad * Math.sin((norm * Math.PI) / 2 + Math.PI);
}
