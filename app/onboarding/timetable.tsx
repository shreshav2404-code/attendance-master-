import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Button } from "react-native-paper";

import { ProgressBar } from "@/components/shared/ProgressBar";
import { SubjectBadge } from "@/components/shared/SubjectBadge";
import { triggerSuccessHaptic, triggerTapHaptic } from "@/lib/haptics";
import { useStudent } from "@/hooks/useStudent";
import { useSubjects } from "@/hooks/useSubjects";
import { useTimetable } from "@/hooks/useTimetable";
import type { TimetableSlot, WorkingDay } from "@/types";

export default function TimetableScreen() {
  const { hourSlots, workingDays } = useStudent();
  const { subjects } = useSubjects();
  const { timetable, setTimetable } = useTimetable();
  const [selectedDay, setSelectedDay] = useState<WorkingDay>(workingDays[0] ?? "Mon");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(
    subjects[0]?.id ?? null,
  );
  const [draftTimetable, setDraftTimetable] = useState<TimetableSlot[]>(timetable);

  const findSlot = (day: WorkingDay, hour: number) =>
    draftTimetable.find((slot) => slot.day === day && slot.hour === hour);

  const isCoveredByPreviousDouble = (day: WorkingDay, hour: number) =>
    draftTimetable.some(
      (slot) => slot.day === day && (slot.isDouble || slot.isLab) && slot.hour + 1 === hour,
    );

  const updateSlot = (day: WorkingDay, hour: number) => {
    void triggerTapHaptic();

    if (!selectedSubjectId) {
      setDraftTimetable((currentValue) =>
        currentValue.filter((slot) => !(slot.day === day && slot.hour === hour)),
      );
      return;
    }

    const subject = subjects.find((item) => item.id === selectedSubjectId);

    if (!subject) {
      return;
    }

    if (subject.isLab && hour === hourSlots.length) {
      return;
    }

    setDraftTimetable((currentValue) => {
      const filteredSlots = currentValue.filter(
        (slot) => !(slot.day === day && slot.hour === hour),
      );

      return [
        ...filteredSlots,
        {
          id: `${day}_${hour}`,
          day,
          hour,
          subjectId: subject.id,
          isDouble: false,
          isLab: subject.isLab,
        },
      ].sort((left, right) =>
        left.day === right.day ? left.hour - right.hour : left.day.localeCompare(right.day),
      );
    });
  };

  const toggleDouble = (day: WorkingDay, hour: number) => {
    if (hour === hourSlots.length) {
      return;
    }

    void triggerTapHaptic();
    setDraftTimetable((currentValue) =>
      currentValue.map((slot) =>
        slot.day === day && slot.hour === hour && !slot.isLab
          ? { ...slot, isDouble: !slot.isDouble }
          : slot,
      ),
    );
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text className="font-inter text-sm uppercase tracking-[1.2px] text-white/50">
        Step 4 of 5
      </Text>
      <Text className="mt-3 font-inter-bold text-3xl text-white">
        Build timetable
      </Text>
      <Text className="mt-2 font-inter text-base leading-7 text-white/65">
        Pick a subject, tap a cell to assign it, and long press a theory class
        to turn it into a double period.
      </Text>

      <View className="mt-5">
        <ProgressBar progress={80} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-6"
        contentContainerStyle={{ gap: 8 }}
      >
        {workingDays.map((day) => {
          const active = day === selectedDay;

          return (
            <Pressable
              key={day}
              className="rounded-full border px-4 py-3"
              style={{
                backgroundColor: active
                  ? "rgba(26,95,168,0.18)"
                  : "rgba(255,255,255,0.04)",
                borderColor: active
                  ? "rgba(26,95,168,0.45)"
                  : "rgba(255,255,255,0.08)",
              }}
              onPress={() => {
                void triggerTapHaptic();
                setSelectedDay(day);
              }}
            >
              <Text className="font-inter-semibold text-sm text-white">{day}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text className="mt-6 font-inter-semibold text-sm text-white/70">
        Selected subject
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 12 }}>
        {subjects.map((subject) => {
          const active = selectedSubjectId === subject.id;

          return (
            <Pressable
              key={subject.id}
              className="rounded-[24px] border px-4 py-4"
              style={{
                backgroundColor: active
                  ? `${subject.color}25`
                  : "rgba(255,255,255,0.04)",
                borderColor: active ? `${subject.color}66` : "rgba(255,255,255,0.08)",
              }}
              onPress={() => {
                void triggerTapHaptic();
                setSelectedSubjectId(subject.id);
              }}
            >
              <SubjectBadge code={subject.shortName} color={subject.color} />
              <Text className="mt-2 font-inter text-sm text-white">
                {subject.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View className="mt-4 gap-3">
        {hourSlots.map((hourSlot) => {
          const slot = findSlot(selectedDay, hourSlot.hour);
          const covered = isCoveredByPreviousDouble(selectedDay, hourSlot.hour);
          const subject = subjects.find((item) => item.id === slot?.subjectId);

          return (
            <Pressable
              key={`${selectedDay}_${hourSlot.hour}`}
              disabled={covered}
              onPress={() => updateSlot(selectedDay, hourSlot.hour)}
              onLongPress={() => toggleDouble(selectedDay, hourSlot.hour)}
              className="rounded-[24px] border p-4"
              style={{
                backgroundColor: covered
                  ? "rgba(255,255,255,0.02)"
                  : slot
                    ? `${subject?.color ?? "#1a5fa8"}25`
                    : "rgba(255,255,255,0.04)",
                borderColor: slot
                  ? `${subject?.color ?? "#1a5fa8"}55`
                  : "rgba(255,255,255,0.08)",
                opacity: covered ? 0.55 : 1,
              }}
            >
              <Text className="font-inter-semibold text-sm text-white/60">
                Hour {hourSlot.hour} · {hourSlot.startTime} - {hourSlot.endTime}
              </Text>
              <Text className="mt-2 font-inter-bold text-lg text-white">
                {covered
                  ? "Continues from previous slot"
                  : subject?.name ?? "Free"}
              </Text>
              {slot ? (
                <Text className="mt-1 font-inter text-sm text-white/65">
                  {slot.isLab
                    ? "Lab auto-spans 2 hours"
                    : slot.isDouble
                      ? "Double period enabled"
                      : "Tap to reassign · Long press for double"}
                </Text>
              ) : (
                <Text className="mt-1 font-inter text-sm text-white/45">
                  Tap to assign selected subject
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      <Button
        mode="contained"
        style={{ marginTop: 24 }}
        contentStyle={{ paddingVertical: 8 }}
        onPress={async () => {
          await triggerTapHaptic();
          await setTimetable(draftTimetable);
          await triggerSuccessHaptic();
          router.push("/onboarding/complete");
        }}
      >
        Review setup
      </Button>
    </ScrollView>
  );
}
