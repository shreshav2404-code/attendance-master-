import { router, useLocalSearchParams } from "expo-router";
import { Sparkles } from "lucide-react-native";
import { View, Text } from "react-native";
import { Button } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { GradientCard } from "@/components/shared/GradientCard";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { triggerSuccessHaptic, triggerTapHaptic } from "@/lib/haptics";
import { useStudent } from "@/hooks/useStudent";
import { useSubjects } from "@/hooks/useSubjects";
import { useTimetable } from "@/hooks/useTimetable";

export default function CompleteScreen() {
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const { student, setOnboarded } = useStudent();
  const { subjects } = useSubjects();
  const { timetable } = useTimetable();
  const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const isEditMode = mode === "edit";

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-between px-5 py-6">
        <View>
          <Text className="font-inter text-sm uppercase tracking-[1.2px] text-white/50">
            Step 5 of 5
          </Text>
          <Text className="mt-3 font-inter-bold text-3xl text-white">
            All set
          </Text>
          <Text className="mt-2 font-inter text-base leading-7 text-white/65">
            Your profile, subjects, and weekly schedule are ready.
          </Text>

          <View className="mt-5">
            <ProgressBar progress={100} />
          </View>

          <GradientCard className="mt-8" contentClassName="gap-4">
            <View className="items-center">
              <View className="rounded-full bg-white/10 p-4">
                <Sparkles color="#f8fafc" size={28} />
              </View>
            </View>
            <Text className="text-center font-inter-bold text-2xl text-white">
              Welcome, {student?.name ?? "Student"}
            </Text>
            <Text className="text-center font-inter text-base leading-7 text-white/70">
              {subjects.length} subjects mapped across {timetable.length} timetable
              slots. You can start marking attendance right away.
            </Text>
          </GradientCard>
        </View>

        <Button
          mode="contained"
          contentStyle={{ paddingVertical: 8 }}
          onPress={async () => {
            await triggerTapHaptic();
            if (!isEditMode) {
              await setOnboarded(true);
            }
            await triggerSuccessHaptic();
            if (isEditMode) {
              // Edits start from Settings > Timetable; pop back to that page.
              router.dismissTo("/settings/timetable");
              return;
            }
            router.replace("/(tabs)");
          }}
        >
          {isEditMode ? "Back to Timetable settings" : "Go to Dashboard"}
        </Button>
      </View>
    </SafeAreaView>
  );
}
