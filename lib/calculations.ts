import {
  eachDayOfInterval,
  endOfWeek,
  format,
  parseISO,
  startOfWeek,
} from "date-fns";

import {
  getTodayKey,
  getWorkingDayForDate,
  isDateWorking,
  roundToTwo,
} from "@/lib/utils";
import type {
  AttendanceSummary,
  DailyLog,
  ODTemplateResult,
  ODEvent,
  OfficialSyncSnapshotBySubject,
  OverallAttendanceMetrics,
  SkipSimulationResult,
  Student,
  Subject,
  TimetableSlot,
  TrendPoint,
  WorkingDateOverrides,
  WorkingDay,
} from "@/types";

export const resolveClassHours = (
  slot: Pick<TimetableSlot, "isDouble" | "isLab">,
): number => (slot.isDouble || slot.isLab ? 2 : 1);

export const calculateHoursNeeded = ({
  targetPercentage,
  TH,
  AH,
  DL,
  pendingOD,
  estimatedFutureTH,
}: {
  targetPercentage: number;
  TH: number;
  AH: number;
  DL: number;
  pendingOD: number;
  estimatedFutureTH?: number;
}): number => {
  const target = Math.min(Math.max(targetPercentage, 0), 100) / 100;
  const effectiveTH = Math.max(TH, estimatedFutureTH ?? TH);
  const numerator = target * effectiveTH - AH - DL - pendingOD;

  if (numerator <= 0) {
    return 0;
  }

  if (target >= 1) {
    return Math.ceil(effectiveTH - AH - DL - pendingOD);
  }

  return Math.ceil(numerator / (1 - target));
};

export const getAttendanceStatus = (
  projectedPercentage: number,
): AttendanceSummary["status"] => {
  const roundedProjected = roundToTwo(projectedPercentage);

  if (roundedProjected < 70) {
    return "danger";
  }

  if (roundedProjected < 75) {
    return "warning";
  }

  if (roundedProjected === 75) {
    return "exact";
  }

  if (roundedProjected <= 80) {
    return "safe";
  }

  return "excellent";
};

const calculatePercentage = (numerator: number, denominator: number): number =>
  denominator === 0 ? 0 : roundToTwo((numerator / denominator) * 100);

const getRegisteredODHours = (subjectId: string, odEvents: ODEvent[]): number =>
  odEvents.reduce((total, event) => {
    const registeredHours = event.subjects
      .filter((subject) => subject.subjectId === subjectId && subject.registered)
      .reduce((sum, subject) => sum + subject.hours, 0);

    return total + registeredHours;
  }, 0);

const getRegisteredODHoursSinceSync = ({
  subjectId,
  odEvents,
  syncedAt,
}: {
  subjectId: string;
  odEvents: ODEvent[];
  syncedAt: string;
}): number =>
  odEvents.reduce((total, event) => {
    const registeredHours = event.subjects
      .filter((subject) => {
        if (subject.subjectId !== subjectId || !subject.registered) {
          return false;
        }

        if (subject.registeredAt) {
          return subject.registeredAt > syncedAt;
        }

        return event.createdAt > syncedAt;
      })
      .reduce((sum, subject) => sum + subject.hours, 0);

    return total + registeredHours;
  }, 0);

export const calculateAttendanceSummary = ({
  student,
  subject,
  logs,
  odEvents,
  estimatedFutureTH,
  officialSyncSnapshotBySubject,
}: {
  student: Student;
  subject: Subject;
  logs: DailyLog[];
  odEvents: ODEvent[];
  estimatedFutureTH?: number;
  officialSyncSnapshotBySubject?: OfficialSyncSnapshotBySubject;
}): AttendanceSummary => {
  const subjectLogs = logs.filter((log) => log.subjectId === subject.id);
  const officialSnapshot = officialSyncSnapshotBySubject?.[subject.id];
  let TH = 0;
  let AH = 0;
  let DL = 0;
  let pendingOD = 0;

  if (officialSnapshot) {
    const postSyncLogs = subjectLogs.filter(
      (log) => !log.createdAt || log.createdAt > officialSnapshot.syncedAt,
    );
    const postSyncTH = postSyncLogs.reduce(
      (sum, log) => (log.status === "suspended" ? sum : sum + log.hours),
      0,
    );
    const postSyncAH = postSyncLogs.reduce(
      (sum, log) => (log.status === "present" ? sum + log.hours : sum),
      0,
    );
    const trackedODPostSync = postSyncLogs.reduce(
      (sum, log) => (log.status === "od" ? sum + log.hours : sum),
      0,
    );
    const registeredODPostSync = getRegisteredODHoursSinceSync({
      subjectId: subject.id,
      odEvents,
      syncedAt: officialSnapshot.syncedAt,
    });

    TH = officialSnapshot.TH + postSyncTH;
    AH = officialSnapshot.AH + postSyncAH;
    DL = officialSnapshot.DL + registeredODPostSync;
    pendingOD = Math.max(0, trackedODPostSync - registeredODPostSync);
  } else {
    const calculatedTH = subjectLogs.reduce(
      (sum, log) => (log.status === "suspended" ? sum : sum + log.hours),
      0,
    );
    const calculatedAH = subjectLogs.reduce(
      (sum, log) => (log.status === "present" ? sum + log.hours : sum),
      0,
    );
    const trackedODHours = subjectLogs.reduce(
      (sum, log) => (log.status === "od" ? sum + log.hours : sum),
      0,
    );
    const calculatedDL = Math.min(
      trackedODHours,
      getRegisteredODHours(subject.id, odEvents),
    );

    TH = calculatedTH;
    AH = calculatedAH;
    DL = calculatedDL;
    pendingOD = Math.max(0, trackedODHours - DL);
  }

  const AH_DL = AH + DL;
  const AH_allOD = AH_DL + pendingOD;
  const percentBefore = calculatePercentage(AH, TH);
  const percentAfterDL = calculatePercentage(AH_DL, TH);
  const percentProjected = calculatePercentage(AH_allOD, TH);
  const hoursNeeded = calculateHoursNeeded({
    targetPercentage: student.targetPercentage,
    TH,
    AH,
    DL,
    pendingOD,
    estimatedFutureTH,
  });
  const futureTH = Math.max(TH, estimatedFutureTH ?? TH);
  const maxPossibleProjected =
    futureTH === 0
      ? 0
      : calculatePercentage(AH_allOD + Math.max(0, futureTH - TH), futureTH);
  const canRecover =
    estimatedFutureTH === undefined
      ? student.targetPercentage < 100 || percentProjected === 100
      : maxPossibleProjected >= student.targetPercentage;

  return {
    subjectId: subject.id,
    TH,
    AH,
    DL,
    pendingOD,
    AH_DL,
    AH_allOD,
    percentBefore,
    percentAfterDL,
    percentProjected,
    hoursNeeded,
    canRecover,
    isSafe: percentProjected > 80,
    status: getAttendanceStatus(percentProjected),
  };
};

export const calculateAttendanceSummaries = ({
  student,
  subjects,
  logs,
  odEvents,
  estimatedFutureTHBySubject,
  officialSyncSnapshotBySubject,
}: {
  student: Student;
  subjects: Subject[];
  logs: DailyLog[];
  odEvents: ODEvent[];
  estimatedFutureTHBySubject?: Record<string, number>;
  officialSyncSnapshotBySubject?: OfficialSyncSnapshotBySubject;
}): AttendanceSummary[] =>
  subjects.map((subject) =>
    calculateAttendanceSummary({
      student,
      subject,
      logs,
      odEvents,
      estimatedFutureTH: estimatedFutureTHBySubject?.[subject.id],
      officialSyncSnapshotBySubject,
    }),
  );

export const calculateOverallMetrics = ({
  summaries,
  targetPercentage,
}: {
  summaries: AttendanceSummary[];
  targetPercentage: number;
}): OverallAttendanceMetrics => {
  const TH = summaries.reduce((sum, summary) => sum + summary.TH, 0);
  const AH = summaries.reduce((sum, summary) => sum + summary.AH, 0);
  const DL = summaries.reduce((sum, summary) => sum + summary.DL, 0);
  const pendingOD = summaries.reduce((sum, summary) => sum + summary.pendingOD, 0);

  return {
    TH,
    AH,
    DL,
    pendingOD,
    percentBefore: calculatePercentage(AH, TH),
    percentAfterDL: calculatePercentage(AH + DL, TH),
    percentProjected: calculatePercentage(AH + DL + pendingOD, TH),
    targetPercentage,
  };
};

export const simulateSkipImpact = ({
  summary,
  hoursToday,
  subjectName,
}: {
  summary: AttendanceSummary;
  hoursToday: number;
  subjectName: string;
}): SkipSimulationResult => {
  const simulateTH = summary.TH + hoursToday;
  const projectedIfSkipped = calculatePercentage(summary.AH_allOD, simulateTH);

  return {
    subjectId: summary.subjectId,
    subjectName,
    currentProjected: summary.percentProjected,
    projectedIfSkipped,
    diff: roundToTwo(projectedIfSkipped - summary.percentProjected),
    hoursToday,
  };
};

export const calculateSkipSimulations = ({
  summaries,
  slotsToday,
  subjects,
}: {
  summaries: AttendanceSummary[];
  slotsToday: TimetableSlot[];
  subjects: Subject[];
}): SkipSimulationResult[] => {
  const hoursBySubject = slotsToday.reduce<Record<string, number>>((accumulator, slot) => {
    const existingHours = accumulator[slot.subjectId] ?? 0;
    accumulator[slot.subjectId] = existingHours + resolveClassHours(slot);
    return accumulator;
  }, {});

  return summaries
    .filter((summary) => (hoursBySubject[summary.subjectId] ?? 0) > 0)
    .map((summary) => {
      const subject = subjects.find((item) => item.id === summary.subjectId);

      return simulateSkipImpact({
        summary,
        hoursToday: hoursBySubject[summary.subjectId] ?? 0,
        subjectName: subject?.shortName ?? subject?.name ?? "Subject",
      });
    });
};

export const buildWeeklyTrend = ({
  student,
  subjects,
  logs,
  odEvents,
  officialSyncSnapshotBySubject,
}: {
  student: Student;
  subjects: Subject[];
  logs: DailyLog[];
  odEvents: ODEvent[];
  officialSyncSnapshotBySubject?: OfficialSyncSnapshotBySubject;
}): TrendPoint[] => {
  const weekStarts = Array.from(
    new Set(
      logs.map((log) =>
        format(startOfWeek(parseISO(log.date), { weekStartsOn: 1 }), "yyyy-MM-dd"),
      ),
    ),
  ).sort();

  if (weekStarts.length === 0) {
    return [
      {
        week: 1,
        label: "W1",
        physical: 0,
        official: 0,
        projected: 0,
      },
    ];
  }

  return weekStarts.map((weekStart, index) => {
    const weekEnd = format(
      endOfWeek(parseISO(weekStart), { weekStartsOn: 1 }),
      "yyyy-MM-dd",
    );
    const cumulativeLogs = logs.filter((log) => log.date <= weekEnd);
    const summaries = calculateAttendanceSummaries({
      student,
      subjects,
      logs: cumulativeLogs,
      odEvents,
      officialSyncSnapshotBySubject,
    });
    const overall = calculateOverallMetrics({
      summaries,
      targetPercentage: student.targetPercentage,
    });

    return {
      week: index + 1,
      label: `W${index + 1}`,
      physical: overall.percentBefore,
      official: overall.percentAfterDL,
      projected: overall.percentProjected,
    };
  });
};

export const buildODTemplateFromTimetable = ({
  timetable,
  startDate,
  endDate,
  odEventId,
  note,
  workingDays,
  workingDateOverrides,
}: {
  timetable: TimetableSlot[];
  startDate: string;
  endDate: string;
  odEventId?: string;
  note?: string;
  workingDays?: WorkingDay[];
  workingDateOverrides?: WorkingDateOverrides;
}): ODTemplateResult => {
  const normalizedStart = startDate <= endDate ? startDate : endDate;
  const normalizedEnd = startDate <= endDate ? endDate : startDate;
  const subjectHourMap = new Map<string, number>();
  const logs: DailyLog[] = [];
  const createdAt = new Date().toISOString();

  eachDayOfInterval({
    start: parseISO(normalizedStart),
    end: parseISO(normalizedEnd),
  }).forEach((date) => {
    const dateKey = format(date, "yyyy-MM-dd");

    if (
      workingDays &&
      !isDateWorking({
        date: dateKey,
        workingDays,
        workingDateOverrides: workingDateOverrides ?? {},
      })
    ) {
      return;
    }

    const workingDay = getWorkingDayForDate(dateKey);
    const slotsForDay = timetable.filter((slot) => slot.day === workingDay);

    slotsForDay.forEach((slot) => {
      const hours = resolveClassHours(slot);
      const existingHours = subjectHourMap.get(slot.subjectId) ?? 0;

      subjectHourMap.set(slot.subjectId, existingHours + hours);
      logs.push({
        id: `${odEventId ?? "od"}_${dateKey}_${slot.subjectId}_${slot.hour}`,
        date: dateKey,
        subjectId: slot.subjectId,
        status: "od",
        hours,
        odEventId,
        note,
        createdAt,
      });
    });
  });

  return {
    subjects: Array.from(subjectHourMap.entries()).map(([subjectId, hours]) => ({
      subjectId,
      hours,
      registered: false,
    })),
    logs,
  };
};

export const getODPendingEvents = (odEvents: ODEvent[]): ODEvent[] => {
  const today = getTodayKey();

  return odEvents.filter((event) => {
    const eventEndDate = event.endDate ?? event.date;
    const hasPendingSubjects = event.subjects.some((subject) => !subject.registered);

    return hasPendingSubjects && eventEndDate <= today;
  });
};
