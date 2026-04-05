import { Pressable, ScrollView, Text, View } from "react-native";

import { EmptyState } from "@/components/shared/EmptyState";
import { triggerTapHaptic } from "@/lib/haptics";
import type { ODEvent } from "@/types";

interface ODStatusScrollProps {
  odEvents: ODEvent[];
  onSelect: (odEventId: string) => void;
}

export const ODStatusScroll = ({
  odEvents,
  onSelect,
}: ODStatusScrollProps) => {
  if (odEvents.length === 0) {
    return (
      <EmptyState
        title="No OD events yet"
        description="Create your first OD event to track pending and officially registered hours separately."
      />
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mb-5"
      contentContainerStyle={{ gap: 12, paddingRight: 6 }}
    >
      {odEvents.map((event) => {
        const registeredHours = event.subjects
          .filter((subject) => subject.registered)
          .reduce((sum, subject) => sum + subject.hours, 0);
        const pendingHours = event.subjects
          .filter((subject) => !subject.registered)
          .reduce((sum, subject) => sum + subject.hours, 0);

        return (
          <Pressable
            key={event.id}
            onPress={() => {
              void triggerTapHaptic();
              onSelect(event.id);
            }}
            className="w-72 rounded-[26px] border bg-white/5 p-4"
            style={{
              borderColor:
                pendingHours === 0 ? "rgba(16,185,129,0.7)" : "rgba(245,158,11,0.7)",
            }}
          >
            <Text className="font-inter-bold text-base text-white">{event.name}</Text>
            <Text className="mt-1 font-inter text-sm text-white/55">
              {event.date}
              {event.endDate ? ` → ${event.endDate}` : ""}
            </Text>
            <View className="mt-4 flex-row gap-3">
              <View className="rounded-2xl bg-emerald-500/10 px-3 py-2">
                <Text className="font-inter-semibold text-xs text-emerald-400">
                  Registered
                </Text>
                <Text className="mt-1 font-inter-bold text-lg text-white">
                  {registeredHours}h
                </Text>
              </View>
              <View className="rounded-2xl bg-amber-500/10 px-3 py-2">
                <Text className="font-inter-semibold text-xs text-amber-400">
                  Pending
                </Text>
                <Text className="mt-1 font-inter-bold text-lg text-white">
                  {pendingHours}h
                </Text>
              </View>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};
