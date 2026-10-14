import * as XLSX from "xlsx";

import { SUBJECT_COLOR_PALETTE } from "@/lib/constants";
import { generateId } from "@/lib/utils";
import type {
  OfficialAttendanceReport,
  OfficialAttendanceStudentInfo,
  OfficialAttendanceSubjectRow,
  OfficialImportMatch,
  OfficialImportPlan,
  OfficialSubjectInput,
  Subject,
} from "@/types";

const normalizeText = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const parseNumberCell = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const parsePercentCell = (value: unknown): number => {
  const parsed = parseNumberCell(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
};

const toCellText = (value: unknown): string =>
  typeof value === "string"
    ? value.trim()
    : typeof value === "number"
      ? String(value)
      : "";

const extractSubjectCode = (courseName: string): string => {
  const match = courseName.match(/\(\s*([^)]+?)\s*\)\s*$/);
  const rawCode = match?.[1];
  return rawCode ? rawCode.replace(/\s+/g, "").toUpperCase() : "";
};

const extractSubjectName = (courseName: string): string =>
  courseName.replace(/\(\s*([^)]+?)\s*\)\s*$/, "").trim();

const deriveShortName = (subjectName: string, subjectCode: string): string => {
  if (subjectCode.length > 0) {
    return subjectCode.slice(0, 8).toUpperCase();
  }

  const tokens = subjectName
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) {
    return "SUBJ";
  }

  const acronym = tokens.map((token) => token[0]).join("").toUpperCase();
  return acronym.slice(0, 8);
};

const getStudentInfo = (rows: readonly unknown[][]): OfficialAttendanceStudentInfo => {
  const info: OfficialAttendanceStudentInfo = {};

  rows.slice(0, 8).forEach((row) => {
    row.forEach((cell) => {
      const text = toCellText(cell);
      if (!text) {
        return;
      }

      const matchers: {
        key: keyof OfficialAttendanceStudentInfo;
        regex: RegExp;
      }[] = [
        { key: "name", regex: /Student Name:\s*(.+)$/i },
        { key: "rollNo", regex: /Roll No:\s*(.+)$/i },
        { key: "registrationNo", regex: /Registration No:\s*(.+)$/i },
        // Presidency's current report labels it "Batch/Section: 2024CAI02".
        { key: "batch", regex: /Batch(?:\s*\/\s*Section)?:\s*(.+)$/i },
        { key: "department", regex: /Department:\s*(.+)$/i },
        { key: "term", regex: /Term:\s*(.+)$/i },
        { key: "dateRange", regex: /Date range\s*:\s*(.+)$/i },
      ];

      matchers.forEach(({ key, regex }) => {
        const match = text.match(regex);
        if (!match) {
          return;
        }
        const nextValue = match[1]?.trim();
        if (nextValue) {
          info[key] = nextValue;
        }
      });
    });
  });

  return info;
};

const findHeaderColumn = (
  headerRow: readonly unknown[],
  matcher: (headerCell: string) => boolean,
): number => {
  for (let index = 0; index < headerRow.length; index += 1) {
    const text = toCellText(headerRow[index]);
    if (matcher(text)) {
      return index;
    }
  }
  return -1;
};

const resolveHeader = (rows: readonly unknown[][]): {
  headerRowIndex: number;
  serialIndex: number;
  courseIndex: number;
  thIndex: number;
  ahIndex: number;
  dlIndex: number;
  ahdlIndex: number;
  ahPercentIndex: number;
  ahdlPercentIndex: number;
} => {
  let headerRowIndex = -1;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const firstCell = toCellText(row[0]);
    const secondCell = toCellText(row[1]);
    if (
      normalizeText(firstCell).includes("slno") &&
      normalizeText(secondCell) === "coursename"
    ) {
      headerRowIndex = index;
      break;
    }
  }

  if (headerRowIndex < 0) {
    throw new Error("Could not find attendance header row in uploaded sheet.");
  }

  const headerRow = rows[headerRowIndex] ?? [];
  const serialIndex = findHeaderColumn(
    headerRow,
    (text) => normalizeText(text).includes("slno"),
  );
  const courseIndex = findHeaderColumn(
    headerRow,
    (text) => normalizeText(text) === "coursename",
  );
  const thIndex = findHeaderColumn(
    headerRow,
    (text) => normalizeText(text) === "th",
  );
  const ahIndex = findHeaderColumn(
    headerRow,
    (text) => normalizeText(text) === "ah" && !text.includes("%"),
  );
  const dlIndex = findHeaderColumn(
    headerRow,
    (text) => normalizeText(text) === "dl",
  );
  const ahdlIndex = findHeaderColumn(
    headerRow,
    (text) => normalizeText(text) === "ahdl" && !text.includes("%"),
  );
  const ahPercentIndex = findHeaderColumn(
    headerRow,
    (text) => normalizeText(text) === "ah" && text.includes("%"),
  );
  const ahdlPercentIndex = findHeaderColumn(
    headerRow,
    (text) => normalizeText(text) === "ahdl" && text.includes("%"),
  );

  if (
    serialIndex < 0 ||
    courseIndex < 0 ||
    thIndex < 0 ||
    ahIndex < 0 ||
    dlIndex < 0 ||
    ahdlIndex < 0
  ) {
    throw new Error("Uploaded sheet is missing required columns (Course Name/TH/AH/DL).");
  }

  const resolvedAhPercentIndex = ahPercentIndex >= 0 ? ahPercentIndex : ahdlIndex + 1;
  const resolvedAhdlPercentIndex =
    ahdlPercentIndex >= 0 ? ahdlPercentIndex : ahdlIndex + 2;

  return {
    headerRowIndex,
    serialIndex,
    courseIndex,
    thIndex,
    ahIndex,
    dlIndex,
    ahdlIndex,
    ahPercentIndex: resolvedAhPercentIndex,
    ahdlPercentIndex: resolvedAhdlPercentIndex,
  };
};

export const parseOfficialAttendanceWorkbook = (
  workbookBase64: string,
): OfficialAttendanceReport => {
  const workbook = XLSX.read(workbookBase64, {
    type: "base64",
    cellDates: false,
    raw: false,
  });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("Uploaded workbook has no sheets.");
  }

  const firstSheet = workbook.Sheets[firstSheetName];
  if (!firstSheet) {
    throw new Error("Could not read the first sheet from workbook.");
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });
  const student = getStudentInfo(rows);
  const header = resolveHeader(rows);

  const parsedRows: OfficialAttendanceSubjectRow[] = [];
  for (let index = header.headerRowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const serialCell = toCellText(row[header.serialIndex]);

    if (!serialCell) {
      continue;
    }
    if (normalizeText(serialCell) === "total") {
      break;
    }

    const courseName = toCellText(row[header.courseIndex]);
    if (!courseName) {
      continue;
    }

    const subjectCode = extractSubjectCode(courseName);
    const subjectName = extractSubjectName(courseName);

    parsedRows.push({
      serialNo: serialCell,
      courseName,
      subjectName,
      subjectCode,
      TH: parseNumberCell(row[header.thIndex]),
      AH: parseNumberCell(row[header.ahIndex]),
      DL: parseNumberCell(row[header.dlIndex]),
      AHDL: parseNumberCell(row[header.ahdlIndex]),
      AHPercent: parsePercentCell(row[header.ahPercentIndex]),
      AHDLPercent: parsePercentCell(row[header.ahdlPercentIndex]),
    });
  }

  return {
    student,
    rows: parsedRows,
  };
};

const createSubjectFromRow = (
  row: OfficialAttendanceSubjectRow,
  index: number,
): Subject => {
  const fallbackCode =
    row.subjectCode.length > 0
      ? row.subjectCode
      : `SUBJ${String(index + 1).padStart(3, "0")}`;
  const name = row.subjectName || row.courseName;

  return {
    id: generateId("subject"),
    code: fallbackCode.toUpperCase(),
    name,
    shortName: deriveShortName(name, fallbackCode),
    isLab: /lab/i.test(name),
    color: SUBJECT_COLOR_PALETTE[index % SUBJECT_COLOR_PALETTE.length] ?? "#1a5fa8",
  };
};

export const buildOfficialImportPlan = ({
  report,
  subjects,
}: {
  report: OfficialAttendanceReport;
  subjects: Subject[];
}): OfficialImportPlan => {
  const byCode = new Map<string, Subject>();
  const byName = new Map<string, Subject>();
  subjects.forEach((subject) => {
    byCode.set(normalizeText(subject.code), subject);
    byName.set(normalizeText(subject.name), subject);
  });

  const officialInputs: OfficialSubjectInput[] = [];
  const matches: OfficialImportMatch[] = [];
  const skippedRows: OfficialAttendanceSubjectRow[] = [];
  const createdSubjects: Subject[] = [];

  report.rows.forEach((row, index) => {
    const normalizedCode = normalizeText(row.subjectCode);
    const normalizedName = normalizeText(row.subjectName);

    const codeMatch = normalizedCode ? byCode.get(normalizedCode) : undefined;
    if (codeMatch) {
      officialInputs.push({
        subjectId: codeMatch.id,
        officialTH: row.TH,
        officialAH: row.AH,
        officialDL: row.DL,
      });
      matches.push({
        row,
        subjectId: codeMatch.id,
        matchType: "code",
      });
      return;
    }

    const nameMatch = normalizedName ? byName.get(normalizedName) : undefined;
    if (nameMatch) {
      officialInputs.push({
        subjectId: nameMatch.id,
        officialTH: row.TH,
        officialAH: row.AH,
        officialDL: row.DL,
      });
      matches.push({
        row,
        subjectId: nameMatch.id,
        matchType: "name",
      });
      return;
    }

    const createdSubject = createSubjectFromRow(row, index);
    createdSubjects.push(createdSubject);
    byCode.set(normalizeText(createdSubject.code), createdSubject);
    byName.set(normalizeText(createdSubject.name), createdSubject);

    officialInputs.push({
      subjectId: createdSubject.id,
      officialTH: row.TH,
      officialAH: row.AH,
      officialDL: row.DL,
    });
    matches.push({
      row,
      subjectId: createdSubject.id,
      matchType: "created",
    });
  });

  if (officialInputs.length === 0) {
    report.rows.forEach((row) => {
      skippedRows.push(row);
    });
  }

  return {
    officialInputs,
    createdSubjects,
    matches,
    skippedRows,
  };
};
