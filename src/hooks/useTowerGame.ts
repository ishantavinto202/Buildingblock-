import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cancelAnimation,
  Easing,
  runOnJS,
  SharedValue,
  useFrameCallback,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { ParticlePool } from '../effects/ParticlePool';
import { cameraComputeTarget, cameraStep } from '../game/CameraManager';
import {
  landingShakeSeverity,
  shakeMagnitudeX,
  shakeMagnitudeY,
} from '../game/cameraShake';
import {
  CAMERA_RESET_MS,
  MIN_DROP_DELAY_MS,
  PARTICLE_DURATION_MS,
  PARTICLE_POOL_SIZE,
  PARTICLES_PER_BURST,
  SCORE_TEXT_DURATION_MS,
  SCORE_TEXT_RISE_PX,
  TIP_INITIAL_ANG_VEL,
  TIP_INITIAL_DROP_VEL,
  TIP_INITIAL_SLIDE_VEL,
} from '../game/constants';
import { getBlockGameplayH, getBlockGameplayW } from '../game/blockCatalog';
import { getGlobalSwayAnchorCx, spawnWorldYForTower } from '../game/coordinates';
import { getSwayConfig } from '../game/difficulty';
import { freezeReanimatedAnimations } from '../game/freezeAnimations';
import {
  getSwayConfigWorklet,
  LOOP_DROPPING,
  LOOP_IDLE,
  LOOP_STOPPED,
  LOOP_TIPPING,
  tickGameFrame,
} from '../game/gameLoop';
import { computeOverlap, computeOverlapGeometry, landBlock, resetState } from '../game/slice';
import {
  computeTowerLeanFromPingPongWorklet,
  rescaleSwayOffsetForAmplitude,
  spawnDirectionToCode,
  spawnSwayOffset,
} from '../game/swayMotion';
import { tickTipFrame } from '../game/tipPhysics';
import { computeTowerMaxLeanRadWorklet } from '../game/towerSway';
import { GameState } from '../game/types';
import { useScoreStore } from '../store/scoreStore';

const MAX_FRAME_DELTA_MS = 50;

export interface TowerGameHook {
  gameState: GameState | null;
  isReady: boolean;
  isPaused: boolean;
  swayOffset: SharedValue<number>;
  swayAnchorCx: SharedValue<number>;
  fallY: SharedValue<number>;
  tipBlockCx: SharedValue<number>;
  tipBlockY: SharedValue<number>;
  tipBlockAngle: SharedValue<number>;
  towerSwayAngle: SharedValue<number>;
  towerPivotCx: SharedValue<number>;
  towerPivotY: SharedValue<number>;
  cameraOffsetY: SharedValue<number>;
  cameraShakeX: SharedValue<number>;
  cameraShakeY: SharedValue<number>;
  particleTs: SharedValue<number>[];
  particleActives: SharedValue<boolean>[];
  particlePool: ParticlePool;
  scoreTextY: SharedValue<number>;
  scoreTextOpacity: SharedValue<number>;
  perfectTrigger: number;
  onTap: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  canvasWidth: number;
  canvasHeight: number;
  onLayout: (w: number, h: number) => void;
}

export function useTowerGame(): TowerGameHook {
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [perfectTrigger, setPerfectTrigger] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const layoutInitialized = useRef(false);
  const isPausedRef = useRef(false);
  isPausedRef.current = isPaused;

  const addPoints = useScoreStore((s) => s.addPoints);
  const resetScore = useScoreStore((s) => s.resetScore);

  const gameStateRef = useRef<GameState | null>(null);
  gameStateRef.current = gameState;

  const swayOffset = useSharedValue(0);
  const swayAnchorCx = useSharedValue(0);
  const fallY = useSharedValue(0);
  const tipBlockCx = useSharedValue(0);
  const tipBlockY = useSharedValue(0);
  const tipBlockAngle = useSharedValue(0);
  const tipVelX = useSharedValue(0);
  const tipVelY = useSharedValue(0);
  const tipAngVel = useSharedValue(0);
  const tipLeverArm = useSharedValue(0);
  const idleStartTimeRef = useRef(0);
  const towerSwayAngle = useSharedValue(0);
  const towerPivotCx = useSharedValue(0);
  const towerPivotY = useSharedValue(0);
  const cameraOffsetY = useSharedValue(0);
  const cameraShakeX = useSharedValue(0);
  const cameraShakeY = useSharedValue(0);
  const scoreTextY = useSharedValue(0);
  const scoreTextOpacity = useSharedValue(0);

  const isPausedShared = useSharedValue(0);
  const loopPhase = useSharedValue<number>(LOOP_IDLE);
  const swayElapsedMs = useSharedValue(0);
  /** 1 = ltr, -1 = rtl — synced with gameState.spawnDirection */
  const spawnDirectionShared = useSharedValue(1);
  /** 1 = moving right, -1 = moving left — bounces at lane edges */
  const traverseSignShared = useSharedValue(1);
  const dropSwayOffset = useSharedValue(0);
  const isLandingFlag = useSharedValue(0);
  const isMissFallShared = useSharedValue(0);
  const missFallElapsedMs = useSharedValue(0);

  const towerTopWorldY = useSharedValue(0);
  const stackLengthShared = useSharedValue(1);
  const canvasWidthShared = useSharedValue(0);
  const canvasHeightShared = useSharedValue(0);
  const nextImageIndexShared = useSharedValue(0);
  const fallingBlockWShared = useSharedValue(80);
  const fallingBlockHShared = useSharedValue(80);

  const particleTs: SharedValue<number>[] = [];
  const particleActives: SharedValue<boolean>[] = [];
  for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    particleTs.push(useSharedValue(0));
    // eslint-disable-next-line react-hooks/rules-of-hooks
    particleActives.push(useSharedValue(false));
  }

  const particlePool = useRef(new ParticlePool()).current;

  const freezeRunningAnimations = useCallback(() => {
    freezeReanimatedAnimations([
      swayOffset,
      fallY,
      tipBlockCx,
      tipBlockY,
      tipBlockAngle,
      tipVelX,
      tipVelY,
      tipAngVel,
      towerSwayAngle,
      cameraOffsetY,
      cameraShakeX,
      cameraShakeY,
      scoreTextY,
      scoreTextOpacity,
      ...particleTs,
    ]);
  }, [
    swayOffset,
    fallY,
    tipBlockCx,
    tipBlockY,
    tipBlockAngle,
    tipVelX,
    tipVelY,
    tipAngVel,
    towerSwayAngle,
    cameraOffsetY,
    cameraShakeX,
    cameraShakeY,
    scoreTextY,
    scoreTextOpacity,
    particleTs,
  ]);

  const syncFallingBlockDims = useCallback(
    (imageIndex: number) => {
      nextImageIndexShared.value = imageIndex;
      fallingBlockWShared.value = getBlockGameplayW(imageIndex);
      fallingBlockHShared.value = getBlockGameplayH(imageIndex);
    },
    [nextImageIndexShared, fallingBlockWShared, fallingBlockHShared],
  );

  const syncTowerPivot = useCallback(
    (baseCx: number, baseY: number, baseImageIndex: number) => {
      towerPivotCx.value = baseCx;
      towerPivotY.value = baseY + getBlockGameplayH(baseImageIndex);
    },
    [towerPivotCx, towerPivotY],
  );

  const clearAllParticles = useCallback(() => {
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      cancelAnimation(particleTs[i]);
      particleActives[i].value = false;
      particlePool.deactivate(i);
    }
  }, [particleTs, particleActives, particlePool]);

  const deactivateParticle = useCallback(
    (idx: number) => {
      particlePool.deactivate(idx);
    },
    [particlePool],
  );

  const handleLandRef = useRef<(fallingCX: number) => void>(() => {});

  const onLandFromWorklet = useCallback((fallingCX: number) => {
    handleLandRef.current(fallingCX);
  }, []);

  const handleTipFallRef = useRef(() => {});

  const onTipFallFromWorklet = useCallback(() => {
    handleTipFallRef.current();
  }, []);

  const handleMissFallEndRef = useRef(() => {});

  const onMissFallEndFromWorklet = useCallback(() => {
    handleMissFallEndRef.current();
  }, []);

  const markIdleStarted = useCallback(() => {
    idleStartTimeRef.current = Date.now();
  }, []);

  const frameCallback = useFrameCallback((frameInfo) => {
    'worklet';
    if (isPausedShared.value === 1 || loopPhase.value === LOOP_STOPPED) return;

    const deltaMs = Math.min(frameInfo.timeSincePreviousFrame ?? 16.67, MAX_FRAME_DELTA_MS);

    const cameraTarget = cameraComputeTarget(canvasHeightShared.value, towerTopWorldY.value);
    cameraOffsetY.value = cameraStep(cameraOffsetY.value, cameraTarget, deltaMs);

    if (loopPhase.value === LOOP_TIPPING) {
      const stackH = stackLengthShared.value;
      const canvasW = canvasWidthShared.value;
      const { amplitude: leanAmplitude } = getSwayConfigWorklet(stackH, canvasW);
      towerSwayAngle.value = computeTowerLeanFromPingPongWorklet(
        computeTowerMaxLeanRadWorklet(stackH),
        swayOffset.value,
        leanAmplitude,
        traverseSignShared.value,
      );

      const tip = tickTipFrame(
        tipBlockCx.value,
        tipBlockY.value,
        tipBlockAngle.value,
        tipVelX.value,
        tipVelY.value,
        tipAngVel.value,
        tipLeverArm.value,
        fallingBlockWShared.value,
        fallingBlockHShared.value,
        canvasWidthShared.value,
        canvasHeightShared.value,
        deltaMs,
      );
      tipBlockCx.value = tip.cx;
      tipBlockY.value = tip.y;
      tipBlockAngle.value = tip.angle;
      tipVelX.value = tip.velX;
      tipVelY.value = tip.velY;
      tipAngVel.value = tip.angVel;
      if (tip.shouldFail) {
        runOnJS(onTipFallFromWorklet)();
      }
      return;
    }

    const result = tickGameFrame(
      loopPhase.value as 0 | 1 | 2 | 3,
      stackLengthShared.value,
      towerTopWorldY.value,
      canvasWidthShared.value,
      swayAnchorCx.value,
      fallY.value,
      swayOffset.value,
      dropSwayOffset.value,
      swayElapsedMs.value,
      traverseSignShared.value,
      isLandingFlag.value === 1,
      isMissFallShared.value === 1,
      missFallElapsedMs.value,
      nextImageIndexShared.value,
      deltaMs,
    );

    loopPhase.value = result.phase;
    swayOffset.value = result.swayOffset;
    traverseSignShared.value = result.traverseSign;
    fallY.value = result.fallY;
    dropSwayOffset.value = result.dropSwayOffset;
    swayElapsedMs.value = result.swayElapsedMs;
    isLandingFlag.value = result.isLanding ? 1 : 0;
    missFallElapsedMs.value = result.missFallElapsedMs;

    const stackH = stackLengthShared.value;
    const canvasW = canvasWidthShared.value;
    const { amplitude: leanAmplitude } = getSwayConfigWorklet(stackH, canvasW);
    towerSwayAngle.value = computeTowerLeanFromPingPongWorklet(
      computeTowerMaxLeanRadWorklet(stackH),
      result.swayOffset,
      leanAmplitude,
      result.traverseSign,
    );

    if (result.shouldLand) {
      runOnJS(onLandFromWorklet)(result.fallingCX);
    }
    if (result.shouldEndMissFall) {
      runOnJS(onMissFallEndFromWorklet)();
    }
  }, false);

  const endGameOver = useCallback(() => {
    isPausedShared.value = 0;
    setIsPaused(false);
    loopPhase.value = LOOP_STOPPED;
    isMissFallShared.value = 0;
    missFallElapsedMs.value = 0;
    isLandingFlag.value = 0;
    frameCallback.setActive(false);
    towerSwayAngle.value = 0;
    cameraShakeX.value = 0;
    cameraShakeY.value = 0;
    swayOffset.value = withTiming(0, { duration: 200 });
    cameraOffsetY.value = withTiming(0, {
      duration: CAMERA_RESET_MS,
      easing: Easing.out(Easing.cubic),
    });
    const state = gameStateRef.current;
    if (!state) return;
    const over: GameState = { ...state, phase: 'game_over' };
    gameStateRef.current = over;
    setGameState(over);
  }, [
    isPausedShared,
    loopPhase,
    frameCallback,
    towerSwayAngle,
    cameraShakeX,
    cameraShakeY,
    swayOffset,
    cameraOffsetY,
  ]);

  const handleLand = useCallback(
    (fallingCX: number) => {
      const state = gameStateRef.current;
      if (!state || state.phase !== 'dropping' || loopPhase.value !== LOOP_DROPPING) return;

      const { nextState, perfect, pointsAwarded } = landBlock(state, fallingCX);

      if (nextState.phase === 'game_over') {
        isMissFallShared.value = 1;
        missFallElapsedMs.value = 0;
        isLandingFlag.value = 0;
        return;
      }

      if (nextState.phase === 'tipping') {
        const topBlock = state.stack[state.stack.length - 1];
        const fallingIdx = state.nextImageIndex;
        const geo = computeOverlapGeometry(
          fallingCX,
          fallingIdx,
          topBlock.cx,
          topBlock.imageIndex,
        );
        const fallingH = getBlockGameplayH(fallingIdx);
        const landingY = topBlock.y - fallingH;

        tipBlockCx.value = fallingCX;
        tipBlockY.value = landingY;
        tipBlockAngle.value = 0;
        tipLeverArm.value = geo.leverArm;
        tipVelX.value = geo.leverArm * TIP_INITIAL_SLIDE_VEL;
        tipVelY.value = TIP_INITIAL_DROP_VEL;
        tipAngVel.value = geo.leverArm * TIP_INITIAL_ANG_VEL;
        loopPhase.value = LOOP_TIPPING;
        isLandingFlag.value = 0;

        const severity = landingShakeSeverity(geo.overlap, state.stack.length);
        if (severity > 0) {
          const mx = shakeMagnitudeX(severity);
          const my = shakeMagnitudeY(severity);
          cancelAnimation(cameraShakeX);
          cancelAnimation(cameraShakeY);
          cameraShakeX.value = withSequence(
            withTiming(mx * 1.2, { duration: 40 }),
            withTiming(-mx * 0.7, { duration: 50 }),
            withTiming(0, { duration: 80 }),
          );
          cameraShakeY.value = withSequence(
            withTiming(my * 1.2, { duration: 40 }),
            withTiming(-my * 0.5, { duration: 50 }),
            withTiming(0, { duration: 80 }),
          );
        }

        const tippingState: GameState = { ...state, phase: 'tipping' };
        gameStateRef.current = tippingState;
        setGameState(tippingState);
        return;
      }

      addPoints(pointsAwarded);

      if (perfect) {
        const topBlock = state.stack[state.stack.length - 1];
        const fallingH = getBlockGameplayH(state.nextImageIndex);
        const burstCX = fallingCX;
        const burstCY = topBlock.y - fallingH / 2;
        const activated = particlePool.activate(burstCX, burstCY, PARTICLES_PER_BURST);
        activated.forEach((idx) => {
          particleActives[idx].value = true;
          particleTs[idx].value = 0;
          particleTs[idx].value = withTiming(1, { duration: PARTICLE_DURATION_MS }, (finished) => {
            'worklet';
            if (finished) {
              particleActives[idx].value = false;
              runOnJS(deactivateParticle)(idx);
            }
          });
        });

        scoreTextY.value = burstCY;
        scoreTextOpacity.value = 1;
        scoreTextY.value = withTiming(burstCY - SCORE_TEXT_RISE_PX, { duration: SCORE_TEXT_DURATION_MS });
        scoreTextOpacity.value = withTiming(0, { duration: SCORE_TEXT_DURATION_MS });

        setPerfectTrigger((n) => n + 1);
      }

      const landedTop = state.stack[state.stack.length - 1];
      const overlap = computeOverlap(
        fallingCX,
        state.nextImageIndex,
        landedTop.cx,
        landedTop.imageIndex,
      );
      const severity = landingShakeSeverity(overlap, state.stack.length);
      if (severity > 0) {
        const mx = shakeMagnitudeX(severity);
        const my = shakeMagnitudeY(severity);
        cancelAnimation(cameraShakeX);
        cancelAnimation(cameraShakeY);
        cameraShakeX.value = withSequence(
          withTiming(mx, { duration: 35 }),
          withTiming(-mx * 0.55, { duration: 45 }),
          withTiming(0, { duration: 70 }),
        );
        cameraShakeY.value = withSequence(
          withTiming(my, { duration: 35 }),
          withTiming(-my * 0.4, { duration: 45 }),
          withTiming(0, { duration: 70 }),
        );
      }

      const topBlock = nextState.stack[nextState.stack.length - 1];
      const canvasW = canvasWidthShared.value;
      const oldSway = getSwayConfig(state.stack.length, canvasW);
      const newSway = getSwayConfig(nextState.stack.length, canvasW);
      if (newSway.amplitude !== oldSway.amplitude) {
        swayOffset.value = rescaleSwayOffsetForAmplitude(
          swayOffset.value,
          oldSway.amplitude,
          newSway.amplitude,
        );
      }

      towerTopWorldY.value = topBlock.y;
      stackLengthShared.value = nextState.stack.length;
      loopPhase.value = LOOP_IDLE;
      swayAnchorCx.value = getGlobalSwayAnchorCx(canvasW);
      spawnDirectionShared.value = spawnDirectionToCode(nextState.spawnDirection);
      isLandingFlag.value = 0;
      fallY.value = spawnWorldYForTower(topBlock.y, getBlockGameplayH(nextState.nextImageIndex));
      syncFallingBlockDims(nextState.nextImageIndex);
      markIdleStarted();

      gameStateRef.current = nextState;
      setGameState(nextState);
    },
    [
      addPoints,
      syncFallingBlockDims,
      cameraOffsetY,
      particlePool,
      particleActives,
      particleTs,
      cameraShakeX,
      cameraShakeY,
      scoreTextY,
      scoreTextOpacity,
      deactivateParticle,
      loopPhase,
      swayElapsedMs,
      isLandingFlag,
      towerTopWorldY,
      stackLengthShared,
      swayOffset,
      fallY,
      swayAnchorCx,
      spawnDirectionShared,
      traverseSignShared,
      markIdleStarted,
      endGameOver,
      frameCallback,
      tipBlockCx,
      tipBlockY,
      tipBlockAngle,
      tipVelX,
      tipVelY,
      tipAngVel,
      tipLeverArm,
    ],
  );

  handleLandRef.current = handleLand;

  const handleMissFallEnd = useCallback(() => {
    const state = gameStateRef.current;
    if (!state || state.phase !== 'dropping' || isMissFallShared.value !== 1) return;
    endGameOver();
  }, [endGameOver]);

  handleMissFallEndRef.current = handleMissFallEnd;

  const handleTipFall = useCallback(() => {
    const state = gameStateRef.current;
    if (!state || state.phase !== 'tipping' || loopPhase.value !== LOOP_TIPPING) return;
    endGameOver();
  }, [endGameOver, loopPhase]);

  handleTipFallRef.current = handleTipFall;

  useEffect(() => {
    if (!isReady) {
      frameCallback.setActive(false);
      return;
    }
    const shouldRun =
      gameState?.phase !== 'game_over' && gameState?.phase !== undefined && !isPaused;
    frameCallback.setActive(shouldRun);
  }, [isReady, gameState?.phase, isPaused, frameCallback]);

  const applyFreshSession = useCallback(
    (w: number, h: number) => {
      const next = resetState(w, h);
      const topBlock = next.stack[next.stack.length - 1];

      clearAllParticles();
      cancelAnimation(swayOffset);
      cancelAnimation(cameraShakeX);
      cancelAnimation(cameraShakeY);

      const base = next.stack[0];
      syncTowerPivot(base.cx, base.y, base.imageIndex);
      syncFallingBlockDims(next.nextImageIndex);
      towerTopWorldY.value = topBlock.y;
      stackLengthShared.value = next.stack.length;
      canvasWidthShared.value = w;
      canvasHeightShared.value = h;
      swayAnchorCx.value = getGlobalSwayAnchorCx(w);
      loopPhase.value = LOOP_IDLE;
      spawnDirectionShared.value = spawnDirectionToCode(next.spawnDirection);
      traverseSignShared.value = spawnDirectionShared.value;
      swayElapsedMs.value = 0;
      const { amplitude } = getSwayConfig(next.stack.length, w);
      swayOffset.value = spawnSwayOffset(amplitude, next.spawnDirection);
      isLandingFlag.value = 0;
      isMissFallShared.value = 0;
      missFallElapsedMs.value = 0;
      dropSwayOffset.value = 0;
      fallY.value = spawnWorldYForTower(topBlock.y, getBlockGameplayH(next.nextImageIndex));
      tipBlockCx.value = 0;
      tipBlockY.value = 0;
      tipBlockAngle.value = 0;
      tipVelX.value = 0;
      tipVelY.value = 0;
      tipAngVel.value = 0;
      tipLeverArm.value = 0;
      cameraShakeX.value = 0;
      cameraShakeY.value = 0;
      scoreTextOpacity.value = 0;
      cameraOffsetY.value = withTiming(0, {
        duration: CAMERA_RESET_MS,
        easing: Easing.out(Easing.cubic),
      });
      markIdleStarted();

      gameStateRef.current = next;
      setGameState(next);
      frameCallback.setActive(true);
    },
    [
      clearAllParticles,
      towerTopWorldY,
      stackLengthShared,
      canvasWidthShared,
      canvasHeightShared,
      swayAnchorCx,
      spawnDirectionShared,
      traverseSignShared,
      loopPhase,
      swayElapsedMs,
      isLandingFlag,
      dropSwayOffset,
      fallY,
      swayOffset,
      towerSwayAngle,
      cameraShakeX,
      cameraShakeY,
      syncTowerPivot,
      syncFallingBlockDims,
      scoreTextOpacity,
      cameraOffsetY,
      markIdleStarted,
      frameCallback,
    ],
  );

  const pauseGame = useCallback(() => {
    const state = gameStateRef.current;
    if (
      !state ||
      state.phase === 'game_over' ||
      state.phase === 'tipping' ||
      isPausedRef.current
    ) {
      return;
    }

    isPausedShared.value = 1;
    setIsPaused(true);
    frameCallback.setActive(false);
    freezeRunningAnimations();
  }, [isPausedShared, frameCallback, freezeRunningAnimations]);

  const resumeGame = useCallback(() => {
    if (!isPausedRef.current) return;
    const state = gameStateRef.current;
    if (!state || state.phase === 'game_over') return;

    isPausedShared.value = 0;
    setIsPaused(false);
    frameCallback.setActive(true);
  }, [isPausedShared, frameCallback]);

  const restartGame = useCallback(() => {
    if (canvasSize.width <= 0 || canvasSize.height <= 0) return;

    isPausedShared.value = 0;
    setIsPaused(false);
    resetScore();
    applyFreshSession(canvasSize.width, canvasSize.height);
  }, [canvasSize, isPausedShared, resetScore, applyFreshSession]);

  const beginDrop = useCallback(() => {
    const state = gameStateRef.current;
    if (!state || state.phase !== 'idle' || isPausedRef.current) return;
    if (Date.now() - idleStartTimeRef.current < MIN_DROP_DELAY_MS) return;

    dropSwayOffset.value = swayOffset.value;
    isLandingFlag.value = 0;
    isMissFallShared.value = 0;
    missFallElapsedMs.value = 0;
    loopPhase.value = LOOP_DROPPING;
    const top = state.stack[state.stack.length - 1];
    fallY.value = spawnWorldYForTower(top.y, getBlockGameplayH(state.nextImageIndex));

    const dropping: GameState = { ...state, phase: 'dropping' };
    gameStateRef.current = dropping;
    setGameState(dropping);
  }, [dropSwayOffset, swayOffset, isLandingFlag, loopPhase, fallY]);

  const onTap = useCallback(() => {
    const state = gameStateRef.current;
    if (!state || isPausedRef.current) return;

    if (state.phase === 'idle') {
      beginDrop();
      return;
    }

    if (state.phase === 'dropping' || state.phase === 'tipping') return;

    if (state.phase !== 'game_over') return;
    if (canvasSize.width <= 0 || canvasSize.height <= 0) return;

    resetScore();
    applyFreshSession(canvasSize.width, canvasSize.height);
  }, [beginDrop, resetScore, canvasSize, applyFreshSession]);

  const onLayout = useCallback(
    (w: number, h: number) => {
      if (w <= 0 || h <= 0) return;

      setCanvasSize({ width: w, height: h });
      canvasWidthShared.value = w;
      canvasHeightShared.value = h;

      if (!layoutInitialized.current) {
        layoutInitialized.current = true;
        const next = resetState(w, h);
        const topBlock = next.stack[next.stack.length - 1];
        towerTopWorldY.value = topBlock.y;
        stackLengthShared.value = next.stack.length;
        cameraOffsetY.value = 0;
        swayAnchorCx.value = getGlobalSwayAnchorCx(w);
        loopPhase.value = LOOP_IDLE;
        spawnDirectionShared.value = spawnDirectionToCode(next.spawnDirection);
        traverseSignShared.value = spawnDirectionShared.value;
        swayElapsedMs.value = 0;
        const { amplitude } = getSwayConfig(next.stack.length, w);
        swayOffset.value = spawnSwayOffset(amplitude, next.spawnDirection);
        isLandingFlag.value = 0;
        fallY.value = spawnWorldYForTower(topBlock.y, getBlockGameplayH(next.nextImageIndex));
        cameraShakeX.value = 0;
        cameraShakeY.value = 0;
        syncTowerPivot(next.stack[0].cx, next.stack[0].y, next.stack[0].imageIndex);
        syncFallingBlockDims(next.nextImageIndex);
        markIdleStarted();
        gameStateRef.current = next;
        setGameState(next);
        setIsReady(true);
      }
    },
    [
      canvasWidthShared,
      canvasHeightShared,
      towerTopWorldY,
      stackLengthShared,
      swayAnchorCx,
      spawnDirectionShared,
      traverseSignShared,
      loopPhase,
      swayElapsedMs,
      isLandingFlag,
      fallY,
      swayOffset,
      markIdleStarted,
      syncTowerPivot,
      syncFallingBlockDims,
      towerSwayAngle,
      cameraShakeX,
      cameraShakeY,
    ],
  );

  return {
    gameState,
    isReady,
    isPaused,
    swayOffset,
    swayAnchorCx,
    fallY,
    tipBlockCx,
    tipBlockY,
    tipBlockAngle,
    towerSwayAngle,
    towerPivotCx,
    towerPivotY,
    cameraOffsetY,
    cameraShakeX,
    cameraShakeY,
    particleTs,
    particleActives,
    particlePool,
    scoreTextY,
    scoreTextOpacity,
    perfectTrigger,
    onTap,
    pauseGame,
    resumeGame,
    restartGame,
    canvasWidth: canvasSize.width,
    canvasHeight: canvasSize.height,
    onLayout,
  };
}
