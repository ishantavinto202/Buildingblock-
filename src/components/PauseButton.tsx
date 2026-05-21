import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface PauseButtonProps {
  onPress: () => void;
  topInset: number;
  rightInset: number;
  disabled?: boolean;
}

export function PauseButton({ onPress, topInset, rightInset, disabled }: PauseButtonProps) {
  const handlePress = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.hitArea,
        { top: topInset + 10, right: rightInset + 14 },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Pause game"
    >
      <View style={styles.button}>
        <Ionicons name="pause" size={22} color="#E8E8F0" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hitArea: {
    position: 'absolute',
    zIndex: 30,
    padding: 6,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
  disabled: {
    opacity: 0.35,
  },
});
