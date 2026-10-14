import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { Button } from "react-native-paper";

import { SettingsPage } from "@/components/settings/SettingsPage";
import { TimetableShareCard } from "@/components/settings/TimetableShareCard";
import { TimetableScanSheet } from "@/components/timetable/TimetableScanSheet";
import { useStudent } from "@/hooks/useStudent";
import { useSubjects } from "@/hooks/useSubjects";
import { useTimetable } from "@/hooks/useTimetable";
import { useToast } from "@/hooks/useToast";
import { triggerTapHaptic } from "@/lib/haptics";
import type { TimetableImportPlan } from "@/types";

export default function TimetableSettingsScreen() {
  const { hourSlots, workingDays, setHourSlots } = useStudent();
  const { subjects, setSubjects } = useSubjects();
  const { timetable, setTimetable } = useTimetable();
  const toast = useToast();
  const [scanVisible, setScanVisible] = useState(false);

  const applyTimetableImport = async (plan: TimetableImportPlan) => {
    if (plan.createdSubjects.length > 0) {
      await setSubjects([...subjects, ...plan.createdSubjects]);
    }
    await setHourSlots(plan.hourSlots, plan.workingDays);
    await setTimetable(plan.timetable);
  };

  return (
    <SettingsPage
      page="timetable"
      title="Timetable"
      description={`${subjects.length} subjects · ${timetable.length} weekly slots · ${workingDays.join(", ")}`}
      toast={toast}
    >
      <View className="mt-6 rounded-[28px] border border-[#60a5fa]/40 bg-[#1d4ed8]/10 p-4">
        <Text className="font-inter-bold text-lg text-white">Build automatically</Text>
        <Text className="mt-2 font-inter text-sm leading-6 text-white/65">
          Pick your college's timetable PDF (or take a photo) and AttendX fills in the whole
          week, read on this phone, offline.
        </Text>
        <Button
          mode="contained"
          icon="table-arrow-down"
          style={{ marginTop: 14 }}
          onPress={() => {
            void triggerTapHaptic();
            setScanVisible(true);
          }}
        >
          Scan PDF or photo
        </Button>
      </View>
      <TimetableScanSheet
        visible={scanVisible}
        onClose={() => setScanVisible(false)}
        subjects={subjects}
        timetable={timetable}
        hourSlots={hourSlots}
        workingDays={workingDays}
        onApply={async (plan) => {
          await applyTimetableImport(plan);
          await toast.success(
            plan.createdCount > 0
              ? `Timetable updated · ${plan.createdCount} new subjects added`
              : "Timetable updated",
            2400,
          );
        }}
      />

      <View className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-4">
        <Text className="font-inter-bold text-lg text-white">Edit</Text>
        <Text className="mt-2 font-inter text-sm text-white/60">
          Need to change subjects, hour timings, or the weekly grid?
        </Text>
        <View className="mt-4 flex-row flex-wrap gap-3">
          <Button
            mode="outlined"
            onPress={() => {
              void triggerTapHaptic();
              router.push("/onboarding/subjects?mode=edit");
            }}
          >
            Edit subjects
          </Button>
          <Button
            mode="outlined"
            onPress={() => {
              void triggerTapHaptic();
              router.push("/onboarding/timetable?mode=edit");
            }}
          >
            Edit timetable
          </Button>
        </View>
      </View>

      <View className="mt-2">
        <TimetableShareCard
          subjects={subjects}
          timetable={timetable}
          hourSlots={hourSlots}
          workingDays={workingDays}
          onImport={applyTimetableImport}
          onToast={(message, type = "success") => toast.show(message, type, 2000)}
        />
      </View>
    </SettingsPage>
  );
}
