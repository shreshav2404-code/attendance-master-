import { getTodayKey } from "@/lib/utils";
import type {
  AttendanceSummary,
  DailyLog,
  ODEvent,
  OfficialSyncSnapshotBySubject,
  OfficialSubjectInput,
  SyncApplicationResult,
  SyncReport,
} from "@/types";

export const buildSyncReports = ({
  officialInputs,
  summaries,
}: {
  officialInputs: OfficialSubjectInput[];
  summaries: AttendanceSummary[];
}): SyncReport[] =>
  officialInputs.map((input) => {
    const matchingSummary =
      summaries.find((summary) => summary.subjectId === input.subjectId) ??
      ({
        subjectId: input.subjectId,
        TH: 0,
        AH: 0,
        DL: 0,
      } as Pick<AttendanceSummary, "subjectId" | "TH" | "AH" | "DL">);

    return {
      subjectId: input.subjectId,
      myTH: matchingSummary.TH,
      officialTH: input.officialTH,
      myAH: matchingSummary.AH,
      officialAH: input.officialAH,
      officialDL: input.officialDL,
      thDiff: input.officialTH - matchingSummary.TH,
      ahDiff: input.officialAH - matchingSummary.AH,
      newlyRegisteredOD: Math.max(0, input.officialDL - matchingSummary.DL),
    };
  });

const registerHoursInEvent = ({
  event,
  subjectId,
  hoursToRegister,
  syncedAt,
}: {
  event: ODEvent;
  subjectId: string;
  hoursToRegister: number;
  syncedAt: string;
}): { event: ODEvent; remainingHours: number } => {
  let remainingHours = hoursToRegister;
  const nextSubjects = event.subjects.flatMap((subject) => {
    if (
      remainingHours === 0 ||
      subject.subjectId !== subjectId ||
      subject.registered
    ) {
      return [subject];
    }

    if (subject.hours <= remainingHours) {
      remainingHours -= subject.hours;
      return [
        {
          ...subject,
          registered: true,
          registeredAt: syncedAt,
        },
      ];
    }

    const registeredChunk = {
      subjectId: subject.subjectId,
      hours: remainingHours,
      registered: true,
      registeredAt: syncedAt,
    };
    const pendingChunk = {
      ...subject,
      hours: subject.hours - remainingHours,
    };

    remainingHours = 0;
    return [registeredChunk, pendingChunk];
  });

  return {
    event: {
      ...event,
      subjects: nextSubjects,
    },
    remainingHours,
  };
};

// Registered hours left over after the subject's OD events go to OD entries
// that have no event (marked "OD without an event" on the Today screen),
// oldest first, so they stop counting as pending.
const registerHoursInLooseODLogs = ({
  dailyLogs,
  eventIds,
  subjectId,
  hoursToRegister,
  syncedAt,
}: {
  dailyLogs: DailyLog[];
  eventIds: Set<string>;
  subjectId: string;
  hoursToRegister: number;
  syncedAt: string;
}): { dailyLogs: DailyLog[]; remainingHours: number } => {
  const today = getTodayKey();
  const candidateIds = dailyLogs
    .filter(
      (log) =>
        log.subjectId === subjectId &&
        log.status === "od" &&
        (!log.odEventId || !eventIds.has(log.odEventId)) &&
        (log.registeredHours ?? 0) < log.hours &&
        log.date <= today,
    )
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((log) => log.id);
  let remainingHours = hoursToRegister;
  const registeredById = new Map<string, number>();

  candidateIds.forEach((id) => {
    const log = dailyLogs.find((item) => item.id === id);

    if (!log || remainingHours === 0) {
      return;
    }

    const alreadyRegistered = log.registeredHours ?? 0;
    const hours = Math.min(log.hours - alreadyRegistered, remainingHours);
    registeredById.set(id, alreadyRegistered + hours);
    remainingHours -= hours;
  });

  return {
    dailyLogs: dailyLogs.map((log) =>
      registeredById.has(log.id)
        ? { ...log, registeredHours: registeredById.get(log.id), registeredAt: syncedAt }
        : log,
    ),
    remainingHours,
  };
};

export const applyOfficialSync = ({
  officialInputs,
  summaries,
  odEvents,
  dailyLogs = [],
  syncedAt = new Date().toISOString(),
}: {
  officialInputs: OfficialSubjectInput[];
  summaries: AttendanceSummary[];
  odEvents: ODEvent[];
  dailyLogs?: DailyLog[];
  syncedAt?: string;
}): SyncApplicationResult => {
  const reports = buildSyncReports({ officialInputs, summaries });
  const officialSyncSnapshotBySubject: OfficialSyncSnapshotBySubject =
    reports.reduce<OfficialSyncSnapshotBySubject>(
      (accumulator, report) => ({
        ...accumulator,
        [report.subjectId]: {
          TH: Math.max(0, report.officialTH),
          AH: Math.max(0, report.officialAH),
          DL: Math.max(0, report.officialDL),
          syncedAt,
        },
      }),
      {},
    );
  let updatedEvents = [...odEvents];
  let updatedLogs = dailyLogs;
  const eventIds = new Set(odEvents.map((event) => event.id));

  reports.forEach((report) => {
    if (report.newlyRegisteredOD === 0) {
      return;
    }

    let remainingHours = report.newlyRegisteredOD;
    updatedEvents = updatedEvents.map((event) => {
      if (remainingHours === 0) {
        return event;
      }

      const eventEndDate = event.endDate ?? event.date;

      if (eventEndDate > getTodayKey()) {
        return event;
      }

      const result = registerHoursInEvent({
        event,
        subjectId: report.subjectId,
        hoursToRegister: remainingHours,
        syncedAt,
      });

      remainingHours = result.remainingHours;
      return result.event;
    });

    if (remainingHours > 0) {
      const result = registerHoursInLooseODLogs({
        dailyLogs: updatedLogs,
        eventIds,
        subjectId: report.subjectId,
        hoursToRegister: remainingHours,
        syncedAt,
      });
      updatedLogs = result.dailyLogs;
    }
  });

  return {
    reports,
    odEvents: updatedEvents,
    dailyLogs: updatedLogs,
    lastSyncedAt: syncedAt,
    officialSyncSnapshotBySubject,
  };
};
