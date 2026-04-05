import {
  buildODTemplateFromTimetable,
  buildWeeklyTrend,
  calculateAttendanceSummaries,
  calculateAttendanceSummary,
  calculateHoursNeeded,
  calculateOverallMetrics,
  calculateSkipSimulations,
  getAttendanceStatus,
  getODPendingEvents,
  resolveClassHours,
  simulateSkipImpact,
} from "@/lib/calculations";
import type { DailyLog, ODEvent, Student, Subject, TimetableSlot } from "@/types";

const student: Student = {
  id: "student-1",
  name: "Asha",
  rollNo: "22CAI001",
  batch: "2024CAI02",
  department: "AI",
  collegeName: "AttendX University",
  term: "S4",
  targetPercentage: 75,
  createdAt: "2026-04-01T00:00:00.000Z",
};

const subjects: Subject[] = [
  {
    id: "ml",
    code: "CAI2500",
    name: "Machine Learning",
    shortName: "ML",
    isLab: false,
    color: "#1a5fa8",
  },
  {
    id: "db",
    code: "CAI2501",
    name: "DBMS Lab",
    shortName: "DBL",
    isLab: true,
    color: "#7c3aed",
  },
];

const logs: DailyLog[] = [
  {
    id: "1",
    date: "2026-04-01",
    subjectId: "ml",
    status: "present",
    hours: 1,
    createdAt: "2026-04-01T10:00:00.000Z",
  },
  {
    id: "2",
    date: "2026-04-02",
    subjectId: "ml",
    status: "absent",
    hours: 1,
    createdAt: "2026-04-02T10:00:00.000Z",
  },
  {
    id: "3",
    date: "2026-04-03",
    subjectId: "ml",
    status: "od",
    hours: 1,
    odEventId: "od-1",
    createdAt: "2026-04-03T10:00:00.000Z",
  },
  {
    id: "4",
    date: "2026-04-04",
    subjectId: "ml",
    status: "suspended",
    hours: 1,
    createdAt: "2026-04-04T10:00:00.000Z",
  },
  {
    id: "5",
    date: "2026-04-01",
    subjectId: "db",
    status: "present",
    hours: 2,
    createdAt: "2026-04-01T12:00:00.000Z",
  },
];

const odEvents: ODEvent[] = [
  {
    id: "od-1",
    name: "HackX",
    date: "2026-04-03",
    reason: "Hackathon finals",
    type: "hackathon",
    createdAt: "2026-04-03T08:00:00.000Z",
    subjects: [
      {
        subjectId: "ml",
        hours: 1,
        registered: true,
        registeredAt: "2026-04-05T00:00:00.000Z",
      },
    ],
  },
  {
    id: "od-2",
    name: "Seminar",
    date: "2020-01-01",
    reason: "Guest lecture",
    type: "seminar",
    createdAt: "2020-01-01T00:00:00.000Z",
    subjects: [
      {
        subjectId: "db",
        hours: 2,
        registered: false,
      },
    ],
  },
];

describe("calculations", () => {
  it("resolveClassHours returns 2 for labs and doubles", () => {
    expect(resolveClassHours({ isDouble: false, isLab: true })).toBe(2);
    expect(resolveClassHours({ isDouble: true, isLab: false })).toBe(2);
    expect(resolveClassHours({ isDouble: false, isLab: false })).toBe(1);
  });

  it("calculateHoursNeeded follows the target formula", () => {
    expect(
      calculateHoursNeeded({
        targetPercentage: 75,
        TH: 10,
        AH: 6,
        DL: 0,
        pendingOD: 0,
      }),
    ).toBe(6);
    expect(
      calculateHoursNeeded({
        targetPercentage: 75,
        TH: 10,
        AH: 8,
        DL: 1,
        pendingOD: 0,
      }),
    ).toBe(0);
  });

  it("getAttendanceStatus maps projected percentages correctly", () => {
    expect(getAttendanceStatus(68.99)).toBe("danger");
    expect(getAttendanceStatus(74.5)).toBe("warning");
    expect(getAttendanceStatus(75)).toBe("exact");
    expect(getAttendanceStatus(79.5)).toBe("safe");
    expect(getAttendanceStatus(82)).toBe("excellent");
  });

  it("calculateAttendanceSummary handles suspended and OD rules", () => {
    const summary = calculateAttendanceSummary({
      student,
      subject: subjects[0]!,
      logs,
      odEvents,
    });

    expect(summary.TH).toBe(3);
    expect(summary.AH).toBe(1);
    expect(summary.DL).toBe(1);
    expect(summary.pendingOD).toBe(0);
    expect(summary.percentBefore).toBe(33.33);
    expect(summary.percentAfterDL).toBe(66.67);
    expect(summary.percentProjected).toBe(66.67);
  });

  it("calculateAttendanceSummaries builds one summary per subject", () => {
    const summaries = calculateAttendanceSummaries({
      student,
      subjects,
      logs,
      odEvents,
    });

    expect(summaries).toHaveLength(2);
    expect(summaries[1]?.TH).toBe(2);
    expect(summaries[1]?.AH).toBe(2);
  });

  it("calculateOverallMetrics aggregates summary totals", () => {
    const summaries = calculateAttendanceSummaries({
      student,
      subjects,
      logs,
      odEvents,
    });
    const overall = calculateOverallMetrics({
      summaries,
      targetPercentage: student.targetPercentage,
    });

    expect(overall.TH).toBe(5);
    expect(overall.AH).toBe(3);
    expect(overall.DL).toBe(1);
    expect(overall.percentProjected).toBe(80);
  });

  it("simulateSkipImpact returns the projected drop after skipping", () => {
    const summary = calculateAttendanceSummary({
      student,
      subject: subjects[0]!,
      logs,
      odEvents,
    });

    const simulation = simulateSkipImpact({
      summary,
      hoursToday: 1,
      subjectName: "ML",
    });

    expect(simulation.projectedIfSkipped).toBe(50);
    expect(simulation.diff).toBe(-16.67);
  });

  it("calculateSkipSimulations builds simulations only for today's subjects", () => {
    const summaries = calculateAttendanceSummaries({
      student,
      subjects,
      logs,
      odEvents,
    });
    const slotsToday: TimetableSlot[] = [
      {
        id: "mon_1",
        day: "Mon",
        hour: 1,
        subjectId: "ml",
        isDouble: false,
        isLab: false,
      },
      {
        id: "mon_2",
        day: "Mon",
        hour: 2,
        subjectId: "db",
        isDouble: false,
        isLab: true,
      },
    ];

    const simulations = calculateSkipSimulations({
      summaries,
      slotsToday,
      subjects,
    });

    expect(simulations).toHaveLength(2);
    expect(simulations.find((simulation) => simulation.subjectId === "db")?.hoursToday).toBe(2);
  });

  it("buildWeeklyTrend returns cumulative trend data", () => {
    const trend = buildWeeklyTrend({
      student,
      subjects,
      logs,
      odEvents,
    });

    expect(trend.length).toBeGreaterThan(0);
    expect(trend[trend.length - 1]?.projected).toBe(80);
  });

  it("buildODTemplateFromTimetable auto-fills subjects and logs", () => {
    const timetable: TimetableSlot[] = [
      {
        id: "fri_1",
        day: "Fri",
        hour: 1,
        subjectId: "ml",
        isDouble: false,
        isLab: false,
      },
      {
        id: "fri_2",
        day: "Fri",
        hour: 2,
        subjectId: "db",
        isDouble: false,
        isLab: true,
      },
    ];

    const template = buildODTemplateFromTimetable({
      timetable,
      startDate: "2026-04-03",
      endDate: "2026-04-03",
      odEventId: "od-x",
    });

    expect(template.subjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ subjectId: "ml", hours: 1 }),
        expect.objectContaining({ subjectId: "db", hours: 2 }),
      ]),
    );
    expect(template.logs).toHaveLength(2);
  });

  it("getODPendingEvents returns only past events with pending subjects", () => {
    const pendingEvents = getODPendingEvents(odEvents);

    expect(pendingEvents).toHaveLength(1);
    expect(pendingEvents[0]?.id).toBe("od-2");
  });
});
