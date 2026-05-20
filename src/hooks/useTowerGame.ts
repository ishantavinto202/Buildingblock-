import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  useFrameCallback,
  runOnJS,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { SharedValue } from 'react-native-reanimated';
import { useScoreStore } from '../store/scoreStore';
import { landBlock, resetState } from '../game/slice';
import { getSwayConfig, getFallSpeed } from '../game/difficulty';
import { ParticlePool } from '../effects/ParticlePool';
import { GameState } from '../game/types';
import {
  SPAWN_Y, BLOCK_H,
  PARTICLES_PER_BURST, PARTICLE_POOL_SIZE, PARTICLE_DURATION_MS,
  SCORE_TEXT_DURATION_MS, SCORE_TEXT_RISE_PX,
  TOWER_SWAY_FRACTION, TOWER_SPRING,
} from '../game/constants';

export interface TowerGameHook {
  gameState: GameState;
  swayOffset: SharedValue<number>;
  fallY: SharedValue<number>;
  towerSwayOffset: SharedValue<number>;
  particleTs: SharedValue<number>[];
  particleActives: SharedValue<boolean>[];
  particlePool: ParticlePool;
  scoreTextY: SharedValue<number>;
  scoreTextOpacity: SharedValue<number>;
  perfectTrigger: number;
  onTap: () => void;
  canvasWidth: number;
  canvasHeight: number;
  onLayout: (w: number, h: number) => void;
}

export function useTowerGame(): TowerGameHook {
  const [canvasSize, setCanvasSize] = useState({ width: 390, height: 844 });
  const addPoints = useScoreStore((s) => s.addPoints);
  const resetScore = useScoreStore((s) => s.resetScore);
  const [perfectTrigger, setPerfectTrigger] = useState(0);

  const [gameState, setGameState] = useState<GameState>(() =>
    resetState(canvasSize.width, canvasSize.height)
  );
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // Keep canvas size in a ref for the frame callback worklet
  const canvasSizeRef = useRef(canvasSize);
  canvasSizeRef.current = canvasSize;

  // Shared values
  const swayOffset = useSharedValue(0);
  const fallY = useSharedValue(SPAWN_Y);
  const towerSwayOffset = useSharedValue(0);
  const scoreTextY = useSharedValue(0);
  const scoreTextOpacity = useSharedValue(0);

  // Per-particle animation values — fixed pool size, hooks called at top level
  const particleTs: SharedValue<number>[] = [];
  const particleActives: SharedValue<boolean>[] = [];
  for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    particleTs.push(useSharedValue(0));
    // eslint-disable-next-line react-hooks/rules-of-hooks
    particleActives.push(useSharedValue(false));
  }

  const particlePool = useRef(new ParticlePool()).current;

  // Sway animation
  const startSway = useCallback((stackHeight: number) => {
    const { amplitude, halfPeriod } = getSwayConfig(stackHeight);
    cancelAnimation(swayOffset);
    if (amplitude === 0) {
      swayOffset.value = 0;
      return;
    }
    swayOffset.value = withRepeat(
      withSequence(
        withTiming(-amplitude, { duration: halfPeriod, easing: Easing.inOut(Easing.sin) }),
        withTiming(amplitude, { duration: halfPeriod, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [swayOffset]);

  // Landing callback — called from UI thread via runOnJS
  const handleLand = useCallback((fallingCX: number) => {
    const state = gameStateRef.current;
    if (state.phase !== 'dropping') return;

    const { nextState, perfect, pointsAwarded } = landBlock(state, fallingCX);

    if (nextState.phase === 'game_over') {
      cancelAnimation(swayOffset);
      cancelAnimation(towerSwayOffset);
      swayOffset.value = withTiming(0, { duration: 200 });
      towerSwayOffset.value = withTiming(0, { duration: 400 });
      setGameState(nextState);
      return;
    }

    addPoints(pointsAwarded);

    if (perfect) {
      const topBlock = state.stack[state.stack.length - 1];
      const burstCX = fallingCX;
      const burstCY = topBlock.y - BLOCK_H / 2;
      const activated = particlePool.activate(burstCX, burstCY, PARTICLES_PER_BURST);
      activated.forEach((idx) => {
        particleActives[idx].value = true;
        particleTs[idx].value = 0;
        particleTs[idx].value = withTiming(1, { duration: PARTICLE_DURATION_MS }, (finished) => {
          'worklet';
          if (finished) {
            particleActives[idx].value = false;
            runOnJS(particlePool.deactivate.bind(particlePool))(idx);
          }
        });
      });

      scoreTextY.value = burstCY;
      scoreTextOpacity.value = 1;
      scoreTextY.value = withTiming(burstCY - SCORE_TEXT_RISE_PX, { duration: SCORE_TEXT_DURATION_MS });
      scoreTextOpacity.value = withTiming(0, { duration: SCORE_TEXT_DURATION_MS });

      setPerfectTrigger((n) => n + 1);
    }

    // Tower sway on landing
    const newStackHeight = nextState.stack.length;
    const { amplitude } = getSwayConfig(newStackHeight);
    const towerAmplitude = amplitude * TOWER_SWAY_FRACTION;
    if (towerAmplitude > 0) {
      towerSwayOffset.value = withSpring(-towerAmplitude, TOWER_SPRING, () => {
        'worklet';
        towerSwayOffset.value = withSpring(0, TOWER_SPRING);
      });
    }

    setGameState(nextState);
  }, [addPoints, particlePool, particleActives, particleTs, swayOffset, towerSwayOffset, scoreTextY, scoreTextOpacity]);

  // Auto-transition from idle to dropping
  useEffect(() => {
    if (gameState.phase === 'idle') {
      fallY.value = SPAWN_Y;
      startSway(gameState.stack.length);
      setGameState((prev) => ({ ...prev, phase: 'dropping' }));
    }
  }, [gameState.phase, gameState.stack.length, fallY, startSway]);

  // Frame callback: fall physics + collision
  useFrameCallback((frameInfo) => {
    'worklet';
    const state = gameStateRef.current;
    if (state.phase !== 'dropping') return;

    const dt = (frameInfo.timeSincePreviousFrame ?? 16.67) / 16.67;
    const speed = getFallSpeed(state.stack.length) * dt;
    fallY.value = fallY.value + speed;

    const topBlock = state.stack[state.stack.length - 1];
    const fallingBottom = fallY.value + BLOCK_H;
    if (fallingBottom >= topBlock.y) {
      fallY.value = topBlock.y - BLOCK_H;
      const fallingCX = canvasSizeRef.current.width / 2 + swayOffset.value;
      runOnJS(handleLand)(fallingCX);
    }
  }, true);

  const onTap = useCallback(() => {
    const state = gameStateRef.current;
    if (state.phase === 'game_over') {
      cancelAnimation(swayOffset);
      const next = resetState(canvasSizeRef.current.width, canvasSizeRef.current.height);
      resetScore();
      setGameState(next);
    }
  }, [resetScore, swayOffset]);

  const onLayout = useCallback((w: number, h: number) => {
    setCanvasSize({ width: w, height: h });
    // Re-initialize game state with correct canvas dimensions
    setGameState(resetState(w, h));
  }, []);

  return {
    gameState,
    swayOffset,
    fallY,
    towerSwayOffset,
    particleTs,
    particleActives,
    particlePool,
    scoreTextY,
    scoreTextOpacity,
    perfectTrigger,
    onTap,
    canvasWidth: canvasSize.width,
    canvasHeight: canvasSize.height,
    onLayout,
  };
}
