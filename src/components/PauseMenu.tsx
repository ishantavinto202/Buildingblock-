import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface PauseMenuProps {
  visible: boolean;
  onResume: () => void;
  onRestart: () => void;
  onHome?: () => void;
}

const MENU_ENTER_MS = 220;
const MENU_EXIT_MS = 160;

function triggerLightHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function PauseMenu({ visible, onResume, onRestart, onHome }: PauseMenuProps) {
  const backdropOpacity = useSharedValue(0);
  const menuScale = useSharedValue(0.88);
  const menuOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, {
        duration: MENU_ENTER_MS,
        easing: Easing.out(Easing.cubic),
      });
      menuOpacity.value = withTiming(1, { duration: MENU_ENTER_MS });
      menuScale.value = withTiming(1, {
        duration: MENU_ENTER_MS,
        easing: Easing.out(Easing.back(1.4)),
      });
    } else {
      backdropOpacity.value = withTiming(0, { duration: MENU_EXIT_MS });
      menuOpacity.value = withTiming(0, { duration: MENU_EXIT_MS });
      menuScale.value = withTiming(0.92, { duration: MENU_EXIT_MS });
    }
  }, [visible, backdropOpacity, menuOpacity, menuScale]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: menuOpacity.value,
    transform: [{ scale: menuScale.value }],
  }));

  return (
    <View style={styles.container} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[styles.backdrop, backdropStyle]} />

      <Animated.View style={[styles.cardWrap, cardStyle]}>
        <View style={styles.card}>
          <Text style={styles.title}>PAUSED</Text>
          <Text style={styles.subtitle}>Take a breath — your tower is safe</Text>

          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={() => {
              triggerLightHaptic();
              onResume();
            }}
          >
            <Text style={styles.primaryButtonText}>RESUME</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
            onPress={() => {
              triggerLightHaptic();
              onRestart();
            }}
          >
            <Text style={styles.secondaryButtonText}>RESTART</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.ghostButton, pressed && styles.buttonPressed]}
            onPress={() => {
              triggerLightHaptic();
              onHome?.();
            }}
            disabled={!onHome}
          >
            <Text style={[styles.ghostButtonText, !onHome && styles.ghostDisabled]}>
              HOME
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 8, 18, 0.72)',
  },
  cardWrap: {
    width: '100%',
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#FFD700',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a2e',
    letterSpacing: 2,
  },
  secondaryButton: {
    width: '100%',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  ghostButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  ghostButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1.5,
  },
  ghostDisabled: {
    opacity: 0.4,
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
});
