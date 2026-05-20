import AsyncStorage from '@react-native-async-storage/async-storage';

export async function loadNumber(key: string, fallback: number): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export async function saveNumber(key: string, value: number): Promise<void> {
  try {
    await AsyncStorage.setItem(key, String(value));
  } catch {
    // Silently swallow — never crash the game
  }
}
