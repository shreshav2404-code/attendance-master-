import { Trash2 } from "lucide-react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { Pressable, Text, View } from "react-native";
import { Button, Switch } from "react-native-paper";

import type { ODEvent, Subject } from "@/types";

interface ODEventCardProps {
  event: ODEvent;
  subjects: Subject[];
  onPress: () => void;
  onDelete: () => void;
  onToggleRegistration: (subjectId: string, registered: boolean) => void;
}

export const ODEventCard = ({
  event,
  subjects,
  onPress,
  onDelete,
  onToggleRegistration,
}: ODEventCardProps) => {
  const subjectLookup = new Map(subjects.map((subject) => [subject.id, subject]));
  const registeredHours = event.subjects
    .filter((subject) => subject.registered)
    .reduce((sum, subject) => sum + subject.hours, 0);
  const pendingHours = event.subjects
    .filter((subject) => !subject.registered)
    .reduce((sum, subject) => sum + subject.hours, 0);

  return (
    <Swipeable
      renderRightActions={() => (
        <Pressable
          className="ml-3 items-center justify-center rounded-[24px] bg-red-600 px-5"
          onPress={onDelete}
        >
          <Trash2 color="#fff" size={18} />
        </Pressable>
      )}
    >
      <Pressable
        className="mb-4 rounded-[28px] border border-white/10 bg-white/5 p-4"
        onPress={onPress}
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-4">
            <Text className="font-inter-bold text-lg text-white">{event.name}</Text>
            <Text className="mt-1 font-inter text-sm text-white/55">
              {event.type} · {event.date}
              {event.endDate ? ` → ${event.endDate}` : ""}
            </Text>
          </View>
          <Button mode="contained-tonal" compact>
            {registeredHours}h ✅ {pendingHours}h ⏳
          </Button>
        </View>

        <View className="mt-4 gap-3">
          {event.subjects.map((subject) => {
            const subjectMeta = subjectLookup.get(subject.subjectId);

            return (
              <View
                key={`${event.id}_${subject.subjectId}_${subject.hours}_${subject.registered ? "registered" : "pending"}`}
                className="flex-row items-center justify-between rounded-[20px] bg-black/15 px-4 py-3"
              >
                <View className="flex-1 pr-4">
                  <Text className="font-inter-semibold text-sm text-white">
                    {subjectMeta?.name ?? subject.subjectId}
                  </Text>
                  <Text className="mt-1 font-inter text-xs text-white/55">
                    {subject.hours} hours ·{" "}
                    {subject.registered ? "Registered" : "Pending"}
                  </Text>
                </View>
                <Switch
                  value={subject.registered}
                  onValueChange={(registered) =>
                    onToggleRegistration(subject.subjectId, registered)
                  }
                />
              </View>
            );
          })}
        </View>
      </Pressable>
    </Swipeable>
  );
};
