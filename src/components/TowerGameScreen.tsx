import React, { useEffect } from 'react';
import { StyleSheet, View, TouchableWithoutFeedback } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTowerGame } from '../hooks/useTowerGame';
import { GameCanvas } from './GameCanvas';
import { GameHUD } from './GameHUD';
import { StarPop } from './StarPop';
import { useScoreStore } from '../store/scoreStore';

export function TowerGameScreen() {
  const insets = useSafeAreaInsets();
  const loadHighScore = useScoreStore((s) => s.loadHighScore);
  const score = useScoreStore((s) => s.score);

  const {
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
    canvasWidth,
    canvasHeight,
    onLayout,
  } = useTowerGame();

  useEffect(() => {
    loadHighScore();
  }, [loadHighScore]);

  const isGameOver = gameState.phase === 'game_over';

  return (
    <TouchableWithoutFeedback onPress={onTap}>
      <View
        style={styles.container}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          onLayout(width, height - insets.top);
        }}
      >
        <GameCanvas
          width={canvasWidth}
          height={canvasHeight}
          gameState={gameState}
          swayOffset={swayOffset}
          fallY={fallY}
          towerSwayOffset={towerSwayOffset}
          particleTs={particleTs}
          particleActives={particleActives}
          particlePool={particlePool}
          scoreTextY={scoreTextY}
          scoreTextOpacity={scoreTextOpacity}
        />
        <GameHUD
          isGameOver={isGameOver}
          onRestart={onTap}
          finalScore={isGameOver ? score : undefined}
        />
        <StarPop trigger={perfectTrigger} />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
});
