import { getTodayKey } from "@/lib/utils";
import type {
  AttendanceSummary,
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

export const applyOfficialSync = ({
  officialInputs,
  summaries,
  odEvents,
  syncedAt = new Date().toISOString(),
}: {
  officialInputs: OfficialSubjectInput[];
  summaries: AttendanceSummary[];
  odEvents: ODEvent[];
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
  });

  return {
    reports,
    odEvents: updatedEvents,
    lastSyncedAt: syncedAt,
    officialSyncSnapshotBySubject,
  };
};
