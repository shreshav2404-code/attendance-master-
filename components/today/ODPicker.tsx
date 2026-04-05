import { Pressable, ScrollView, Text, View } from "react-native";

import { BottomSheet } from "@/components/shared/BottomSheet";
import type { ODEvent } from "@/types";

interface ODPickerProps {
  visible: boolean;
  events: ODEvent[];
  onClose: () => void;
  onSelect: (event: ODEvent) => void;
}

export const ODPicker = ({
  visible,
  events,
  onClose,
  onSelect,
}: ODPickerProps) => (
  <BottomSheet visible={visible} onClose={onClose} title="Pick OD event">
    <ScrollView
      style={{ maxHeight: 420 }}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="gap-3">
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
