import { useState } from "react";
import { router } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { FAB } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { CreateODSheet } from "@/components/od/CreateODSheet";
import { ODEventCard } from "@/components/od/ODEventCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Toast } from "@/components/shared/Toast";
import { triggerSuccessHaptic, triggerTapHaptic, triggerWarningHaptic } from "@/lib/haptics";
import { useDailyLog } from "@/hooks/useDailyLog";
import { useODEvents } from "@/hooks/useODEvents";
import { useStudent } from "@/hooks/useStudent";
import { useSubjects } from "@/hooks/useSubjects";
import { useTimetable } from "@/hooks/useTimetable";

export default function ODTabScreen() {
  const { subjects } = useSubjects();
  const { timetable } = useTimetable();
  const { workingDays, workingDateOverrides } = useStudent();
  const {
    odEvents,
    addODEvent,
    removeODEvent,
    setEventSubjectRegistration,
  } = useODEvents();
  const { addLogs, removeLogsByODEvent } = useDailyLog();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const totalTracked = odEvents.reduce(
    (sum, event) =>
      sum + event.subjects.reduce((eventSum, subject) => eventSum + subject.hours, 0),
    0,
  );
  const totalRegistered = odEvents.reduce(
    (sum, event) =>
      sum +
      event.subjects
        .filter((subject) => subject.registered)
        .reduce((eventSum, subject) => eventSum + subject.hours, 0),
    0,
  );
  const totalPending = totalTracked - totalRegistered;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Toast
        visible={Boolean(toastMessage)}
        message={toastMessage}
        type={toastMessage.includes("deleted") ? "warning" : "success"}
      />
      <CreateODSheet
        visible={sheetVisible}
        subjects={subjects}
        timetable={timetable}
        workingDays={workingDays}
        workingDateOverrides={workingDateOverrides}
        onClose={() => setSheetVisible(false)}
        onCreate={async (odEvent, logs) => {
          await triggerTapHaptic();
          await addODEvent(odEvent);
          await addLogs(logs);
          setToastMessage("OD event created");
          await triggerSuccessHaptic();
          setTimeout(() => setToastMessage(""), 1800);
        }}
      />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <Text className="font-inter-bold text-3xl text-white">OD Manager</Text>
        <Text className="mt-2 font-inter text-base leading-7 text-white/65">
          Track every official and pending OD entry from hackathons to sports day.
        </Text>

        <View className="mt-6 flex-row flex-wrap gap-3">
          {[
            ["Tracked", totalTracked],
            ["Registered", totalRegistered],
            ["Pending", totalPending],
          ].map(([label, value]) => (
            <View
              key={label}
              className="w-[31%] rounded-[22px] border border-white/10 bg-white/5 p-4"
            >
              <Text className="font-inter text-xs uppercase tracking-[0.8px] text-white/55">
                {label}
              </Text>
              <Text className="mt-2 font-inter-bold text-2xl text-white">
                {value}h
              </Text>
            </View>
          ))}
        </View>

        <Text className="mb-3 mt-6 font-inter-bold text-xl text-white">
          Active OD events
        </Text>
        {odEvents.length === 0 ? (
          <EmptyState
            title="No OD events yet"
            description="Create one with the + button. Auto-fill can pull subject hours directly from your timetable."
          />
        ) : (
          <View>
            {odEvents.map((event) => (
              <ODEventCard
                key={event.id}
                event={event}
                subjects={subjects}
                onPress={() => router.push(`/od/${event.id}`)}
                onDelete={async () => {
                  await triggerWarningHaptic();
                  await removeODEvent(event.id);
                  await removeLogsByODEvent(event.id);
                  setToastMessage("OD event deleted");
                  setTimeout(() => setToastMessage(""), 1800);
                }}
                onToggleRegistration={(subjectId, registered) => {
                  void triggerTapHaptic();
                  void setEventSubjectRegistration(event.id, subjectId, registered);
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <FAB
        icon="plus"
        label="New OD"
        onPress={() => {
          void triggerTapHaptic();
          setSheetVisible(true);
        }}
        style={{ position: "absolute", right: 20, bottom: 28 }}
      />
    </SafeAreaView>
  );
}
