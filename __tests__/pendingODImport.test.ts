import * as XLSX from "xlsx";

import {
  buildPendingODImportPlan,
  parsePendingODImportFile,
} from "@/lib/pendingODImport";
import type { Subject } from "@/types";

const buildWorkbookBase64 = (): string => {
  const rows: (string | number)[][] = [
    ["Date", "Subject Code", "Subject Name", "OD Hours", "Reason"],
    ["2026-04-05", "CAI2500", "Machine Learning", 2, "Hackathon pending"],
    ["06/04/2026", "", "Natural Language Processing", 1, "Seminar pending"],
    ["bad-date", "CAI2600", "Cloud Computing", 2, "Invalid date row"],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Pending OD");

  return XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
};

describe("pendingODImport", () => {
  it("parses xlsx rows and builds OD import plan with subject creation", () => {
    const parsed = parsePendingODImportFile({
      content: buildWorkbookBase64(),
      kind: "workbook",
    });

    expect(parsed.rows).toHaveLength(2);
    expect(parsed.skippedRows).toEqual([
      expect.objectContaining({
        rowNumber: 4,
        reason: "Missing or invalid date",
      }),
    ]);
    expect(parsed.rows[0]).toMatchObject({
      date: "2026-04-05",
      subjectCode: "CAI2500",
      hours: 2,
    });
    expect(parsed.rows[1]).toMatchObject({
      date: "2026-04-06",
      subjectName: "Natural Language Processing",
      hours: 1,
    });

    const subjects: Subject[] = [
      {
        id: "subject_ml",
        code: "CAI2500",
        name: "Machine Learning",
        shortName: "ML",
        isLab: false,
        color: "#1a5fa8",
      },
    ];
    const plan = buildPendingODImportPlan({
      parsed,
      subjects,
      createdAt: "2026-04-06T00:00:00.000Z",
    });

    expect(plan.createdSubjects).toHaveLength(1);
    expect(plan.createdSubjects[0]?.name).toBe("Natural Language Processing");
    expect(plan.matches.map((match) => match.matchType)).toEqual([
      "code",
      "created",
    ]);
    expect(plan.odEvents).toHaveLength(2);
    expect(plan.logs).toHaveLength(2);
    expect(plan.logs[0]).toEqual(
      expect.objectContaining({
        status: "od",
        hours: 2,
        createdAt: "2026-04-06T00:00:00.000Z",
      }),
    );
  });

  it("parses csv content and accepts files without header using fixed columns", () => {
    const csvWithoutHeader =
      "2026-04-10,CAI3000,Data Mining,2,Late submission\n";
    const parsed = parsePendingODImportFile({
      content: csvWithoutHeader,
      kind: "csv",
    });

    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      date: "2026-04-10",
      subjectCode: "CAI3000",
      subjectName: "Data Mining",
      hours: 2,
      reason: "Late submission",
    });
    expect(parsed.skippedRows).toHaveLength(0);
  });
});
