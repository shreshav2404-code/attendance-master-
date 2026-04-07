import { Trash2 } from "lucide-react-native";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { Pressable, Text, View } from "react-native";
import { Button } from "react-native-paper";

import type { ODEvent, Subject } from "@/types";

interface ODEventCardProps {
  event: ODEvent;
  subjects: Subject[];
  onPress: () => void;
  onDelete: () => void;
}

export const ODEventCard = ({
  event,
  subjects,
  onPress,
  onDelete,
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
      overshootRight={false}
      friction={2}
      rightThreshold={52}
      containerStyle={{ marginBottom: 16, borderRadius: 28, overflow: "hidden" }}
      renderRightActions={() => (
        <Pressable
          className="items-center justify-center bg-red-600"
          style={{ width: 82 }}
          onPress={onDelete}
        >
          <Trash2 color="#fff" size={18} />
        </Pressable>
      )}
    >
      <Pressable
        className="rounded-[28px] border border-white/10 bg-white/5 p-4"
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
                <View
                  className={`rounded-full px-3 py-1 ${
                    subject.registered
                      ? "bg-emerald-500/20 border border-emerald-400/30"
                      : "bg-amber-500/20 border border-amber-300/30"
                  }`}
                >
                  <Text
                    className={`font-inter text-[11px] ${
                      subject.registered ? "text-emerald-200" : "text-amber-100"
                    }`}
                  >
                    {subject.registered ? "Registered" : "Pending"}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </Pressable>
    </Swipeable>
  );
};
