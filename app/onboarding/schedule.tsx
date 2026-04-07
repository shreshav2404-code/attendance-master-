import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Button, TextInput } from "react-native-paper";

import { ProgressBar } from "@/components/shared/ProgressBar";
import {
  DEFAULT_HOUR_SLOTS,
  WORKING_DAYS,
} from "@/lib/constants";
import { triggerSuccessHaptic, triggerTapHaptic } from "@/lib/haptics";
import { useStudent } from "@/hooks/useStudent";
import type { HourSlot, WorkingDay } from "@/types";

export default function ScheduleScreen() {
  const { hourSlots, workingDays, setHourSlots } = useStudent();
  const [hoursPerDay, setHoursPerDay] = useState(
    Math.min(Math.max(hourSlots.length, 4), 8),
  );
  const [selectedWorkingDays, setSelectedWorkingDays] = useState<WorkingDay[]>(
    workingDays,
  );
  const [draftSlots, setDraftSlots] = useState<HourSlot[]>(
    Array.from(
      { length: 8 },
      (_, index) => hourSlots[index] ?? DEFAULT_HOUR_SLOTS[index]!,
    ),
  );
  const scrollRef = useRef<ScrollView | null>(null);
  const hourRowOffsetsRef = useRef<Record<number, number>>({});
  const [focusedHourIndex, setFocusedHourIndex] = useState<number | null>(null);

  const scrollToHourRow = ({
    index,
    keyboardOffset = 0,
  }: {
    index: number;
    keyboardOffset?: number;
  }): void => {
    const fallbackOffset = index * 250;
    const rowOffset = hourRowOffsetsRef.current[index] ?? fallbackOffset;
    const targetOffset = Math.max(0, rowOffset - 24 + keyboardOffset);

    scrollRef.current?.scrollTo({
      y: targetOffset,
      animated: true,
    });
  };

  const focusHourRow = (index: number): void => {
    setFocusedHourIndex(index);
    requestAnimationFrame(() => {
      scrollToHourRow({ index });
      setTimeout(() => {
        scrollToHourRow({ index, keyboardOffset: 170 });
      }, 120);
    });
  };

  useEffect(() => {
    const keyboardShowSubscription = Keyboard.addListener(
      "keyboardDidShow",
      () => {
        if (focusedHourIndex === null) {
          return;
        }

        setTimeout(() => {
          scrollToHourRow({ index: focusedHourIndex, keyboardOffset: 180 });
        }, 40);
      },
    );

    return () => {
      keyboardShowSubscription.remove();
    };
  }, [focusedHourIndex]);

  const toggleWorkingDay = (day: WorkingDay) => {
    void triggerTapHaptic();
    setSelectedWorkingDays((currentValue) => {
      if (currentValue.includes(day)) {
        if (currentValue.length === 1) {
          return currentValue;
        }

        return currentValue.filter((item) => item !== day);
      }

      return [...currentValue, day];
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 18}
    >
      <ScrollView
        ref={scrollRef}
        className="flex-1 bg-background"
        contentContainerStyle={{ padding: 20, paddingBottom: 220 }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="always"
      >
        <Text className="font-inter text-sm uppercase tracking-[1.2px] text-white/50">
          Step 2 of 5
        </Text>
        <Text className="mt-3 font-inter-bold text-3xl text-white">
          Define schedule
        </Text>
        <Text className="mt-2 font-inter text-base leading-7 text-white/65">
          Set how many hours you have, which days are active, and the default
          timings for each hour.
        </Text>

        <View className="mt-5">
          <ProgressBar progress={40} />
        </View>

        <View className="mt-6 rounded-[24px] border border-white/10 bg-white/5 p-4">
          <Text className="font-inter-semibold text-base text-white">
            Hours per day
          </Text>
          <View className="mt-4 flex-row items-center justify-between">
            <Pressable
              className="rounded-full border border-white/10 bg-black/20 px-4 py-3"
              onPress={() => {
                void triggerTapHaptic();
                setHoursPerDay((currentValue) => Math.max(4, currentValue - 1));
              }}
            >
              <Text className="font-inter-semibold text-white">-</Text>
            </Pressable>
            <Text className="font-inter-bold text-3xl text-white">{hoursPerDay}</Text>
            <Pressable
              className="rounded-full border border-white/10 bg-black/20 px-4 py-3"
              onPress={() => {
                void triggerTapHaptic();
                setHoursPerDay((currentValue) => Math.min(8, currentValue + 1));
              }}
            >
              <Text className="font-inter-semibold text-white">+</Text>
            </Pressable>
          </View>
        </View>

        <View className="mt-6">
          <Text className="font-inter-semibold text-base text-white">
            Working days
          </Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {WORKING_DAYS.map((day) => {
              const selected = selectedWorkingDays.includes(day);

              return (
                <Pressable
                  key={day}
                  className="rounded-full border px-4 py-3"
                  style={{
                    backgroundColor: selected
                      ? "rgba(26,95,168,0.18)"
                      : "rgba(255,255,255,0.04)",
                    borderColor: selected
                      ? "rgba(26,95,168,0.45)"
                      : "rgba(255,255,255,0.08)",
                  }}
                  onPress={() => toggleWorkingDay(day)}
                >
                  <Text className="font-inter-semibold text-sm text-white">
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="mt-6 gap-4">
          {draftSlots.slice(0, hoursPerDay).map((slot, index) => (
            <View
              key={slot.hour}
              className="rounded-[24px] border border-white/10 bg-white/5 p-4"
              onLayout={(event) => {
                hourRowOffsetsRef.current[index] = event.nativeEvent.layout.y;
              }}
            >
              <Text className="font-inter-semibold text-base text-white">
                Hour {index + 1}
              </Text>
              <View className="mt-3 gap-3">
                <TextInput
                  mode="outlined"
                  label="Start time"
                  value={slot.startTime}
                  onFocus={() => focusHourRow(index)}
                  onChangeText={(startTime) =>
                    setDraftSlots((currentValue) =>
                      currentValue.map((currentSlot) =>
                        currentSlot.hour === slot.hour
                          ? { ...currentSlot, startTime }
                          : currentSlot,
                      ),
                    )
                  }
                  style={{ backgroundColor: "transparent" }}
                />
                <TextInput
                  mode="outlined"
                  label="End time"
                  value={slot.endTime}
                  onFocus={() => focusHourRow(index)}
                  onChangeText={(endTime) =>
                    setDraftSlots((currentValue) =>
                      currentValue.map((currentSlot) =>
                        currentSlot.hour === slot.hour
                          ? { ...currentSlot, endTime }
                          : currentSlot,
                      ),
                    )
                  }
                  style={{ backgroundColor: "transparent" }}
                />
                <View className="flex-row gap-2">
                  {(["isBreak", "isLunch"] as const).map((flag) => {
                    const active = slot[flag];

                    return (
                      <Pressable
                        key={flag}
                        className="rounded-full border px-4 py-3"
                        style={{
                          backgroundColor: active
                            ? "rgba(124,58,237,0.18)"
                            : "rgba(255,255,255,0.04)",
                          borderColor: active
                            ? "rgba(124,58,237,0.45)"
                            : "rgba(255,255,255,0.08)",
                        }}
                        onPress={() => {
                          void triggerTapHaptic();
                          setDraftSlots((currentValue) =>
                            currentValue.map((currentSlot) =>
                              currentSlot.hour === slot.hour
                                ? { ...currentSlot, [flag]: !currentSlot[flag] }
                                : currentSlot,
                            ),
                          );
                        }}
                      >
                        <Text className="font-inter-semibold text-sm text-white">
                          {flag === "isBreak" ? "Break" : "Lunch"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          ))}
        </View>

        <Button
          mode="contained"
          style={{ marginTop: 24 }}
          contentStyle={{ paddingVertical: 8 }}
          onPress={async () => {
            await triggerTapHaptic();
            await setHourSlots(draftSlots.slice(0, hoursPerDay), selectedWorkingDays);
            await triggerSuccessHaptic();
            router.push("/onboarding/subjects");
          }}
        >
          Continue to subjects
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
