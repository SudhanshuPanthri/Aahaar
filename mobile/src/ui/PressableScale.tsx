/**
 * Pressable with subtle production-feel press feedback: scales to ~0.97 and
 * dims to ~0.9 opacity while pressed (fast timing, standard easing — no bounce).
 * Drop-in replacement for Pressable wherever a button should feel tactile.
 * Note: `style` must be a plain style (no function form), so the base opacity
 * of disabled buttons (e.g. `btnDisabled`) can be respected by the animation.
 */
import { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PRESS_IN = { duration: 110, easing: Easing.out(Easing.quad) };
const PRESS_OUT = { duration: 180, easing: Easing.out(Easing.quad) };

type Props = Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> };

export default function PressableScale({ style, onPressIn, onPressOut, ...rest }: Props) {
  const pressed = useSharedValue(0);

  // Bake the style's own opacity (e.g. 0.5 when disabled) into the animation
  // so the animated opacity never clobbers it.
  const baseOpacity = useMemo(() => {
    const o = StyleSheet.flatten(style)?.opacity;
    return typeof o === 'number' ? o : 1;
  }, [style]);

  const feedback = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.03 }],
    opacity: baseOpacity * (1 - pressed.value * 0.1),
  }));

  return (
    <AnimatedPressable
      {...rest}
      style={[style, feedback]}
      onPressIn={(e: GestureResponderEvent) => {
        pressed.value = withTiming(1, PRESS_IN);
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        pressed.value = withTiming(0, PRESS_OUT);
        onPressOut?.(e);
      }}
    />
  );
}
