import { Text, View } from "react-native";
import { Button, Switch, TextInput } from "react-native-paper";

import { SettingsPage } from "@/components/settings/SettingsPage";
import { useNotifications } from "@/hooks/useNotifications";
import { useStudent } from "@/hooks/useStudent";
import { useToast } from "@/hooks/useToast";
import { triggerTapHaptic } from "@/lib/haptics";
import { isValidReminderTime } from "@/lib/notifications";

export default function NotificationSettingsScreen() {
  const { notificationSettings, setNotificationSettings } = useStudent();
  const { initializeNotifications } = useNotifications();
  const toast = useToast();

  return (
    <SettingsPage
      page="notifications"
      title="Notifications"
      description="A daily reminder to mark attendance, plus alerts when a subject drops low or an OD is still pending."
      toast={toast}
    >
      <View className="mt-6 gap-4 rounded-[28px] border border-white/10 bg-white/5 p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-inter text-sm text-white/70">Daily reminder</Text>
          <Switch
            value={notificationSettings.dailyReminderEnabled}
            onValueChange={(dailyReminderEnabled) =>
              void setNotificationSettings({
                ...notificationSettings,
                dailyReminderEnabled,
              })
            }
          />
        </View>
        <TextInput
          mode="outlined"
          label="Reminder time (HH:mm)"
          value={notificationSettings.dailyReminderTime}
          onChangeText={(dailyReminderTime) =>
            void setNotificationSettings({
              ...notificationSettings,
              dailyReminderTime,
            })
          }
          style={{ backgroundColor: "transparent" }}
        />
        {!isValidReminderTime(notificationSettings.dailyReminderTime) ? (
          <Text className="-mt-2 font-inter text-xs text-red-300">
            Use 24-hour HH:mm, e.g. 20:30. The reminder keeps its last valid time until then.
          </Text>
        ) : null}
        <View className="flex-row items-center justify-between">
          <Text className="font-inter text-sm text-white/70">Low attendance alerts</Text>
          <Switch
            value={notificationSettings.lowAttendanceAlertsEnabled}
            onValueChange={(lowAttendanceAlertsEnabled) =>
              void setNotificationSettings({
                ...notificationSettings,
                lowAttendanceAlertsEnabled,
              })
            }
          />
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="font-inter text-sm text-white/70">OD reminders</Text>
          <Switch
            value={notificationSettings.odReminderEnabled}
            onValueChange={(odReminderEnabled) =>
              void setNotificationSettings({
                ...notificationSettings,
                odReminderEnabled,
              })
            }
          />
        </View>
        <Button
          mode="contained-tonal"
          onPress={async () => {
            await triggerTapHaptic();
            await initializeNotifications();
            await toast.success("Notification preferences saved");
          }}
        >
          Save notifications
        </Button>
      </View>
    </SettingsPage>
  );
}
