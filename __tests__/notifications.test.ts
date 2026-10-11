import * as Notifications from "expo-notifications";

import { runProactiveAlerts, scheduleDailyReminder } from "@/lib/notifications";
import type { ODEvent } from "@/types";

const scheduleMock = Notifications.scheduleNotificationAsync as jest.Mock;

beforeEach(() => {
  scheduleMock.mockClear();
});

describe("daily reminder", () => {
  it("schedules a repeating daily trigger at the chosen time", async () => {
    await scheduleDailyReminder("20:15");

    expect(scheduleMock).toHaveBeenCalledTimes(1);
    expect(scheduleMock.mock.calls[0][0].trigger).toEqual({
      type: "daily",
      hour: 20,
      minute: 15,
      channelId: "attendx-reminders",
    });
  });

  it("ignores a half-typed time instead of scheduling it", async () => {
    await scheduleDailyReminder("20:");
    await scheduleDailyReminder("2");

    expect(scheduleMock).not.toHaveBeenCalled();
  });
});

describe("OD pending reminders", () => {
  it("sends one reminder per event even when two checks overlap", async () => {
    const pendingEvent: ODEvent = {
      id: "od-overlap",
      name: "Hackathon",
      date: "2026-01-05",
      reason: "r",
      type: "hackathon",
      subjects: [{ subjectId: "phy", hours: 1, registered: false }],
      createdAt: "2026-01-05T00:00:00.000Z",
    };
    const input = {
      notificationSettings: {
        dailyReminderEnabled: false,
        dailyReminderTime: "20:30",
        lowAttendanceAlertsEnabled: false,
        odReminderEnabled: true,
        lowAttendanceThreshold: 75,
      },
      summaries: [],
      subjects: [],
      odEvents: [pendingEvent],
    };

    await Promise.all([runProactiveAlerts(input), runProactiveAlerts(input)]);

    expect(scheduleMock).toHaveBeenCalledTimes(1);
  });
});
