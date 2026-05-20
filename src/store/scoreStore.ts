import { create } from 'zustand';
import { loadNumber, saveNumber } from '../utils/storage';

const HIGH_SCORE_KEY = 'stacking_game_high_score';

interface ScoreStore {
  score: number;
  highScore: number;
  hasLoadedHighScore: boolean;
  loadHighScore: () => Promise<void>;
  addPoints: (points: number) => void;
  resetScore: () => void;
}

export const useScoreStore = create<ScoreStore>((set, get) => ({
  score: 0,
  highScore: 0,
  hasLoadedHighScore: false,

  loadHighScore: async () => {
    const hs = await loadNumber(HIGH_SCORE_KEY, 0);
    set({ highScore: hs, hasLoadedHighScore: true });
  },

  addPoints: (points: number) => {
    const { score, highScore } = get();
    const newScore = score + points;
    const newHigh = Math.max(newScore, highScore);
    set({ score: newScore, highScore: newHigh });
    if (newHigh > highScore) {
      saveNumber(HIGH_SCORE_KEY, newHigh);
    }
  },

  resetScore: () => {
    set({ score: 0 });
  },
}));
