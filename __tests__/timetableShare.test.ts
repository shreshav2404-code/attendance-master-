import { DEFAULT_HOUR_SLOTS, DEFAULT_WORKING_DAYS } from "@/lib/constants";
import {
  TIMETABLE_SHARE_PREFIX,
  buildTimetableImportPlan,
  decodeTimetableShare,
  encodeTimetableShare,
} from "@/lib/timetableShare";
import type { Subject, TimetableSlot } from "@/types";

const subjects: Subject[] = [
  {
    id: "subject_ml",
    code: "CAI2500",
    name: "Machine Learning",
    shortName: "CAI2500",
    isLab: false,
    color: "#1a5fa8",
  },
  {
    id: "subject_dbms_lab",
    code: "CAI2510",
    name: "DBMS Lab",
    shortName: "CAI2510",
    isLab: true,
    color: "#059669",
  },
];

const timetable: TimetableSlot[] = [
  { id: "Mon_1", day: "Mon", hour: 1, subjectId: "subject_ml", isDouble: false, isLab: false },
  { id: "Mon_2", day: "Mon", hour: 2, subjectId: "subject_ml", isDouble: true, isLab: false },
  { id: "Tue_3", day: "Tue", hour: 3, subjectId: "subject_dbms_lab", isDouble: false, isLab: true },
];

const encodeSample = (): string =>
  encodeTimetableShare({
    subjects,
    timetable,
    hourSlots: DEFAULT_HOUR_SLOTS,
    workingDays: DEFAULT_WORKING_DAYS,
  });

describe("timetableShare encode/decode", () => {
  it("produces a prefixed code and round-trips the payload", () => {
    const code = encodeSample();
    expect(code.startsWith(TIMETABLE_SHARE_PREFIX)).toBe(true);

    const payload = decodeTimetableShare(code);
    expect(payload.version).toBe(1);
    expect(payload.subjects).toHaveLength(2);
    expect(payload.slots).toHaveLength(3);
    expect(payload.hourSlots).toHaveLength(DEFAULT_HOUR_SLOTS.length);
    expect(payload.workingDays).toEqual(DEFAULT_WORKING_DAYS);
  });

  it("only ships subjects referenced by a slot", () => {
    const withOrphan = encodeTimetableShare({
      subjects: [
        ...subjects,
        {
          id: "subject_unused",
          code: "UNUSED",
          name: "Unused",
          shortName: "UNUSED",
          isLab: false,
          color: "#dc2626",
        },
      ],
      timetable,
      hourSlots: DEFAULT_HOUR_SLOTS,
      workingDays: DEFAULT_WORKING_DAYS,
    });
    const payload = decodeTimetableShare(withOrphan);
    expect(payload.subjects.map((subject) => subject.code)).not.toContain("UNUSED");
  });

  it("decodes a bare code without the prefix", () => {
    const code = encodeSample();
    const bare = code.slice(TIMETABLE_SHARE_PREFIX.length);
    expect(() => decodeTimetableShare(bare)).not.toThrow();
  });

  it("rejects an empty or garbage code", () => {
    expect(() => decodeTimetableShare("")).toThrow();
    expect(() => decodeTimetableShare("not a real code!!!")).toThrow();
  });
});

describe("buildTimetableImportPlan", () => {
  it("matches existing subjects by code and does not duplicate them", () => {
    const payload = decodeTimetableShare(encodeSample());
    const plan = buildTimetableImportPlan({ payload, existingSubjects: subjects });

    expect(plan.matchedCount).toBe(2);
    expect(plan.createdCount).toBe(0);
    expect(plan.createdSubjects).toHaveLength(0);
    expect(plan.slotCount).toBe(3);
    expect(plan.droppedSlotCount).toBe(0);

    const monDouble = plan.timetable.find((slot) => slot.id === "Mon_2");
    expect(monDouble?.subjectId).toBe("subject_ml");
    expect(monDouble?.isDouble).toBe(true);

    const lab = plan.timetable.find((slot) => slot.id === "Tue_3");
    expect(lab?.subjectId).toBe("subject_dbms_lab");
    expect(lab?.isLab).toBe(true);
  });

  it("creates new subjects when the importer has none", () => {
    const payload = decodeTimetableShare(encodeSample());
    const plan = buildTimetableImportPlan({ payload, existingSubjects: [] });

    expect(plan.matchedCount).toBe(0);
    expect(plan.createdCount).toBe(2);
    expect(plan.createdSubjects).toHaveLength(2);
    expect(plan.slotCount).toBe(3);

    // Every slot must resolve to one of the freshly-created subject ids.
    const createdIds = new Set(plan.createdSubjects.map((subject) => subject.id));
    plan.timetable.forEach((slot) => {
      expect(createdIds.has(slot.subjectId)).toBe(true);
    });
  });

  it("matches by name when codes differ", () => {
    const payload = decodeTimetableShare(encodeSample());
    const importerSubjects: Subject[] = [
      {
        id: "local_ml",
        code: "DIFFERENT",
        name: "Machine Learning",
        shortName: "ML",
        isLab: false,
        color: "#7c3aed",
      },
    ];
    const plan = buildTimetableImportPlan({
      payload,
      existingSubjects: importerSubjects,
    });

    expect(plan.matchedCount).toBe(1);
    expect(plan.createdCount).toBe(1);
    const mlSlot = plan.timetable.find((slot) => slot.id === "Mon_1");
    expect(mlSlot?.subjectId).toBe("local_ml");
  });
});
