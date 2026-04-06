import * as XLSX from "xlsx";

import {
  buildOfficialImportPlan,
  parseOfficialAttendanceWorkbook,
} from "@/lib/officialReportImport";
import type { Subject } from "@/types";

const buildWorkbookBase64 = (): string => {
  const rows: (string | number)[][] = [
    [
      "Presidency University, Bengaluru",
    ],
    ["Course Wise Report"],
    [
      "Student Name: KESHAV KUMAR",
      "",
      "Roll No: 20241CAI0072",
      "Registration No: 20241CAI0072",
      "Batch: 2024CAI02",
      "Department: CSE",
      "",
      "Term: S4",
    ],
    ["Date range : 07-01-2026 to 06-05-2026"],
    ["Sl.No.", "Course Name", "TH", "AH", "DL", "AH + DL", "AH%", "AH+DL%"],
    [1, "Machine Learning ( CAI2500 )", 32, 24, 1, 25, "75.00 %", "78.13 %"],
    [2, "Natural Language Processing ( CAI2502 )", 20, 18, 0, 18, "90.00 %", "90.00 %"],
    [3, "Ethics of AI", 22, 16, 1, 17, "72.73 %", "77.27 %"],
    ["Total", "", 74, 58, 2, 60, "78.38 %", "81.08 %"],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet 1");

  return XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
};

describe("officialReportImport", () => {
  it("parses the official attendance workbook rows and student metadata", () => {
    const base64 = buildWorkbookBase64();
    const parsed = parseOfficialAttendanceWorkbook(base64);

    expect(parsed.student.name).toBe("KESHAV KUMAR");
    expect(parsed.student.rollNo).toBe("20241CAI0072");
    expect(parsed.student.batch).toBe("2024CAI02");
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows[0]).toMatchObject({
      subjectName: "Machine Learning",
      subjectCode: "CAI2500",
      TH: 32,
      AH: 24,
      DL: 1,
      AHDL: 25,
      AHPercent: 75,
      AHDLPercent: 78.13,
    });
  });

  it("builds an import plan with code match, name match, and created subjects", () => {
    const base64 = buildWorkbookBase64();
    const parsed = parseOfficialAttendanceWorkbook(base64);

    const subjects: Subject[] = [
      {
        id: "subject_ml",
        code: "CAI2500",
        name: "Machine Learning",
        shortName: "ML",
        isLab: false,
        color: "#1a5fa8",
      },
      {
        id: "subject_ethics",
        code: "CAI2511",
        name: "Ethics of AI",
        shortName: "EOAI",
        isLab: false,
        color: "#7c3aed",
      },
    ];

    const plan = buildOfficialImportPlan({ report: parsed, subjects });

    expect(plan.officialInputs).toHaveLength(3);
    expect(plan.createdSubjects).toHaveLength(1);
    expect(plan.matches.map((match) => match.matchType)).toEqual([
      "code",
      "created",
      "name",
    ]);

    const mlInput = plan.officialInputs.find((row) => row.subjectId === "subject_ml");
    expect(mlInput).toEqual({
      subjectId: "subject_ml",
      officialTH: 32,
      officialAH: 24,
      officialDL: 1,
    });

    const createdSubject = plan.createdSubjects[0];
    expect(createdSubject?.code).toBe("CAI2502");
    expect(createdSubject?.name).toBe("Natural Language Processing");
  });
});
