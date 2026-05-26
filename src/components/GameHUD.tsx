import React from 'react';
import { Image, View, Text, StyleSheet, Pressable } from 'react-native';
import { SharedValue } from 'react-native-reanimated';
import { STARTING_LIVES } from '../game/constants';
import { useScoreStore } from '../store/scoreStore';
import { GameplayTimer } from './GameplayTimer';

const LIFE_STAR_SOURCE = require('../../assets/images/Blue Start.png');
const LIFE_STAR_SIZE = 24;
const TOP_BAR_HORIZONTAL_PAD = 24;
const TOP_BAR_TOP_GAP = 12;

interface GameHUDProps {
  lives: number;
  isGameOver: boolean;
  onRestart: () => void;
  finalScore?: number;
  topInset?: number;
  leftInset?: number;
  rightInset?: number;
  blockTimerRemainingMs?: SharedValue<number>;
  showBlockTimer?: boolean;
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
  topInset = 0,
  leftInset = 0,
  rightInset = 0,
  blockTimerRemainingMs,
  showBlockTimer = false,
}: GameHUDProps) {
  const { score, highScore, hasLoadedHighScore } = useScoreStore();

  return (
    <>
      <View
        style={[
          styles.topBar,
          {
            paddingTop: topInset + TOP_BAR_TOP_GAP,
            paddingLeft: leftInset + TOP_BAR_HORIZONTAL_PAD,
            paddingRight: rightInset + TOP_BAR_HORIZONTAL_PAD,
          },
        ]}
        pointerEvents="none"
      >
        <View style={styles.scoreRow}>
          <Text style={styles.score}>{score}</Text>
          {blockTimerRemainingMs && (
            <GameplayTimer remainingMs={blockTimerRemainingMs} visible={showBlockTimer} />
          )}
        </View>
        <View style={styles.metaRow}>
          <LivesIndicator lives={lives} />
          <Text style={styles.highScore} numberOfLines={1}>
            {hasLoadedHighScore && highScore > 0 ? `BEST  ${highScore}` : 'BEST  --'}
          </Text>
        </View>
      </View>

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
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    width: '100%',
  },
  score: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
    flexShrink: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    width: '100%',
    minHeight: LIFE_STAR_SIZE,
  },
  livesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  lifeStar: {
    width: LIFE_STAR_SIZE,
    height: LIFE_STAR_SIZE,
  },
  lifeStarEmpty: {
    opacity: 0.22,
  },
  highScore: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1,
    marginLeft: 16,
    flexShrink: 1,
    textAlign: 'right',
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
