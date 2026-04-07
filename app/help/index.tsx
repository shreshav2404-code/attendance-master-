import { router } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { Button } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { USER_MANUAL_SECTIONS } from "@/constants/userManual";

export default function UserManualScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: 44 }}
      >
        <View className="flex-row items-center justify-between">
          <View className="pr-3">
            <Text className="font-inter-bold text-3xl text-white">
              User Manual
            </Text>
            <Text className="mt-2 font-inter text-sm leading-6 text-white/65">
              Complete guide for first setup, daily usage, sync, OD tracking,
              and updates.
            </Text>
          </View>
          <Button mode="outlined" onPress={() => router.back()}>
            Back
          </Button>
        </View>

        <View className="mt-6 gap-4">
          {USER_MANUAL_SECTIONS.map((section) => (
            <View
              key={section.id}
              className="rounded-[24px] border border-white/10 bg-white/5 p-4"
            >
              <Text className="font-inter-semibold text-base text-white">
                {section.title}
              </Text>
              <Text className="mt-2 font-inter text-sm leading-6 text-white/70">
                {section.description}
              </Text>
              <View className="mt-3 gap-2">
                {section.steps.map((step, index) => (
                  <Text
                    key={`${section.id}_${step}`}
                    className="font-inter text-sm leading-6 text-white/80"
                  >
                    {index + 1}. {step}
                  </Text>
                ))}
              </View>
              {section.note ? (
                <Text className="mt-3 font-inter text-xs leading-5 text-[#93c5fd]">
                  Tip: {section.note}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

