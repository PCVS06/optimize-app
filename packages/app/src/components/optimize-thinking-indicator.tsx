import { memo, useEffect } from "react";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { OptimizeLogo } from "@/components/icons/optimize-logo";
import { useRetainedPanelActive } from "@/components/retained-panel";

/** Mounted only while a turn or thought is active; hidden panels stay still. */
export const OptimizeThinkingIndicator = memo(function OptimizeThinkingIndicator({
  size = 22,
}: {
  size?: number;
  color?: string;
}) {
  const panelActive = useRetainedPanelActive();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (panelActive && !reduceMotion) {
      progress.value = withRepeat(withTiming(1, { duration: 4800, easing: Easing.linear }), -1);
    } else {
      cancelAnimation(progress);
      progress.value = 0;
    }
    return () => cancelAnimation(progress);
  }, [panelActive, reduceMotion, progress]);

  const animationStyle = useAnimatedStyle(() => {
    const breath = (1 - Math.cos(progress.value * Math.PI * 4)) / 2;
    return {
      opacity: 1 - breath * 0.24,
      transform: [{ rotate: `${progress.value * 360}deg` }, { scale: 1 - breath * 0.06 }],
    };
  });
  const diameter = Math.max(size, 18);
  return (
    <Animated.View style={animationStyle} accessible={false} testID="optimize-thinking-indicator">
      <OptimizeLogo size={diameter} color="#F72626" />
    </Animated.View>
  );
});
