import { Settings2 } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { AnimatedNumber } from "@/components/shared/AnimatedNumber";
import { GradientCard } from "@/components/shared/GradientCard";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { COLORS } from "@/lib/constants";
import { triggerTapHaptic } from "@/lib/haptics";
import { formatDateLabel } from "@/lib/utils";
import type { OverallAttendanceMetrics, Student } from "@/types";

interface OverallBannerProps {
  student: Student;
  overall: OverallAttendanceMetrics;
  lastSyncedAt?: string;
  onOpenSettings: () => void;
}

const CircularProgress = ({
  progress,
  color,
}: {
  progress: number;
  color: string;
}) => {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const normalizedProgress = Math.max(0, Math.min(progress, 100));
  const strokeDashoffset =
    circumference - (normalizedProgress / 100) * circumference;

  return (
    <View className="items-center justify-center">
      <Svg height={110} width={110}>
        <Circle
          cx="55"
          cy="55"
          fill="transparent"
          r={radius}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="10"
        />
        <Circle
          cx="55"
          cy="55"
          fill="transparent"
          r={radius}
          rotation="-90"
          origin="55,55"
          stroke={color}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          strokeWidth="10"
        />
      </Svg>
      <View className="absolute items-center">
        <AnimatedNumber
          value={progress}
          decimals={2}
          suffix="%"
          className="font-inter-bold text-xl text-white"
        />
        <Text className="font-inter text-xs text-white/65">Projected</Text>
      </View>
    </View>
  );
};

export const OverallBanner = ({
  student,
  overall,
  lastSyncedAt,
  onOpenSettings,
}: OverallBannerProps) => {
  const accentColor =
    overall.percentProjected >= 75
      ? COLORS.success
      : overall.percentProjected >= 70
        ? COLORS.warning
        : COLORS.danger;

  return (
    <GradientCard className="mb-5" contentClassName="gap-5">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-4">
          <Text className="font-inter-bold text-2xl text-white">
            {student.name}
          </Text>
          <Text className="mt-1 font-inter text-sm text-white/70">
            {student.rollNo} · {student.term}
          </Text>
          <Text className="mt-2 font-inter text-xs uppercase tracking-[1.2px] text-white/50">
            {student.collegeName}
          </Text>
          <Text className="mt-1 font-inter text-xs text-white/40">
            Last synced:{" "}
            {lastSyncedAt ? formatDateLabel(lastSyncedAt) : "Not synced yet"}
          </Text>
        </View>

        <Pressable
          className="rounded-full border border-white/10 bg-white/10 p-3"
          onPress={() => {
            void triggerTapHaptic();
            onOpenSettings();
          }}
        >
          <Settings2 color="#f8fafc" size={18} />
        </Pressable>
      </View>

      <View className="flex-row items-center gap-5">
        <View className="flex-1 gap-4">
          <View className="rounded-[24px] border border-white/10 bg-black/10 p-4">
            <Text className="font-inter text-[11px] uppercase tracking-[1px] text-white/55">
              Physical → Official OD → Projected
            </Text>
            <View className="mt-3 flex-row items-end gap-2">
              <AnimatedNumber
                value={overall.percentBefore}
                decimals={2}
                suffix="%"
                className="font-inter-bold text-xl text-white"
              />
              <Text className="pb-1 font-inter-medium text-sm text-white/55">→</Text>
              <AnimatedNumber
                value={overall.percentAfterDL}
                decimals={2}
                suffix="%"
                className="font-inter-bold text-xl text-white"
              />
              <Text className="pb-1 font-inter-medium text-sm text-white/55">→</Text>
              <AnimatedNumber
                value={overall.percentProjected}
                decimals={2}
                suffix="%"
                className="font-inter-bold text-xl text-white"
              />
            </View>
          </View>

          <View>
            <ProgressBar progress={overall.percentProjected} color={accentColor} />
            <View className="mt-2 flex-row justify-between">
              <Text className="font-inter text-xs text-white/55">Physical</Text>
              <Text className="font-inter text-xs text-white/55">+Official OD</Text>
              <Text className="font-inter text-xs text-white/55">+Projected</Text>
            </View>
          </View>
        </View>

        <CircularProgress progress={overall.percentProjected} color={accentColor} />
      </View>
    </GradientCard>
  );
};
