import {
  calculateAttendanceSummaries,
  calculateSkipSimulations,
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

  const slotsToday = isDateWorking({
    date,
    workingDays,
    workingDateOverrides,
  })
    ? timetable.filter((slot) => slot.day === getWorkingDayForDate(date))
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
