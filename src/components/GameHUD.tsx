import React from 'react';
import { Image, View, Text, StyleSheet, Pressable } from 'react-native';
import { STARTING_LIVES } from '../game/constants';
import { useScoreStore } from '../store/scoreStore';

const LIFE_STAR_SOURCE = require('../../assets/images/Blue Start.png');
const LIFE_STAR_SIZE = 24;

interface GameHUDProps {
  lives: number;
  isGameOver: boolean;
  onRestart: () => void;
  finalScore?: number;
  /** Extra right inset so the pause button does not cover the best score */
  topBarRightPadding?: number;
}

function LivesIndicator({ lives }: { lives: number }) {
  return (
    <View style={styles.livesRow} accessibilityLabel={`${lives} lives remaining`}>
      {Array.from({ length: STARTING_LIVES }, (_, i) => (
        <Image
          key={i}
          source={LIFE_STAR_SOURCE}
          style={[styles.lifeStar, i >= lives && styles.lifeStarEmpty]}
          resizeMode="contain"
        />
      ))}
    </View>
  );
}

export function GameHUD({
  lives,
  isGameOver,
  onRestart,
  finalScore,
  topBarRightPadding = 0,
}: GameHUDProps) {
  const { score, highScore, hasLoadedHighScore } = useScoreStore();

  return (
    <>
      {/* Live score bar */}
      <View
        style={[styles.topBar, { paddingRight: 24 + topBarRightPadding }]}
        pointerEvents="none"
      >
        <Text style={styles.score}>{score}</Text>
        <LivesIndicator lives={lives} />
        <Text style={styles.highScore}>
          {hasLoadedHighScore && highScore > 0 ? `BEST  ${highScore}` : 'BEST  --'}
        </Text>
      </View>

      {/* Game over overlay */}
      {isGameOver && (
        <View style={styles.overlay}>
          <Text style={styles.gameOverTitle}>GAME OVER</Text>
          <Text style={styles.finalScore}>{finalScore ?? score}</Text>
          {hasLoadedHighScore && highScore > 0 && (
            <Text style={styles.bestScore}>
              {finalScore === highScore ? '🏆 NEW BEST!' : `BEST  ${highScore}`}
            </Text>
          )}
          <Pressable style={styles.restartButton} onPress={onRestart}>
            <Text style={styles.restartButtonText}>PLAY AGAIN</Text>
          </Pressable>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  livesRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  lifeStar: {
    width: LIFE_STAR_SIZE,
    height: LIFE_STAR_SIZE,
  },
  lifeStarEmpty: {
    opacity: 0.22,
  },
  score: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  highScore: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
    alignSelf: 'center',
    letterSpacing: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,20,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  gameOverTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 4,
    marginBottom: 12,
  },
  finalScore: {
    fontSize: 72,
    fontWeight: '800',
    color: '#FFD700',
    lineHeight: 80,
  },
  bestScore: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
    letterSpacing: 1,
  },
  restartButton: {
    marginTop: 40,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 8,
  },
  restartButtonText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 3,
  },
});
