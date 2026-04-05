import {
  clearAllStorage,
  exportBackup,
  loadDailyLogs,
  loadOnboarded,
  loadStudentBundle,
  loadSubjects,
  restoreBackup,
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
});
