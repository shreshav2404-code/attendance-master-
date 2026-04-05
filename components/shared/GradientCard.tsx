import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View, type ViewStyle } from "react-native";

import { COLORS } from "@/lib/constants";

interface GradientCardProps {
  children: React.ReactNode;
  colors?: readonly [string, string, ...string[]];
  className?: string;
  contentClassName?: string;
  style?: ViewStyle;
  blurIntensity?: number;
}

export const GradientCard = ({
  children,
  colors = [COLORS.primary, COLORS.secondary, COLORS.projected],
  className,
  contentClassName,
  style,
  blurIntensity = 24,
}: GradientCardProps) => (
  <View
    className={`overflow-hidden rounded-[28px] border border-white/10 ${className ?? ""}`}
    style={style}
  >
    <LinearGradient colors={colors} style={StyleSheet.absoluteFillObject} />
    <BlurView
      intensity={blurIntensity}
      tint="dark"
      style={StyleSheet.absoluteFillObject}
    />
    <View className={`p-5 ${contentClassName ?? ""}`}>{children}</View>
  </View>
);
