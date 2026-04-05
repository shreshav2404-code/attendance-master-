import {
  cancelDailyReminder,
  configureNotificationChannel,
  requestNotificationPermissions,
  runProactiveAlerts,
  scheduleDailyReminder,
} from "@/lib/notifications";
import { useStudentStore } from "@/store/studentStore";
import type { AttendanceSummary, ODEvent, Subject } from "@/types";

export const useNotifications = () => {
  const notificationSettings = useStudentStore(
    (state) => state.notificationSettings,
  );
  const setNotificationSettings = useStudentStore(
    (state) => state.setNotificationSettings,
  );

  return {
    notificationSettings,
    setNotificationSettings,
    initializeNotifications: async () => {
      const granted = await requestNotificationPermissions();

      if (!granted) {
        return false;
      }

      await configureNotificationChannel();

      if (notificationSettings.dailyReminderEnabled) {
        await scheduleDailyReminder(notificationSettings.dailyReminderTime);
      } else {
        await cancelDailyReminder();
      }

      return true;
    },
    syncReminderRules: async ({
      summaries,
      subjects,
      odEvents,
    }: {
      summaries: AttendanceSummary[];
      subjects: Subject[];
      odEvents: ODEvent[];
    }) => {
      await runProactiveAlerts({
        notificationSettings,
        summaries,
        subjects,
        odEvents,
      });
    },
  };
};
