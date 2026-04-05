import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { COLORS } from "@/lib/constants";

interface ProgressBarProps {
  progress: number;
  color?: string;
  trackColor?: string;
  height?: number;
}

export const ProgressBar = ({
  progress,
  color = COLORS.secondary,
  trackColor = "rgba(255,255,255,0.08)",
  height = 8,
}: ProgressBarProps) => {
  const [containerWidth, setContainerWidth] = useState(0);
  const width = useSharedValue(0);
  const clampedProgress = Math.max(0, Math.min(progress, 100));

  useEffect(() => {
    width.value = withSpring((clampedProgress / 100) * containerWidth, {
      damping: 18,
      stiffness: 140,
    });
  }, [clampedProgress, containerWidth, width]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: width.value,
  }));

  return (
    <View
      className="overflow-hidden rounded-full"
      style={{ height, backgroundColor: trackColor }}
      onLayout={(event) =>
        setContainerWidth(event.nativeEvent.layout.width)
      }
    >
      <Animated.View
        className="rounded-full"
        style={[animatedStyle, { height, backgroundColor: color }]}
      />
    </View>
  );
};
