import { Text, View } from "react-native";

import { COLORS } from "@/lib/constants";
import type { AttendanceSummary } from "@/types";

interface PercentageBadgeProps {
  label: string;
  value: number;
  status?: AttendanceSummary["status"];
}

const badgeColorMap: Record<AttendanceSummary["status"], string> = {
  danger: COLORS.danger,
  warning: COLORS.warning,
  exact: COLORS.exact,
  safe: COLORS.success,
  excellent: "#16a34a",
};

export const PercentageBadge = ({
  label,
  value,
  status = "exact",
}: PercentageBadgeProps) => (
  <View
    className="rounded-full px-3 py-2"
    style={{ backgroundColor: `${badgeColorMap[status]}25` }}
  >
    <Text
      className="font-inter-semibold text-[11px] uppercase tracking-[0.6px]"
      style={{ color: badgeColorMap[status] }}
    >
      {label}
    </Text>
    <Text className="mt-1 font-inter-bold text-sm text-white">
      {value.toFixed(2)}%
    </Text>
  </View>
);
