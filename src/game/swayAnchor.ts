/**
 * Horizontal anchor for the moving block — always the screen center,
 * never derived from the top-of-stack block position.
 */
export function getGlobalSwayAnchorCx(canvasWidth: number): number {
  return canvasWidth / 2;
}

/** Randomize sway phase so each new block does not start at a predictable position. */
export function applySwayPhaseJitter(currentElapsedMs: number, halfPeriodMs: number): number {
  const periodMs = halfPeriodMs * 2;
  return currentElapsedMs + Math.random() * periodMs;
}
