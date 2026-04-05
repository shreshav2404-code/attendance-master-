import {
  buildWeeklyTrend,
  calculateAttendanceSummaries,
  calculateOverallMetrics,
} from "@/lib/calculations";
import { useAttendanceStore } from "@/store/attendanceStore";
import { useODStore } from "@/store/odStore";
import { useStudentStore } from "@/store/studentStore";
import { useSubjectStore } from "@/store/subjectStore";

export const useAttendanceSummary = () => {
  const student = useStudentStore((state) => state.student);
  const subjects = useSubjectStore((state) => state.subjects);
  const dailyLogs = useAttendanceStore((state) => state.dailyLogs);
  const odEvents = useODStore((state) => state.odEvents);

  if (!student) {
    return {
      summaries: [],
      overall: {
        TH: 0,
        AH: 0,
        DL: 0,
        pendingOD: 0,
        percentBefore: 0,
        percentAfterDL: 0,
        percentProjected: 0,
        targetPercentage: 75,
      },
      trend: [],
    };
  }

  const summaries = calculateAttendanceSummaries({
    student,
    subjects,
    logs: dailyLogs,
    odEvents,
  });
  const overall = calculateOverallMetrics({
    summaries,
    targetPercentage: student.targetPercentage,
  });
  const trend = buildWeeklyTrend({
    student,
    subjects,
    logs: dailyLogs,
    odEvents,
  });

  return {
    summaries,
    overall,
    trend,
  };
};
