import { TIP_FAIL_ANGLE_RAD, TIP_GRAVITY, TIP_TORQUE_ACCEL } from './constants';

export interface TipState {
  cx: number;
  y: number;
  angle: number;
  velX: number;
  velY: number;
  angVel: number;
}

export interface TipTickResult extends TipState {
  shouldFail: boolean;
}

/**
 * One frame of unstable-block physics — runs on the UI thread (worklet).
 * Block pivots from its center; torque comes from off-center support.
 */
export function tickTipFrame(
  cx: number,
  y: number,
  angle: number,
  velX: number,
  velY: number,
  angVel: number,
  leverArm: number,
  blockW: number,
  blockH: number,
  canvasWidth: number,
  canvasHeight: number,
  deltaMs: number,
): TipTickResult {
  'worklet';
  const dt = deltaMs / 16.67;
  const halfW = blockW / 2;

  const torque = leverArm * TIP_TORQUE_ACCEL * dt;
  const nextAngVel = angVel + torque;
  const nextAngle = angle + nextAngVel * dt;
  const nextVelY = velY + TIP_GRAVITY * dt;
  const nextVelX = velX + leverArm * 0.12 * dt;
  const nextCx = cx + nextVelX * dt;
  const nextY = y + nextVelY * dt;

  const offScreenX =
    nextCx + halfW < -halfW * 0.25 || nextCx - halfW > canvasWidth + halfW * 0.25;
  const fellBelow = nextY > canvasHeight + blockH;
  const tippedOver = Math.abs(nextAngle) >= TIP_FAIL_ANGLE_RAD;

  const shouldFail = offScreenX || fellBelow || tippedOver;

  return {
    cx: nextCx,
    y: nextY,
    angle: nextAngle,
    velX: nextVelX,
    velY: nextVelY,
    angVel: nextAngVel,
    shouldFail,
  };
}
