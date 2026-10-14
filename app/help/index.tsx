import { Text, View } from "react-native";

import { SettingsPage } from "@/components/settings/SettingsPage";
import { USER_MANUAL_SECTIONS } from "@/constants/userManual";
import { useToast } from "@/hooks/useToast";

export default function UserManualScreen() {
  const toast = useToast();

  return (
    <SettingsPage
      page="help"
      title="User Manual"
      description="Complete guide for first setup, daily usage, sync, OD tracking, and updates."
      toast={toast}
    >
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
    </SettingsPage>
  );
}
