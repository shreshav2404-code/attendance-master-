import { MotiView } from "moti";
import { Pressable, Text, View } from "react-native";

import { PercentageBadge } from "@/components/shared/PercentageBadge";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { SubjectBadge } from "@/components/shared/SubjectBadge";
import { COLORS } from "@/lib/constants";
import { triggerTapHaptic } from "@/lib/haptics";
import type { AttendanceSummary, Subject } from "@/types";

interface SubjectCardProps {
  subject: Subject;
  summary: AttendanceSummary;
  onPress: () => void;
}

export const SubjectCard = ({
  subject,
  summary,
  onPress,
}: SubjectCardProps) => (
  <Pressable
    onPress={() => {
      void triggerTapHaptic();
      onPress();
    }}
  >
    <MotiView
      from={{ opacity: 0, translateY: 16 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "spring", damping: 16 }}
      className="mb-4 rounded-[28px] border border-white/10 bg-white/5 p-4"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-4">
          <Text className="font-inter-bold text-lg text-white">{subject.name}</Text>
          <Text className="mt-1 font-inter text-sm text-white/60">
            {subject.code} · {subject.isLab ? "Lab / 2h" : "Theory"}
          </Text>
        </View>
        <SubjectBadge code={subject.shortName} color={subject.color} />
      </View>

      <View className="mt-4 flex-row gap-3">
        <View className="flex-1 rounded-2xl bg-black/15 p-3">
          <Text className="font-inter text-xs text-white/50">TH</Text>
          <Text className="mt-1 font-inter-bold text-xl text-white">{summary.TH}</Text>
        </View>
        <View className="flex-1 rounded-2xl bg-black/15 p-3">
          <Text className="font-inter text-xs text-white/50">AH</Text>
          <Text className="mt-1 font-inter-bold text-xl text-white">{summary.AH}</Text>
        </View>
        <View className="flex-1 rounded-2xl bg-black/15 p-3">
          <Text className="font-inter text-xs text-white/50">DL</Text>
          <Text className="mt-1 font-inter-bold text-xl text-white">{summary.DL}</Text>
        </View>
        <View className="flex-1 rounded-2xl bg-black/15 p-3">
          <Text className="font-inter text-xs text-white/50">Pending</Text>
          <Text className="mt-1 font-inter-bold text-xl text-white">
            {summary.pendingOD}
          </Text>
        </View>
      </View>

      <View className="mt-4 flex-row gap-2">
        <PercentageBadge
          label="Before"
          value={summary.percentBefore}
          status={summary.status}
        />
        <PercentageBadge
          label="+DL"
          value={summary.percentAfterDL}
          status={summary.status}
        />
        <PercentageBadge
          label="Projected"
          value={summary.percentProjected}
          status={summary.status}
        />
      </View>

      <View className="mt-4">
        <ProgressBar
          progress={summary.percentProjected}
          color={
            summary.status === "danger"
              ? COLORS.danger
              : summary.status === "warning"
                ? COLORS.warning
                : summary.status === "exact"
                  ? COLORS.exact
                  : summary.status === "safe"
                    ? COLORS.success
                    : "#16a34a"
          }
        />
      </View>

      <View className="mt-4 flex-row items-center justify-between">
        <Text className="font-inter text-sm text-white/70">
          {summary.isSafe
            ? "Safe badge unlocked"
            : summary.hoursNeeded > 0
              ? `Need ${summary.hoursNeeded} more classes`
              : "On track"}
        </Text>
        <View
          className="rounded-full px-3 py-2"
          style={{
            backgroundColor:
              summary.status === "danger"
                ? `${COLORS.danger}25`
                : summary.status === "warning"
                  ? `${COLORS.warning}25`
                  : `${COLORS.success}25`,
          }}
        >
          <Text className="font-inter-semibold text-xs uppercase text-white">
            {summary.status}
          </Text>
        </View>
      </View>
    </MotiView>
  </Pressable>
);
