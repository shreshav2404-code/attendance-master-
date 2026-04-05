import { router } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ODStatusScroll } from "@/components/dashboard/ODStatusScroll";
import { OverallBanner } from "@/components/dashboard/OverallBanner";
import { QuickStatsRow } from "@/components/dashboard/QuickStatsRow";
import { SkipCalculator } from "@/components/dashboard/SkipCalculator";
import { SubjectCard } from "@/components/dashboard/SubjectCard";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { EmptyState } from "@/components/shared/EmptyState";
import { useAttendanceSummary } from "@/hooks/useAttendanceSummary";
import { useODEvents } from "@/hooks/useODEvents";
import { useSkipSimulation } from "@/hooks/useSkipSimulation";
import { useStudent } from "@/hooks/useStudent";
import { useSubjects } from "@/hooks/useSubjects";

export default function DashboardScreen() {
  const { student, lastSyncedAt } = useStudent();
  const { subjects } = useSubjects();
  const { odEvents } = useODEvents();
  const { summaries, overall, trend } = useAttendanceSummary();
  const simulations = useSkipSimulation();

  if (!student) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 justify-center px-5">
          <EmptyState
            title="Profile not ready"
            description="Complete onboarding once to unlock your dashboard."
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <OverallBanner
          student={student}
          overall={overall}
          lastSyncedAt={lastSyncedAt}
          onOpenSettings={() => router.push("/(tabs)/settings")}
        />

        <QuickStatsRow overall={overall} />

        <Text className="mb-3 font-inter-bold text-xl text-white">
          OD status
        </Text>
        <ODStatusScroll
          odEvents={odEvents}
          onSelect={(id) => router.push(`/od/${id}`)}
        />

        <Text className="mb-3 mt-5 font-inter-bold text-xl text-white">
          Subjects
        </Text>
        {subjects.length === 0 ? (
          <EmptyState
            title="No subjects yet"
            description="Add subjects in onboarding or from settings to start tracking attendance."
          />
        ) : (
          <View>
            {subjects.map((subject) => {
              const summary = summaries.find((item) => item.subjectId === subject.id);

              if (!summary) {
                return null;
              }

              return (
                <SubjectCard
                  key={subject.id}
                  subject={subject}
                  summary={summary}
                  onPress={() => router.push(`/subject/${subject.id}`)}
                />
              );
            })}
          </View>
        )}

        <Text className="mb-3 mt-3 font-inter-bold text-xl text-white">
          Weekly trend
        </Text>
        <TrendChart data={trend} />

        <SkipCalculator simulations={simulations} overall={overall} />
      </ScrollView>
    </SafeAreaView>
  );
}
