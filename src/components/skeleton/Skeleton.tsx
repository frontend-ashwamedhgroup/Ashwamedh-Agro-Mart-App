import { useEffect } from "react";
import type { DimensionValue, StyleProp, ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "../../theme";

type SkeletonProps = {
  width?: DimensionValue;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

const PULSE_MS = 800;

/**
 * A placeholder block that gently pulses while content loads. Hidden from
 * screen readers; mark the surrounding container with
 * `accessibilityState={{ busy: true }}` instead.
 */
export function Skeleton({
  width = "100%",
  height,
  radius = 8,
  style,
}: SkeletonProps) {
  const { theme } = useTheme();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 0.7;
      return;
    }

    opacity.value = withRepeat(withTiming(0.45, { duration: PULSE_MS }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: theme.colors.border,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}
