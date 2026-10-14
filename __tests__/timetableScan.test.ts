import {
  buildTimetableScanPlan,
  parseTimetableScan,
  type ScanLine,
  type ScanOcrResult,
} from "@/lib/timetableScan";
import { DEFAULT_HOUR_SLOTS } from "@/lib/constants";
import type { HourSlot, Subject, TimetableSlot } from "@/types";

const subjects: Subject[] = [
  { id: "math", code: "MA101", name: "Mathematics", shortName: "MATH", isLab: false, color: "#111" },
  { id: "phy", code: "PH101", name: "Physics", shortName: "PHY", isLab: false, color: "#222" },
  { id: "cslab", code: "CS101L", name: "Programming Lab", shortName: "CSLAB", isLab: true, color: "#333" },
  { id: "chem", code: "CH101", name: "Chemistry", shortName: "CHEM", isLab: false, color: "#444" },
  { id: "ds", code: "CS201", name: "Data Structures", shortName: "DS", isLab: false, color: "#555" },
];

const hourSlots: HourSlot[] = [
  ["08:50", "09:45"],
  ["09:45", "10:40"],
  ["10:50", "11:45"],
  ["11:45", "12:35"],
  ["12:35", "13:25"],
  ["13:25", "14:20"],
].map(([startTime, endTime], index) => ({
  hour: index + 1,
  startTime: startTime ?? "",
  endTime: endTime ?? "",
  isBreak: false,
  isLunch: false,
}));

type CellSpec = string | { text: string; span: number } | null;

interface GridSpec {
  header: (string | null)[];
  rows: { day: string | null; cells: CellSpec[] }[];
  angleDeg?: number;
  transpose?: boolean;
}

const TEXT_HEIGHT = 24;
const CHAR_WIDTH = TEXT_HEIGHT * 0.55;
const SPACE = TEXT_HEIGHT * 0.35;

/** Lays a timetable out the way ML Kit reports it: words with boxes, grouped in lines. */
const makeOcr = ({ header, rows, angleDeg = 0, transpose = false }: GridSpec): ScanOcrResult => {
  const columnStep = transpose ? 90 : 175;
  const rowStep = transpose ? 260 : 95;
  const firstColumn = transpose ? 140 : 190;
  const firstRow = transpose ? 330 : 150;
  const angle = (angleDeg * Math.PI) / 180;
  const rotate = (x: number, y: number) => ({
    x: x * Math.cos(angle) - y * Math.sin(angle),
    y: x * Math.sin(angle) + y * Math.cos(angle),
  });
  const box = (left: number, top: number, width: number, height: number) => {
    const corners = [
      rotate(left, top),
      rotate(left + width, top),
      rotate(left + width, top + height),
      rotate(left, top + height),
    ];
    const xs = corners.map((point) => point.x);
    const ys = corners.map((point) => point.y);
    return {
      frame: {
        left: Math.min(...xs),
        top: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      },
      cornerPoints: corners,
    };
  };

  const lines: ScanLine[] = [];
  // (column, row) is a grid position; row -1 is the header and column -1 the day labels.
  const place = (text: string, column: number, row: number) => {
    const along = firstColumn + column * columnStep;
    const across = firstRow + row * rowStep;
    const [cx, cy] = transpose ? [across, along] : [along, across];
    const textLines = text.split("\n");
    textLines.forEach((lineText, lineIndex) => {
      const lineY = cy + (lineIndex - (textLines.length - 1) / 2) * TEXT_HEIGHT * 1.4;
      const words = lineText.split(" ").filter(Boolean);
      const widths = words.map((word) => word.length * CHAR_WIDTH);
      const total = widths.reduce((sum, width) => sum + width, 0) + SPACE * (words.length - 1);
      let x = cx - total / 2;
      const elements = words.map((word, index) => {
        const width = widths[index] ?? 0;
        const element = { text: word, frame: box(x, lineY - TEXT_HEIGHT / 2, width, TEXT_HEIGHT).frame };
        x += width + SPACE;
        return element;
      });
      lines.push({
        text: lineText,
        elements,
        ...box(cx - total / 2, lineY - TEXT_HEIGHT / 2, total, TEXT_HEIGHT),
      });
    });
  };

  header.forEach((text, column) => {
    if (text) {
      place(text, column, -1);
    }
  });
  rows.forEach((row, rowIndex) => {
    if (row.day) {
      place(row.day, -1, rowIndex);
    }
    row.cells.forEach((cell, column) => {
      if (typeof cell === "string") {
        place(cell, column, rowIndex);
      } else if (cell) {
        place(cell.text, column + (cell.span - 1) / 2, rowIndex);
      }
    });
  });

  return { text: lines.map((line) => line.text).join("\n"), blocks: [{ text: "", lines }] };
};

const HEADER = [
  "I\n8:50 - 9:45",
  "II\n9:45 - 10:40",
  "BREAK\n10:40 - 10:50",
  "III\n10:50 - 11:45",
  "IV\n11:45 - 12:35",
  "LUNCH\n12:35 - 1:25",
  "V\n1:25 - 2:20",
];

const ROWS: GridSpec["rows"] = [
  { day: "MON", cells: ["MA101", "PHY (R-204)", null, { text: "PROGRAMMING LAB", span: 2 }, null, null, "Data Structures"] },
  { day: "TUE", cells: ["Data\nStructures", "MA1O1", null, "DBMS", "-", null, "CH101"] },
  { day: "WED", cells: ["PH101", "CHEM", null, "MATH", "DBMS", null, null] },
  { day: "THU", cells: ["CS201", "Mathematics", null, "PHY", "PHY", null, "Chemistry"] },
  { day: "FRI", cells: ["MA101", null, null, "CH101", "CS LAB", null, "CS LAB"] },
];

const summarise = (result: ReturnType<typeof parseTimetableScan>) =>
  result.cells.map(
    (cell) => `${cell.day}${cell.hour}${cell.span > 1 ? `x${cell.span}` : ""}:${cell.subjectId ?? `?${cell.label}`}`,
  );

const EXPECTED = [
  "Mon1:math",
  "Mon2:phy",
  "Mon3x2:cslab",
  "Mon6:ds",
  "Tue1:ds",
  "Tue2:math",
  "Tue3:?DBMS",
  "Tue6:chem",
  "Wed1:phy",
  "Wed2:chem",
  "Wed3:math",
  "Wed4:?DBMS",
  "Thu1:ds",
  "Thu2:math",
  "Thu3:phy",
  "Thu4:phy",
  "Thu6:chem",
  "Fri1:math",
  "Fri3:chem",
  "Fri4:cslab",
  "Fri6:cslab",
];

describe("parseTimetableScan", () => {
  it("reads a days-down-the-side timetable, skipping break and lunch columns", () => {
    const result = parseTimetableScan({
      ocr: makeOcr({ header: HEADER, rows: ROWS }),
      subjects,
      hourSlots,
    });

    expect(result.days).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
    expect(result.columnCount).toBe(5);
    // Header times match the saved timings, so the last column lands on hour 6.
    expect(result.scannedHourSlots).toBeUndefined();
    expect(summarise(result)).toEqual(EXPECTED);
    expect(result.unknownLabels).toEqual([{ key: "DBMS", label: "DBMS", count: 2, isLab: false }]);
  });

  it("handles a tilted photo", () => {
    const result = parseTimetableScan({
      ocr: makeOcr({ header: HEADER, rows: ROWS, angleDeg: 3 }),
      subjects,
      hourSlots,
    });
    expect(summarise(result)).toEqual(EXPECTED);
  });

  it("handles days across the top", () => {
    const result = parseTimetableScan({
      ocr: makeOcr({ header: HEADER, rows: ROWS, transpose: true }),
      subjects,
      hourSlots,
    });
    expect(summarise(result)).toEqual(EXPECTED);
  });

  it("puts back a day name the OCR missed", () => {
    const rows = ROWS.map((row) => (row.day === "WED" ? { ...row, day: null } : row));
    const result = parseTimetableScan({
      ocr: makeOcr({ header: HEADER, rows }),
      subjects,
      hourSlots,
    });
    expect(result.days).toContain("Wed");
    expect(summarise(result)).toEqual(EXPECTED);
  });

  it("offers the photo's timings when they differ from the saved ones", () => {
    const header = ["1\n9:00-10:00", "2\n10:00-11:00", "3\n11:15-12:15"];
    const rows = [
      { day: "Monday", cells: ["MATH", "PHY", "CHEM"] },
      { day: "Tuesday", cells: ["PHY", "CHEM", "MATH"] },
    ];
    const result = parseTimetableScan({ ocr: makeOcr({ header, rows }), subjects, hourSlots });

    expect(result.scannedHourSlots?.map((slot) => `${slot.startTime}-${slot.endTime}`)).toEqual([
      "09:00-10:00",
      "10:00-11:00",
      "11:15-12:15",
    ]);
    expect(summarise(result)).toEqual([
      "Mon1:math",
      "Mon2:phy",
      "Mon3:chem",
      "Tue1:phy",
      "Tue2:chem",
      "Tue3:math",
    ]);
  });

  it("finds columns from the cells when there is no header", () => {
    const rows = [
      { day: "Mon", cells: ["MATH", "PHY", "CHEM"] },
      { day: "Tue", cells: ["PHY", null, "MATH"] },
      { day: "Wed", cells: ["CHEM", "MATH", "PHY"] },
    ];
    const result = parseTimetableScan({ ocr: makeOcr({ header: [], rows }), subjects, hourSlots });
    expect(summarise(result)).toEqual([
      "Mon1:math",
      "Mon2:phy",
      "Mon3:chem",
      "Tue1:phy",
      "Tue3:math",
      "Wed1:chem",
      "Wed2:math",
      "Wed3:phy",
    ]);
  });

  it("explains when there are no day names", () => {
    expect(() =>
      parseTimetableScan({
        ocr: makeOcr({ header: ["1", "2"], rows: [{ day: "Hello", cells: ["MATH", "PHY"] }] }),
        subjects,
        hourSlots,
      }),
    ).toThrow(/day names/);
  });
});

describe("buildTimetableScanPlan", () => {
  const result = parseTimetableScan({
    ocr: makeOcr({ header: HEADER, rows: ROWS }),
    subjects,
    hourSlots,
  });
  const existing: TimetableSlot[] = [
    { id: "Mon_5", day: "Mon", hour: 5, subjectId: "chem", isDouble: false, isLab: false },
    { id: "Sat_1", day: "Sat", hour: 1, subjectId: "math", isDouble: false, isLab: false },
  ];
  const slotsOf = (timetable: TimetableSlot[], day: string) =>
    timetable
      .filter((slot) => slot.day === day)
      .map(
        (slot) =>
          `${slot.hour}:${slot.subjectId}${slot.isLab ? ":lab" : ""}${slot.isDouble ? ":double" : ""}`,
      );

  it("builds lab and double slots, creates unknown subjects and keeps other days", () => {
    const plan = buildTimetableScanPlan({
      result,
      subjects,
      timetable: existing,
      hourSlots,
      workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      unknownChoices: {},
      cellChoices: {},
      useScannedTimings: false,
    });

    expect(plan.createdSubjects).toHaveLength(1);
    const dbms = plan.createdSubjects[0];
    expect(dbms?.name).toBe("DBMS");
    expect(slotsOf(plan.timetable, "Mon")).toEqual(["1:math", "2:phy", "3:cslab:lab", "6:ds"]);
    expect(slotsOf(plan.timetable, "Tue")).toEqual(["1:ds", "2:math", `3:${dbms?.id}`, "6:chem"]);
    expect(slotsOf(plan.timetable, "Thu")).toEqual(["1:ds", "2:math", "3:phy:double", "6:chem"]);
    expect(slotsOf(plan.timetable, "Fri")).toEqual(["1:math", "3:chem", "4:cslab:lab", "6:cslab"]);
    expect(slotsOf(plan.timetable, "Sat")).toEqual(["1:math"]);
  });

  it("applies the user's choices", () => {
    const plan = buildTimetableScanPlan({
      result,
      subjects,
      timetable: existing,
      hourSlots,
      workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      unknownChoices: { DBMS: { kind: "subject", subjectId: "chem" } },
      cellChoices: {
        Mon_1: { kind: "free" },
        Mon_5: { kind: "subject", subjectId: "phy" },
        Wed_4: { kind: "free" },
      },
      useScannedTimings: false,
    });

    expect(plan.createdSubjects).toHaveLength(0);
    expect(slotsOf(plan.timetable, "Mon")).toEqual(["2:phy", "3:cslab:lab", "5:phy", "6:ds"]);
    expect(slotsOf(plan.timetable, "Tue")).toEqual(["1:ds", "2:math", "3:chem", "6:chem"]);
    expect(slotsOf(plan.timetable, "Wed")).toEqual(["1:phy", "2:chem", "3:math"]);
    expect(plan.workingDays).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  });
});

// Real aSc pages from the college's timetable PDFs (text layer exported with
// word boxes, the same shape ML Kit returns).
describe("aSc college timetables", () => {
  const load = (name: string): ScanOcrResult =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require(`./fixtures/${name}.json`) as ScanOcrResult;

  it("reads 1CHE01 by course code: lunch in period 4, merged labs, B1/B2 halves", () => {
    const result = parseTimetableScan({
      ocr: load("asc-1CHE01"),
      subjects: [],
      hourSlots: DEFAULT_HOUR_SLOTS,
    });
    expect(result.days).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
    expect(result.scannedHourSlots).toBeUndefined();
    expect(result.batchGroups).toEqual([{ family: "B", options: [1, 2] }]);
    expect(summarise(result)).toEqual([
      "Mon1:?CHE2501",
      "Mon2:?EEE1200",
      "Mon3:?MAT1211",
      "Mon5x2:?CSE1500",
      "Mon7:?CIV1200",
      "Tue1x2:?CHE2502",
      "Tue6:?EEE1200",
      "Tue7:?MAT1211",
      "Tue8:?CSE1500",
      "Wed1:?MAT1211",
      "Wed2:?ENG1030",
      "Wed3:?CIV1200",
      "Wed5:?CHE2501",
      "Thu1:?ENG1030",
      "Thu2:?ENG1030",
      "Thu3:?MAT1211",
      "Thu5x2:?PPS1025",
      "Fri1:?CSE1500",
      "Fri2:?CHE2501",
      "Fri3:?EEE1200",
      "Fri5x2:?EEE1251",
    ]);
  });

  it("reads 1MTAIE01 (lunch in period 5) and matches saved subjects by code", () => {
    const saved: Subject[] = [
      { id: "eng", code: "ENG5001", name: "English", shortName: "ENG", isLab: false, color: "#111" },
      { id: "ai2", code: "AIE4002", name: "Machine Learning", shortName: "ML", isLab: false, color: "#222" },
    ];
    const result = parseTimetableScan({
      ocr: load("asc-1MTAIE01"),
      subjects: saved,
      hourSlots: DEFAULT_HOUR_SLOTS,
    });
    expect(summarise(result)).toEqual([
      "Mon1:eng",
      "Mon2:?MAT4011",
      "Mon3:ai2",
      "Mon4:?AIE4001",
      "Tue1:?AIE4025",
      "Tue2:?AIE4013",
      "Tue3x2:ai2",
      "Tue6:?AIE4000",
      "Wed1:?AIE4013",
      "Wed2:ai2",
      "Wed3:?AIE4000",
      "Wed4:?MAT4011",
      "Wed6:eng",
      "Thu1:?MAT4011",
      "Thu2:?AIE4013",
      "Thu3x2:?AIE4025",
      "Thu6:?AIE4025",
      "Thu7:eng",
      "Fri1:?AIE4000",
      "Fri2:?AIE4001",
      "Fri3x2:?AIE4001",
      "Fri6:?MAT4011",
    ]);
  });

  it("keeps only the chosen batch's classes in 7CAI01", () => {
    const read = (batches: Record<string, number>) =>
      parseTimetableScan({
        ocr: load("asc-7CAI01"),
        subjects: [],
        hourSlots: DEFAULT_HOUR_SLOTS,
        batches,
      });

    const batchOne = read({ B: 1, Bat: 1 });
    expect(batchOne.batchGroups).toEqual([
      { family: "B", options: [1, 2] },
      { family: "Bat", options: [1, 2, 3, 4] },
    ]);
    expect(summarise(batchOne)).toEqual([
      "Mon5:?CAI3411",
      "Mon8:?EEE3103",
      "Tue1:?CAI3407",
      "Tue7:?CAI3411",
      "Tue8:?EEE3103",
      "Thu3:?CAI3407",
      "Thu5x2:?CAI3411",
      "Thu8:?EEE3103",
      "Fri7x2:?CAI3407",
    ]);

    const batchTwo = summarise(read({ B: 2, Bat: 3 }));
    expect(batchTwo).toContain("Thu1:?CAI3407");
    expect(batchTwo).not.toContain("Thu3:?CAI3407");
    expect(batchTwo).toContain("Thu5x2:?CAI3411");
  });
});

// Real ML Kit output from the phone for page 45 (7CAI01) of the examples PDF:
// tight boxes, tiny batch labels, and misreads such as "B*", "R2", "CAI3411P".
describe("on-device OCR of an aSc page", () => {
  const ocr = require("./fixtures/mlkit-7CAI01.json") as ScanOcrResult; // eslint-disable-line @typescript-eslint/no-require-imports

  it("reads the grid and both batch groups", () => {
    const read = (batches: Record<string, number>) =>
      parseTimetableScan({ ocr, subjects: [], hourSlots: DEFAULT_HOUR_SLOTS, batches });

    const batchOne = read({ B: 1, Bat: 1 });
    expect(batchOne.batchGroups).toEqual([
      { family: "B", options: [1, 2] },
      { family: "Bat", options: [1, 2, 3, 4] },
    ]);
    expect(summarise(batchOne)).toEqual([
      "Mon5:?CAI3411",
      "Mon8:?EEE3103",
      "Tue1:?CAI3407",
      "Tue7:?CAI3411",
      "Tue8:?EEE3103",
      "Thu3:?CAI3407",
      "Thu5x2:?CAI3411",
      "Thu8:?EEE3103",
      "Fri7x2:?CAI3407",
    ]);

    const batchTwo = summarise(read({ B: 2, Bat: 3 }));
    expect(batchTwo).toContain("Thu1:?CAI3407");
    expect(batchTwo).not.toContain("Thu3:?CAI3407");
  });
});
