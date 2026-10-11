import { useEffect, useState } from "react";
import { runOnJS, useAnimatedReaction, useSharedValue, withTiming } from "react-native-reanimated";
import { MotiText } from "moti";

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  // Keep the number on one line, shrinking the font if needed (native only).
  fitOneLine?: boolean;
}

export const AnimatedNumber = ({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
  fitOneLine = false,
}: AnimatedNumberProps) => {
  const animatedValue = useSharedValue(value);
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    animatedValue.value = withTiming(value, { duration: 700 });
  }, [animatedValue, value]);

  useAnimatedReaction(
    () => animatedValue.value,
    (currentValue) => {
      runOnJS(setDisplayValue)(Number(currentValue.toFixed(decimals)));
    },
    [decimals],
  );

  return (
    <MotiText
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 350 }}
      className={className}
      numberOfLines={fitOneLine ? 1 : undefined}
      adjustsFontSizeToFit={fitOneLine}
    >
      {prefix}
      {displayValue.toFixed(decimals)}
      {suffix}
    </MotiText>
  );
};
