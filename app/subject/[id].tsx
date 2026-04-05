import { useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PercentageBadge } from "@/components/shared/PercentageBadge";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { SubjectBadge } from "@/components/shared/SubjectBadge";
import { useAttendanceSummary } from "@/hooks/useAttendanceSummary";
import { useDailyLog } from "@/hooks/useDailyLog";
import { useSubjects } from "@/hooks/useSubjects";

export default function SubjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { subjects } = useSubjects();
  const { summaries } = useAttendanceSummary();
  const { dailyLogs } = useDailyLog();

  const subject = subjects.find((item) => item.id === id);
  const summary = summaries.find((item) => item.subjectId === id);
  const subjectLogs = dailyLogs
    .filter((log) => log.subjectId === id)
    .slice()
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 12);

  if (!subject || !summary) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-5">
          <Text className="font-inter-bold text-2xl text-white">
            Subject not found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View className="rounded-[28px] border border-white/10 bg-white/5 p-5">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-4">
              <Text className="font-inter-bold text-3xl text-white">
                {subject.name}
              </Text>
              <Text className="mt-2 font-inter text-base text-white/60">
                {subject.code} · {subject.isLab ? "Lab" : "Theory"}
              </Text>
            </View>
            <SubjectBadge code={subject.shortName} color={subject.color} />
          </View>

          <View className="mt-5 flex-row gap-3">
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

          <View className="mt-5">
            <ProgressBar progress={summary.percentProjected} color={subject.color} />
          </View>
        </View>

        <View className="mt-5 flex-row flex-wrap gap-3">
          {[
            ["TH", summary.TH],
            ["AH", summary.AH],
            ["DL", summary.DL],
            ["Pending", summary.pendingOD],
          ].map(([label, value]) => (
            <View
              key={label}
              className="w-[48%] rounded-[22px] border border-white/10 bg-white/5 p-4"
            >
              <Text className="font-inter text-xs uppercase tracking-[0.8px] text-white/55">
                {label}
              </Text>
              <Text className="mt-2 font-inter-bold text-2xl text-white">
                {value}
              </Text>
            </View>
          ))}
        </View>

        <Text className="mb-3 mt-6 font-inter-bold text-xl text-white">
          Recent logs
        </Text>
        <View className="gap-3">
          {subjectLogs.map((log) => (
            <View
              key={log.id}
              className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3"
            >
              <Text className="font-inter-semibold text-sm text-white">
                {log.date}
              </Text>
              <Text className="mt-1 font-inter text-xs uppercase tracking-[0.8px] text-white/55">
                {log.status} · {log.hours} hour{log.hours > 1 ? "s" : ""}
              </Text>
              {log.note ? (
                <Text className="mt-1 font-inter text-sm text-white/70">
                  {log.note}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
