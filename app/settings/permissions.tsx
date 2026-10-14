import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { AppState, Linking, Text, View } from "react-native";
import { Button } from "react-native-paper";

import { SettingsPage } from "@/components/settings/SettingsPage";
import { useToast } from "@/hooks/useToast";
import { triggerTapHaptic } from "@/lib/haptics";
import {
  getPermissionStatuses,
  requestAppPermission,
  type AppPermissionStatus,
} from "@/lib/permissions";

const NO_PERMISSION_NEEDED = [
  {
    label: "Files, PDFs and gallery photos",
    reason: "Picked through Android's own file and photo pickers, so AttendX never needs storage access.",
  },
  {
    label: "Installing updates",
    reason: 'Android asks once, the first time you install an update from inside AttendX ("Allow from this source").',
  },
];

export default function PermissionsSettingsScreen() {
  const toast = useToast();
  const [statuses, setStatuses] = useState<AppPermissionStatus[]>([]);

  const refresh = useCallback(() => {
    void getPermissionStatuses()
      .then(setStatuses)
      .catch(() => undefined);
  }, []);

  // Re-check when the page opens and when coming back from system Settings.
  useFocusEffect(
    useCallback(() => {
      refresh();
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") {
          refresh();
        }
      });
      return () => subscription.remove();
    }, [refresh]),
  );

  const allow = async (status: AppPermissionStatus) => {
    void triggerTapHaptic();
    if (!status.canAskAgain) {
      await Linking.openSettings();
      return;
    }
    const granted = await requestAppPermission(status.key);
    refresh();
    if (granted) {
      await toast.success(`${status.label} allowed`);
    } else {
      await toast.warn(`${status.label} is still off. You can allow it in Android Settings.`);
    }
  };

  return (
    <SettingsPage
      page="permissions"
      title="Permissions"
      description="What AttendX asks for and why. Everything stays on this phone."
      toast={toast}
    >
      <View className="mt-6 gap-3">
        {statuses.map((status) => (
          <View key={status.key} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
            <View className="flex-row items-center justify-between">
              <Text className="font-inter-bold text-base text-white">{status.label}</Text>
              <Text
                className="font-inter-semibold text-xs"
                style={{ color: status.granted ? "#6ee7b7" : "#fca5a5" }}
              >
                {status.granted ? "Allowed" : "Not allowed"}
              </Text>
            </View>
            <Text className="mt-1 font-inter text-sm leading-6 text-white/65">{status.reason}</Text>
            {status.granted ? null : (
              <Button mode="contained-tonal" style={{ marginTop: 10 }} onPress={() => void allow(status)}>
                {status.canAskAgain ? "Allow" : "Open Android settings"}
              </Button>
            )}
          </View>
        ))}
        {NO_PERMISSION_NEEDED.map((item) => (
          <View key={item.label} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
            <View className="flex-row items-center justify-between">
              <Text className="font-inter-bold text-base text-white">{item.label}</Text>
              <Text className="font-inter-semibold text-xs text-white/50">No permission</Text>
            </View>
            <Text className="mt-1 font-inter text-sm leading-6 text-white/65">{item.reason}</Text>
          </View>
        ))}
      </View>
    </SettingsPage>
  );
}
