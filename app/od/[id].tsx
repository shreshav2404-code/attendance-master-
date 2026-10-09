import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { Button } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useDeleteODEvent } from "@/hooks/useDeleteODEvent";
import { useODEvents } from "@/hooks/useODEvents";
import { useSubjects } from "@/hooks/useSubjects";
import { triggerWarningHaptic } from "@/lib/haptics";

export default function ODEventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { odEvents } = useODEvents();
  const { subjects } = useSubjects();
  const deleteODEvent = useDeleteODEvent();

  const event = odEvents.find((item) => item.id === id);
  const subjectLookup = new Map(subjects.map((subject) => [subject.id, subject]));

  if (!event) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-5">
          <Text className="font-inter-bold text-2xl text-white">
            OD event not found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View className="rounded-[28px] border border-white/10 bg-white/5 p-5">
          <Text className="font-inter-bold text-3xl text-white">{event.name}</Text>
          <Text className="mt-2 font-inter text-base text-white/60">
            {event.type} · {event.date}
            {event.endDate ? ` → ${event.endDate}` : ""}
          </Text>
          <Text className="mt-4 font-inter text-base leading-7 text-white/75">
            {event.reason}
          </Text>
        </View>

        <Text className="mb-3 mt-6 font-inter-bold text-xl text-white">
          Subject breakdown
        </Text>
        <View className="gap-3">
          {event.subjects.map((subject) => (
            <View
              key={`${event.id}_${subject.subjectId}_${subject.hours}_${subject.registered ? "registered" : "pending"}`}
              className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4"
            >
              <Text className="font-inter-semibold text-base text-white">
                {subjectLookup.get(subject.subjectId)?.name ?? subject.subjectId}
              </Text>
              <Text className="mt-1 font-inter text-sm text-white/55">
                {subject.hours} hours ·{" "}
                {subject.registered ? "Registered with college" : "Still pending"}
              </Text>
            </View>
          ))}
        </View>

        <Button
          mode="contained"
          buttonColor="#7f1d1d"
          icon="delete-outline"
          style={{ marginTop: 24 }}
          onPress={async () => {
            await triggerWarningHaptic();

            if (await deleteODEvent(event)) {
              router.back();
            }
          }}
        >
          Delete OD event
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
