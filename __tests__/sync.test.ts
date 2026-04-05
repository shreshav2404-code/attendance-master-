import { applyOfficialSync, buildSyncReports } from "@/lib/sync";
import type { AttendanceSummary, ODEvent, OfficialSubjectInput } from "@/types";

const summaries: AttendanceSummary[] = [
  {
    subjectId: "ml",
    TH: 10,
    AH: 7,
    DL: 1,
    pendingOD: 1,
    AH_DL: 8,
    AH_allOD: 9,
    percentBefore: 70,
    percentAfterDL: 80,
    percentProjected: 90,
    hoursNeeded: 0,
    canRecover: true,
    isSafe: true,
    status: "excellent",
  },
];

const officialInputs: OfficialSubjectInput[] = [
  {
    subjectId: "ml",
    officialTH: 11,
    officialAH: 8,
    officialDL: 2,
  },
];

const odEvents: ODEvent[] = [
  {
    id: "od-1",
    name: "HackX",
    date: "2020-01-01",
    reason: "Hackathon finals",
    type: "hackathon",
    createdAt: "2020-01-01T00:00:00.000Z",
    subjects: [
      {
        subjectId: "ml",
        hours: 2,
        registered: false,
      },
    ],
  },
];

describe("sync", () => {
  it("buildSyncReports compares official and local numbers", () => {
    const reports = buildSyncReports({
      officialInputs,
      summaries,
    });

    expect(reports[0]).toEqual(
      expect.objectContaining({
        subjectId: "ml",
        thDiff: 1,
        ahDiff: 1,
        newlyRegisteredOD: 1,
      }),
    );
  });

  it("applyOfficialSync marks newly registered OD hours", () => {
    const result = applyOfficialSync({
      officialInputs,
      summaries,
      odEvents,
      syncedAt: "2026-04-05T00:00:00.000Z",
    });

    expect(result.reports[0]?.newlyRegisteredOD).toBe(1);
    expect(result.odEvents[0]?.subjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          subjectId: "ml",
          hours: 1,
          registered: true,
          registeredAt: "2026-04-05T00:00:00.000Z",
        }),
        expect.objectContaining({
          subjectId: "ml",
          hours: 1,
          registered: false,
        }),
      ]),
    );
  });
});
