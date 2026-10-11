import {
  clearAllStorage,
  exportBackup,
  loadHourSlotBundle,
  loadDailyLogs,
  loadOnboarded,
  loadStudentBundle,
  loadSubjects,
  restoreBackup,
  saveHourSlotBundle,
  saveDailyLogs,
  saveOnboarded,
  saveStudentBundle,
  saveSubjects,
} from "@/lib/storage";

describe("storage", () => {
  beforeEach(async () => {
    await clearAllStorage();
  });

  it("saves and loads student bundle", async () => {
    await saveStudentBundle({
      student: {
        id: "student-1",
        name: "Asha",
        rollNo: "22CAI001",
        batch: "2024CAI02",
        department: "AI",
        collegeName: "AttendX University",
        term: "S4",
        targetPercentage: 75,
        createdAt: "2026-04-01T00:00:00.000Z",
      },
      notificationSettings: {
        dailyReminderEnabled: true,
        dailyReminderTime: "20:30",
        lowAttendanceAlertsEnabled: true,
        odReminderEnabled: true,
        lowAttendanceThreshold: 75,
      },
      examWeek: { enabled: false },
      lastSyncedAt: "2026-04-05T00:00:00.000Z",
    });

    const studentBundle = await loadStudentBundle();
    expect(studentBundle.student?.name).toBe("Asha");
    expect(studentBundle.lastSyncedAt).toBe("2026-04-05T00:00:00.000Z");
  });

  it("exports and restores the full backup payload", async () => {
    await saveSubjects([
      {
        id: "ml",
        code: "CAI2500",
        name: "Machine Learning",
        shortName: "ML",
        isLab: false,
        color: "#1a5fa8",
      },
    ]);
    await saveDailyLogs([
      {
        id: "1",
        date: "2026-04-01",
        subjectId: "ml",
        status: "present",
        hours: 1,
        createdAt: "2026-04-01T10:00:00.000Z",
      },
    ]);
    await saveOnboarded(true);

    const backup = await exportBackup();
    await clearAllStorage();
    await restoreBackup(backup);

    const restoredSubjects = await loadSubjects();
    const restoredLogs = await loadDailyLogs();
    const restoredOnboarded = await loadOnboarded();

    expect(restoredSubjects).toHaveLength(1);
    expect(restoredLogs).toHaveLength(1);
    expect(restoredOnboarded).toBe(true);
  });

  it("clearAllStorage resets values to defaults", async () => {
    await saveOnboarded(true);
    await clearAllStorage();

    expect(await loadOnboarded()).toBe(false);
    expect(await loadSubjects()).toEqual([]);
  });

  it("persists working date overrides in hour slot bundle", async () => {
    await saveHourSlotBundle({
      hourSlots: [
        { hour: 1, startTime: "09:00", endTime: "10:00", isBreak: false, isLunch: false },
      ],
      workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      workingDateOverrides: {
        "2026-04-04": true,
      },
    });

    const hourSlotBundle = await loadHourSlotBundle();
    expect(hourSlotBundle.workingDateOverrides["2026-04-04"]).toBe(true);
  });
});

describe("parseBackup", () => {
  const { parseBackup } = jest.requireActual("@/lib/storage") as typeof import("@/lib/storage");
  const valid = {
    studentBundle: { student: null, notificationSettings: {}, examWeek: { enabled: false } },
    hourSlotBundle: { hourSlots: [], workingDays: ["Mon"], workingDateOverrides: {} },
    subjects: [],
    timetable: [],
    dailyLogs: [],
    odEvents: [],
    onboarded: true,
  };

  it("accepts a backup exported by the app", () => {
    expect(parseBackup(JSON.stringify(valid))).toEqual(valid);
  });

  it("rejects text that isn't JSON", () => {
    expect(() => parseBackup("not json")).toThrow("not JSON");
  });

  it("rejects JSON that is missing parts of a backup", () => {
    const { dailyLogs: _dailyLogs, ...missingLogs } = valid;
    expect(() => parseBackup(JSON.stringify(missingLogs))).toThrow("nothing was restored");
    expect(() => parseBackup("[]")).toThrow("isn't a valid AttendX backup");
  });
});
