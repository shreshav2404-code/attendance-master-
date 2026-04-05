import { useMemo } from "react";

import { useAttendanceStore } from "@/store/attendanceStore";

export const useDailyLog = (date?: string) => {
  const dailyLogs = useAttendanceStore((state) => state.dailyLogs);
  const logsForDate = useMemo(
    () => (date ? dailyLogs.filter((log) => log.date === date) : dailyLogs),
    [dailyLogs, date],
  );

  return {
    dailyLogs,
    logsForDate,
    hydrated: useAttendanceStore((state) => state.hydrated),
    hydrate: useAttendanceStore((state) => state.hydrate),
    setDailyLogs: useAttendanceStore((state) => state.setDailyLogs),
    setLogsForDate: useAttendanceStore((state) => state.setLogsForDate),
    addLogs: useAttendanceStore((state) => state.addLogs),
    removeLogsByODEvent: useAttendanceStore(
      (state) => state.removeLogsByODEvent,
    ),
  };
};
