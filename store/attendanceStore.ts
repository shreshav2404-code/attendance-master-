import { create } from "zustand";

import { loadDailyLogs, saveDailyLogs } from "@/lib/storage";
import type { DailyLog } from "@/types";

interface AttendanceStoreState {
  hydrated: boolean;
  hydrating: boolean;
  dailyLogs: DailyLog[];
  hydrate: () => Promise<void>;
  setDailyLogs: (dailyLogs: DailyLog[]) => Promise<void>;
  setLogsForDate: (date: string, logs: DailyLog[]) => Promise<void>;
  addLogs: (logs: DailyLog[]) => Promise<void>;
  removeLogsByODEvent: (odEventId: string) => Promise<void>;
}

export const useAttendanceStore = create<AttendanceStoreState>((set, get) => ({
  hydrated: false,
  hydrating: false,
  dailyLogs: [],
  hydrate: async () => {
    if (get().hydrated || get().hydrating) {
      return;
    }

    set({ hydrating: true });
    const dailyLogs = await loadDailyLogs();
    set({
      hydrated: true,
      hydrating: false,
      dailyLogs,
    });
  },
  setDailyLogs: async (dailyLogs) => {
    set({ dailyLogs });
    await saveDailyLogs(dailyLogs);
  },
  setLogsForDate: async (date, logs) => {
    const existingLogs = get().dailyLogs.filter((log) => log.date !== date);
    const dailyLogs = [...existingLogs, ...logs];
    set({ dailyLogs });
    await saveDailyLogs(dailyLogs);
  },
  addLogs: async (logs) => {
    const dailyLogs = [...get().dailyLogs, ...logs];
    set({ dailyLogs });
    await saveDailyLogs(dailyLogs);
  },
  removeLogsByODEvent: async (odEventId) => {
    const dailyLogs = get().dailyLogs.filter((log) => log.odEventId !== odEventId);
    set({ dailyLogs });
    await saveDailyLogs(dailyLogs);
  },
}));
