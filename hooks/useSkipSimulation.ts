import {
  calculateAttendanceSummaries,
  calculateSkipSimulations,
  getSlotLogId,
} from "@/lib/calculations";
import { getTodayKey, getWorkingDayForDate, isDateWorking } from "@/lib/utils";
import { useAttendanceStore } from "@/store/attendanceStore";
import { useODStore } from "@/store/odStore";
import { useStudentStore } from "@/store/studentStore";
import { useSubjectStore } from "@/store/subjectStore";

export const useSkipSimulation = (date = getTodayKey()) => {
  const student = useStudentStore((state) => state.student);
  const workingDays = useStudentStore((state) => state.workingDays);
  const workingDateOverrides = useStudentStore(
    (state) => state.workingDateOverrides,
  );
  const officialSyncSnapshotBySubject = useStudentStore(
    (state) => state.officialSyncSnapshotBySubject,
  );
  const subjects = useSubjectStore((state) => state.subjects);
  const timetable = useSubjectStore((state) => state.timetable);
  const dailyLogs = useAttendanceStore((state) => state.dailyLogs);
  const odEvents = useODStore((state) => state.odEvents);

  if (!student) {
    return [];
  }

  // Classes already marked for the day are in TH; simulating them again would
  // count them twice, so only offer classes that haven't been marked yet.
  const markedLogIds = new Set(
    dailyLogs.filter((log) => log.date === date).map((log) => log.id),
  );
  const slotsToday = isDateWorking({
    date,
    workingDays,
    workingDateOverrides,
  })
    ? timetable.filter(
        (slot) =>
          slot.day === getWorkingDayForDate(date) &&
          !markedLogIds.has(getSlotLogId(date, slot.id)),
      )
    : [];

  return calculateSkipSimulations({
    summaries: calculateAttendanceSummaries({
      student,
      subjects,
      logs: dailyLogs,
      odEvents,
      officialSyncSnapshotBySubject,
    }),
    slotsToday,
    subjects,
  });
};
