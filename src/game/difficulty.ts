import { SwayConfig } from './types';
import { FALL_SPEED_INITIAL, FALL_SPEED_INCREMENT, FALL_SPEED_MAX } from './constants';

interface DifficultyBreakpoint {
  height: number;
  amplitude: number;
  halfPeriod: number;
}

const BREAKPOINTS: DifficultyBreakpoint[] = [
  { height: 0,  amplitude: 0,  halfPeriod: 1000 },
  { height: 4,  amplitude: 0,  halfPeriod: 1000 },
  { height: 8,  amplitude: 8,  halfPeriod: 1000 },
  { height: 12, amplitude: 20, halfPeriod: 800  },
  { height: 16, amplitude: 40, halfPeriod: 650  },
  { height: 20, amplitude: 65, halfPeriod: 550  },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Returns sway amplitude (px) and half-period (ms) for a given stack height.
 * Values are linearly interpolated between breakpoints.
 */
export function getSwayConfig(stackHeight: number): SwayConfig {
  if (stackHeight <= BREAKPOINTS[0].height) {
    return { amplitude: BREAKPOINTS[0].amplitude, halfPeriod: BREAKPOINTS[0].halfPeriod };
  }

  const last = BREAKPOINTS[BREAKPOINTS.length - 1];
  if (stackHeight >= last.height) {
    return { amplitude: last.amplitude, halfPeriod: last.halfPeriod };
  }

  for (let i = 1; i < BREAKPOINTS.length; i++) {
    const prev = BREAKPOINTS[i - 1];
    const curr = BREAKPOINTS[i];
    if (stackHeight <= curr.height) {
      const t = (stackHeight - prev.height) / (curr.height - prev.height);
      return {
        amplitude: lerp(prev.amplitude, curr.amplitude, t),
        halfPeriod: lerp(prev.halfPeriod, curr.halfPeriod, t),
      };
    }
  }

  return { amplitude: last.amplitude, halfPeriod: last.halfPeriod };
}

/**
 * Fall speed (px/frame at 60fps) for a given stack height.
 */
export function getFallSpeed(stackHeight: number): number {
  const increments = Math.floor(stackHeight / 5);
  return Math.min(FALL_SPEED_INITIAL + increments * FALL_SPEED_INCREMENT, FALL_SPEED_MAX);
}
