import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SKY_BACKGROUND_COLOR } from '../game/background';
import { useTowerGame } from '../hooks/useTowerGame';
import { useScoreStore } from '../store/scoreStore';
import { GameCanvas } from './GameCanvas';
import { GameHUD } from './GameHUD';
import { PauseButton } from './PauseButton';
import { PauseMenu } from './PauseMenu';
import { PerfectScorePop } from './PerfectScorePop';
import { StarPop } from './StarPop';

export function TowerGameScreen() {
  const insets = useSafeAreaInsets();
  const loadHighScore = useScoreStore((s) => s.loadHighScore);
  const score = useScoreStore((s) => s.score);

  const {
    gameState,
    lives,
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
    canvasWidth,
    canvasHeight,
    onLayout,
  } = useTowerGame();

  useEffect(() => {
    loadHighScore();
  }, [loadHighScore]);

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(250)
        .enabled(!isPaused && gameState?.phase !== 'tipping')
        .onEnd(() => {
          runOnJS(onTap)();
        }),
    [onTap, isPaused],
  );

  const isGameOver = gameState?.phase === 'game_over';
  const canPause = isReady && !isGameOver && gameState?.phase !== 'tipping' && !isPaused;

  return (
    <View style={[styles.container, { backgroundColor: SKY_BACKGROUND_COLOR }]}>
      <GestureDetector gesture={tapGesture}>
        <View
          style={styles.fill}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            onLayout(width, height);
          }}
        >
          {isReady && gameState && (
            <>
              <GameCanvas
                width={canvasWidth}
                height={canvasHeight}
                gameState={gameState}
                swayOffset={swayOffset}
                swayAnchorCx={swayAnchorCx}
                fallY={fallY}
                tipBlockCx={tipBlockCx}
                tipBlockY={tipBlockY}
                tipBlockAngle={tipBlockAngle}
                towerSwayAngle={towerSwayAngle}
                towerPivotCx={towerPivotCx}
                towerPivotY={towerPivotY}
                cameraOffsetY={cameraOffsetY}
                cameraShakeX={cameraShakeX}
                cameraShakeY={cameraShakeY}
                particleTs={particleTs}
                particleActives={particleActives}
                particlePool={particlePool}
                isPaused={isPaused}
              />
              <PerfectScorePop
                y={scoreTextY}
                opacity={scoreTextOpacity}
                cameraOffsetY={cameraOffsetY}
                cameraShakeY={cameraShakeY}
                canvasWidth={canvasWidth}
              />
            </>
          )}
        </View>
      </GestureDetector>

      {isReady && (
        <PauseButton
          onPress={pauseGame}
          topInset={insets.top}
          rightInset={insets.right}
          disabled={!canPause}
        />
      )}

      <PauseMenu
        visible={isPaused}
        onResume={resumeGame}
        onRestart={restartGame}
      />

      <GameHUD
        lives={lives}
        isGameOver={!!isGameOver}
        onRestart={onTap}
        finalScore={isGameOver ? score : undefined}
        topBarRightPadding={isReady ? 56 : 0}
      />
      <StarPop trigger={perfectTrigger} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
  },
});
