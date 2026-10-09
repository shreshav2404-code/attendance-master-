import { Pressable, ScrollView, Text, View } from "react-native";

import { BottomSheet } from "@/components/shared/BottomSheet";
import type { ODEvent } from "@/types";

interface ODPickerProps {
  visible: boolean;
  events: ODEvent[];
  onClose: () => void;
  onSelect: (event: ODEvent) => void;
  onSelectWithoutEvent: () => void;
}

export const ODPicker = ({
  visible,
  events,
  onClose,
  onSelect,
  onSelectWithoutEvent,
}: ODPickerProps) => (
  <BottomSheet visible={visible} onClose={onClose} title="Mark as OD">
    <ScrollView
      style={{ maxHeight: 420 }}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="gap-3">
        <Pressable
          className="rounded-[24px] border border-violet-400/40 bg-violet-500/10 p-4"
          onPress={() => {
            onSelectWithoutEvent();
            onClose();
          }}
        >
          <Text className="font-inter-bold text-base text-white">OD without an event</Text>
          <Text className="mt-1 font-inter text-sm text-white/55">
            Counts as pending OD for this class only
          </Text>
        </Pressable>
        {events.map((event) => (
          <Pressable
            key={event.id}
            className="rounded-[24px] border border-white/10 bg-white/5 p-4"
            onPress={() => {
              onSelect(event);
              onClose();
            }}
          >
            <Text className="font-inter-bold text-base text-white">{event.name}</Text>
            <Text className="mt-1 font-inter text-sm text-white/55">
              {event.date}
              {event.endDate ? ` → ${event.endDate}` : ""}
            </Text>
            <Text className="mt-2 font-inter text-sm text-white/70">
              {event.reason}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  </BottomSheet>
);
