import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { getODPendingEvents } from "@/lib/calculations";
import { getTodayKey } from "@/lib/utils";
import type {
  AttendanceSummary,
  NotificationSettings,
  ODEvent,
  Subject,
} from "@/types";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowAlert: true,
  }),
});

const DAILY_REMINDER_IDENTIFIER = "attendx-daily-reminder";
const ALERT_TRACKER_KEY = "attendx.notification_tracker";

interface NotificationTracker {
  lowAttendance: Record<string, string>;
  odPending: Record<string, string>;
}

const readTracker = async (): Promise<NotificationTracker> => {
  const value = await AsyncStorage.getItem(ALERT_TRACKER_KEY);

  if (!value) {
    return {
      lowAttendance: {},
      odPending: {},
    };
  }

  try {
    const parsed = JSON.parse(value) as NotificationTracker;

    return {
      lowAttendance: parsed.lowAttendance ?? {},
      odPending: parsed.odPending ?? {},
    };
  } catch {
    return {
      lowAttendance: {},
      odPending: {},
    };
  }
};

const saveTracker = async (tracker: NotificationTracker): Promise<void> => {
  await AsyncStorage.setItem(ALERT_TRACKER_KEY, JSON.stringify(tracker));
};

const safeSchedule = async (schedule: () => Promise<unknown>): Promise<void> => {
  try {
    await schedule();
  } catch {
    // Ignore scheduling errors when notifications are unavailable.
  }
};

export const requestNotificationPermissions = async (): Promise<boolean> => {
  const currentPermissions = await Notifications.getPermissionsAsync();

  if (currentPermissions.granted) {
    return true;
  }

  const requestedPermissions = await Notifications.requestPermissionsAsync();
  return requestedPermissions.granted;
};

export const configureNotificationChannel = async (): Promise<void> => {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync("attendx-reminders", {
    name: "AttendX Reminders",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 150, 250],
    lightColor: "#1a5fa8",
  });
};

export const cancelDailyReminder = async (): Promise<void> => {
  const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
  const matchingNotification = scheduledNotifications.find(
    (notification) => notification.identifier === DAILY_REMINDER_IDENTIFIER,
  );

  if (matchingNotification) {
    await Notifications.cancelScheduledNotificationAsync(
      matchingNotification.identifier,
    );
  }
};

export const scheduleDailyReminder = async (time: string): Promise<void> => {
  const [hourString, minuteString] = time.split(":");
  const hour = Number(hourString);
  const minute = Number(minuteString);

  await cancelDailyReminder();
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_IDENTIFIER,
    content: {
      title: "AttendX",
      body: "Don't forget to mark today's attendance! 📋",
      sound: true,
    },
    trigger: {
      hour,
      minute,
      repeats: true,
      channelId: "attendx-reminders",
    },
  });
};

export const scheduleLowAttendanceAlert = async ({
  subjectName,
  percentage,
}: {
  subjectName: string;
  percentage: number;
}): Promise<string> =>
  Notifications.scheduleNotificationAsync({
    content: {
      title: "Low attendance alert",
      body: `⚠️ ${subjectName} dropped to ${percentage.toFixed(
        2,
      )}% — attend next class!`,
    },
    trigger: null,
  });

export const scheduleODPendingReminder = async (
  eventName: string,
): Promise<string> =>
  Notifications.scheduleNotificationAsync({
    content: {
      title: "OD still pending",
      body: `Your OD from ${eventName} is still pending registration with college`,
    },
    trigger: null,
  });

export const runProactiveAlerts = async ({
  notificationSettings,
  summaries,
  subjects,
  odEvents,
}: {
  notificationSettings: NotificationSettings;
  summaries: AttendanceSummary[];
  subjects: Subject[];
  odEvents: ODEvent[];
}): Promise<void> => {
  if (
    !notificationSettings.lowAttendanceAlertsEnabled &&
    !notificationSettings.odReminderEnabled
  ) {
    return;
  }

  const today = getTodayKey();
  const tracker = await readTracker();
  const subjectLookup = new Map(subjects.map((subject) => [subject.id, subject]));
  let trackerChanged = false;
  const scheduledTasks: Promise<void>[] = [];

  if (notificationSettings.lowAttendanceAlertsEnabled) {
    summaries.forEach((summary) => {
      const shouldAlert =
        summary.percentProjected < notificationSettings.lowAttendanceThreshold;

      if (!shouldAlert) {
        if (tracker.lowAttendance[summary.subjectId]) {
          delete tracker.lowAttendance[summary.subjectId];
          trackerChanged = true;
        }

        return;
      }

      if (tracker.lowAttendance[summary.subjectId] === today) {
        return;
      }

      const subject = subjectLookup.get(summary.subjectId);
      const subjectName = subject?.name ?? subject?.shortName ?? "Subject";

      tracker.lowAttendance[summary.subjectId] = today;
      trackerChanged = true;
      scheduledTasks.push(
        safeSchedule(() =>
          scheduleLowAttendanceAlert({
            subjectName,
            percentage: summary.percentProjected,
          }),
        ),
      );
    });
  } else if (Object.keys(tracker.lowAttendance).length > 0) {
    tracker.lowAttendance = {};
    trackerChanged = true;
  }

  if (notificationSettings.odReminderEnabled) {
    const pendingEvents = getODPendingEvents(odEvents);
    const pendingEventIds = new Set(pendingEvents.map((event) => event.id));

    pendingEvents.forEach((event) => {
      if (tracker.odPending[event.id] === today) {
        return;
      }

      tracker.odPending[event.id] = today;
      trackerChanged = true;
      scheduledTasks.push(
        safeSchedule(() => scheduleODPendingReminder(event.name)),
      );
    });

    Object.keys(tracker.odPending).forEach((eventId) => {
      if (!pendingEventIds.has(eventId)) {
        delete tracker.odPending[eventId];
        trackerChanged = true;
      }
    });
  } else if (Object.keys(tracker.odPending).length > 0) {
    tracker.odPending = {};
    trackerChanged = true;
  }

  await Promise.all(scheduledTasks);

  if (trackerChanged) {
    await saveTracker(tracker);
  }
};
