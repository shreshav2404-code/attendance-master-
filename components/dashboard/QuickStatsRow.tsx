import { Clock3, NotebookTabs, ShieldCheck, Sparkles } from "lucide-react-native";
import { Text, View } from "react-native";

import { AnimatedNumber } from "@/components/shared/AnimatedNumber";
import { COLORS } from "@/lib/constants";
import type { OverallAttendanceMetrics } from "@/types";

interface QuickStatsRowProps {
  overall: OverallAttendanceMetrics;
}

const statConfig = [
  { key: "TH", label: "Total Hours", color: COLORS.primary, icon: Clock3 },
  { key: "AH", label: "Present", color: "#ea580c", icon: Sparkles },
  { key: "DL", label: "OD Official", color: COLORS.success, icon: ShieldCheck },
  { key: "pendingOD", label: "OD Pending", color: COLORS.projected, icon: NotebookTabs },
] as const;

export const QuickStatsRow = ({ overall }: QuickStatsRowProps) => (
  <View className="mb-5 flex-row flex-wrap justify-between gap-3">
    {statConfig.map((stat) => {
      const Icon = stat.icon;
      const value = overall[stat.key];

      return (
        <View
          key={stat.key}
          className="w-[48%] rounded-[24px] border border-white/10 p-4"
          style={{ backgroundColor: `${stat.color}25` }}
        >
          <View className="flex-row items-center justify-between">
            <Text className="font-inter text-xs uppercase tracking-[0.8px] text-white/55">
              {stat.label}
            </Text>
            <Icon color={stat.color} size={16} />
          </View>
          <AnimatedNumber
            value={typeof value === "number" ? value : 0}
            className="mt-3 font-inter-bold text-2xl text-white"
          />
        </View>
      );
    })}
  </View>
);
