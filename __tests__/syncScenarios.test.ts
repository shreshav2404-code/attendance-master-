import { calculateAttendanceSummary } from "@/lib/calculations";
import { applyOfficialSync } from "@/lib/sync";
import type { DailyLog, ODEvent, OfficialSyncSnapshotBySubject, Student, Subject } from "@/types";

const student: Student = {
  id: "student-1",
  name: "Test",
  rollNo: "1",
  batch: "2024",
  department: "CSE",
  collegeName: "College",
  term: "Odd",
  targetPercentage: 75,
  createdAt: "2026-10-01T00:00:00.000Z",
};

const physics: Subject = {
  id: "phy",
  code: "PH101",
  name: "Physics",
  shortName: "PHY",
  isLab: false,
  color: "#7c3aed",
};

const T0 = "2026-10-05T09:00:00.000Z"; // entries made before the sync
const T1 = "2026-10-06T18:00:00.000Z"; // the sync
const T2 = "2026-10-07T09:00:00.000Z"; // entries made after the sync

const log = (
  id: string,
  date: string,
  status: DailyLog["status"],
  createdAt: string,
  odEventId?: string,
): DailyLog => ({ id, date, subjectId: "phy", status, hours: 1, createdAt, odEventId });

const pendingEvent = (createdAt: string): ODEvent => ({
  id: "od-1",
  name: "Hackathon",
  date: "2026-10-05",
  reason: "r",
  type: "hackathon",
  subjects: [{ subjectId: "phy", hours: 1, registered: false }],
  createdAt,
});

// Three classes attended and one class on OD (not yet registered by the college).
const preSyncLogs = [
  log("a", "2026-10-02", "present", T0),
  log("b", "2026-10-03", "present", T0),
  log("c", "2026-10-04", "present", T0),
  log("d", "2026-10-05", "od", T0, "od-1"),
];

const summarise = (
  logs: DailyLog[],
  odEvents: ODEvent[],
  snapshot?: OfficialSyncSnapshotBySubject,
) =>
  calculateAttendanceSummary({
    student,
    subject: physics,
    logs,
    odEvents,
    officialSyncSnapshotBySubject: snapshot,
  });

const sync = (
  logs: DailyLog[],
  odEvents: ODEvent[],
  official: { TH: number; AH: number; DL: number },
  syncedAt: string,
  snapshot?: OfficialSyncSnapshotBySubject,
) =>
  applyOfficialSync({
    officialInputs: [
      { subjectId: "phy", officialTH: official.TH, officialAH: official.AH, officialDL: official.DL },
    ],
    summaries: [summarise(logs, odEvents, snapshot)],
    odEvents,
    syncedAt,
  });

describe("official sync scenarios", () => {
  it("before any sync, pending OD counts towards the projected percentage", () => {
    const summary = summarise(preSyncLogs, [pendingEvent(T0)]);

    expect(summary).toMatchObject({ TH: 4, AH: 3, DL: 0, pendingOD: 1, percentProjected: 100 });
  });

  it("keeps pending OD after a sync where the college hasn't registered it yet", () => {
    const events = [pendingEvent(T0)];
    const result = sync(preSyncLogs, events, { TH: 4, AH: 3, DL: 0 }, T1);
    const after = summarise(preSyncLogs, result.odEvents, result.officialSyncSnapshotBySubject);

    expect(result.odEvents[0]?.subjects[0]?.registered).toBe(false);
    expect(after).toMatchObject({ TH: 4, AH: 3, DL: 0, pendingOD: 1, percentProjected: 100 });
  });

  it("moves OD from pending to official when the report's DL goes up", () => {
    const events = [pendingEvent(T0)];
    const result = sync(preSyncLogs, events, { TH: 4, AH: 3, DL: 1 }, T1);
    const after = summarise(preSyncLogs, result.odEvents, result.officialSyncSnapshotBySubject);

    expect(result.reports[0]?.newlyRegisteredOD).toBe(1);
    expect(result.odEvents[0]?.subjects[0]?.registered).toBe(true);
    expect(after).toMatchObject({ TH: 4, AH: 3, DL: 1, pendingOD: 0, percentAfterDL: 100 });
  });

  it("syncing twice with the same report changes nothing", () => {
    const first = sync(preSyncLogs, [pendingEvent(T0)], { TH: 4, AH: 3, DL: 1 }, T1);
    const firstSummary = summarise(preSyncLogs, first.odEvents, first.officialSyncSnapshotBySubject);
    const second = sync(
      preSyncLogs,
      first.odEvents,
      { TH: 4, AH: 3, DL: 1 },
      T2,
      first.officialSyncSnapshotBySubject,
    );
    const secondSummary = summarise(preSyncLogs, second.odEvents, second.officialSyncSnapshotBySubject);

    expect(second.reports[0]?.newlyRegisteredOD).toBe(0);
    expect(secondSummary).toEqual(firstSummary);
  });

  it("adds classes marked after the sync on top of the official numbers", () => {
    const result = sync(preSyncLogs, [pendingEvent(T0)], { TH: 4, AH: 3, DL: 1 }, T1);
    const logs = [
      ...preSyncLogs,
      log("e", "2026-10-07", "present", T2),
      log("f", "2026-10-08", "absent", T2),
    ];
    const after = summarise(logs, result.odEvents, result.officialSyncSnapshotBySubject);

    expect(after).toMatchObject({ TH: 6, AH: 4, DL: 1, pendingOD: 0 });
  });

  it("counts an OD marked after the sync without an event as pending", () => {
    const result = sync(preSyncLogs, [pendingEvent(T0)], { TH: 4, AH: 3, DL: 1 }, T1);
    const logs = [...preSyncLogs, log("g", "2026-10-07", "od", T2)];
    const after = summarise(logs, result.odEvents, result.officialSyncSnapshotBySubject);

    expect(after).toMatchObject({ TH: 5, AH: 3, DL: 1, pendingOD: 1 });
  });

  it("counts a new OD event created after the sync as pending, then official once registered", () => {
    const first = sync(preSyncLogs, [pendingEvent(T0)], { TH: 4, AH: 3, DL: 1 }, T1);
    const laterEvent: ODEvent = {
      ...pendingEvent(T2),
      id: "od-2",
      date: "2026-10-07",
    };
    const events = [...first.odEvents, laterEvent];
    const logs = [...preSyncLogs, log("h", "2026-10-07", "od", T2, "od-2")];
    const pending = summarise(logs, events, first.officialSyncSnapshotBySubject);

    expect(pending).toMatchObject({ TH: 5, DL: 1, pendingOD: 1 });

    const second = sync(logs, events, { TH: 5, AH: 3, DL: 2 }, "2026-10-08T18:00:00.000Z", first.officialSyncSnapshotBySubject);
    const registered = summarise(logs, second.odEvents, second.officialSyncSnapshotBySubject);

    expect(second.reports[0]?.newlyRegisteredOD).toBe(1);
    expect(registered).toMatchObject({ TH: 5, DL: 2, pendingOD: 0 });
  });
});

describe("OD marked without an event", () => {
  const looseLogs = [
    log("a", "2026-10-02", "present", T0),
    log("b", "2026-10-03", "present", T0),
    log("c", "2026-10-04", "present", T0),
    log("d", "2026-10-05", "od", T0),
  ];

  it("stays pending through a sync until the report registers it", () => {
    const result = applyOfficialSync({
      officialInputs: [{ subjectId: "phy", officialTH: 4, officialAH: 3, officialDL: 0 }],
      summaries: [summarise(looseLogs, [])],
      odEvents: [],
      dailyLogs: looseLogs,
      syncedAt: T1,
    });

    expect(result.dailyLogs).toBe(looseLogs);
    expect(summarise(result.dailyLogs, [], result.officialSyncSnapshotBySubject)).toMatchObject({
      DL: 0,
      pendingOD: 1,
      percentProjected: 100,
    });
  });

  it("is registered by a sync whose DL covers it, and isn't counted twice", () => {
    const result = applyOfficialSync({
      officialInputs: [{ subjectId: "phy", officialTH: 4, officialAH: 3, officialDL: 1 }],
      summaries: [summarise(looseLogs, [])],
      odEvents: [],
      dailyLogs: looseLogs,
      syncedAt: T1,
    });

    expect(result.dailyLogs.find((item) => item.id === "d")).toMatchObject({
      registeredHours: 1,
      registeredAt: T1,
    });
    expect(summarise(result.dailyLogs, [], result.officialSyncSnapshotBySubject)).toMatchObject({
      DL: 1,
      pendingOD: 0,
      percentProjected: 100,
    });
  });
});

describe("entries added after a sync for earlier days", () => {
  it("count as pending OD without adding the class to TH again", () => {
    const result = sync(preSyncLogs, [pendingEvent(T0)], { TH: 4, AH: 3, DL: 1 }, T1);
    // Imported after the sync, but for 2026-10-04, a day the report covered.
    const backdated: ODEvent = {
      ...pendingEvent(T2),
      id: "od-import",
      date: "2026-10-04",
      source: "pending-import",
    };
    const logs = [...preSyncLogs, log("i", "2026-10-04", "od", T2, "od-import")];
    const after = summarise(logs, [...result.odEvents, backdated], result.officialSyncSnapshotBySubject);

    expect(after).toMatchObject({ TH: 4, AH: 3, DL: 1, pendingOD: 1 });
  });

  it("still add classes from the sync day onward", () => {
    const result = sync(preSyncLogs, [pendingEvent(T0)], { TH: 4, AH: 3, DL: 1 }, T1);
    const logs = [...preSyncLogs, log("j", "2026-10-06", "present", T2)];
    const after = summarise(logs, result.odEvents, result.officialSyncSnapshotBySubject);

    expect(after).toMatchObject({ TH: 5, AH: 4 });
  });
});
