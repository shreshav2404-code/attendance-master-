import { format, isValid, parse, parseISO } from "date-fns";
import * as XLSX from "xlsx";

import { SUBJECT_COLOR_PALETTE } from "@/lib/constants";
import { generateId, roundToTwo } from "@/lib/utils";
import type {
  DailyLog,
  ODEvent,
  PendingODImportPlan,
  PendingODImportMatch,
  PendingODSkippedRow,
  PendingODUploadParseResult,
  PendingODUploadRow,
  Subject,
} from "@/types";

type PendingODFileKind = "csv" | "workbook";

const normalizeText = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const toCellText = (value: unknown): string =>
  typeof value === "string"
    ? value.trim()
    : typeof value === "number"
      ? String(value)
      : value instanceof Date
        ? format(value, "yyyy-MM-dd")
        : "";

const parseHours = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return roundToTwo(value);
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized.length === 0) {
      return null;
    }

    const parsed = Number(normalized.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return roundToTwo(parsed);
  }

  return null;
};

const formatDateKey = (date: Date): string => format(date, "yyyy-MM-dd");

const parseDateCell = (value: unknown): string | null => {
  if (value instanceof Date && isValid(value)) {
    return formatDateKey(value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsedDate = XLSX.SSF.parse_date_code(value);
    if (!parsedDate) {
      return null;
    }
    const date = new Date(parsedDate.y, parsedDate.m - 1, parsedDate.d);
    return isValid(date) ? formatDateKey(date) : null;
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized.length === 0) {
      return null;
    }

    const directIsoDate = normalized.match(/^\d{4}-\d{2}-\d{2}$/);
    if (directIsoDate) {
      const parsedIso = parseISO(normalized);
      return isValid(parsedIso) ? formatDateKey(parsedIso) : null;
    }

    const patterns = [
      "dd-MM-yyyy",
      "d-M-yyyy",
      "dd/MM/yyyy",
      "d/M/yyyy",
      "yyyy/MM/dd",
      "yyyy-M-d",
      "dd MMM yyyy",
      "d MMM yyyy",
      "dd-MMM-yyyy",
      "MM/dd/yyyy",
    ];
    for (const pattern of patterns) {
      const parsed = parse(normalized, pattern, new Date());
      if (isValid(parsed)) {
        return formatDateKey(parsed);
      }
    }
  }

  return null;
};

interface HeaderConfig {
  headerRowIndex: number;
  dateIndex: number;
  hoursIndex: number;
  subjectCodeIndex: number;
  subjectNameIndex: number;
  reasonIndex: number;
}

const findColumnIndex = (
  row: readonly unknown[],
  matcher: (normalized: string, raw: string) => boolean,
): number => {
  for (let index = 0; index < row.length; index += 1) {
    const raw = toCellText(row[index]);
    const normalized = normalizeText(raw);
    if (matcher(normalized, raw)) {
      return index;
    }
  }
  return -1;
};

const resolveHeader = (rows: readonly (readonly unknown[])[]): HeaderConfig | null => {
  const maxProbeRows = Math.min(rows.length, 12);

  for (let rowIndex = 0; rowIndex < maxProbeRows; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const dateIndex = findColumnIndex(
      row,
      (normalized) => normalized === "date" || normalized === "day" || normalized.includes("date"),
    );
    const hoursIndex = findColumnIndex(row, (normalized) => {
      if (normalized.includes("hour")) {
        return true;
      }
      if (normalized.includes("odvalue") || normalized.includes("pendingod")) {
        return true;
      }
      return normalized === "od";
    });
    const subjectCodeIndex = findColumnIndex(
      row,
      (normalized) =>
        normalized.includes("subjectcode") ||
        normalized.includes("coursecode") ||
        normalized === "code",
    );
    const subjectNameIndex = findColumnIndex(
      row,
      (normalized) =>
        normalized.includes("subjectname") ||
        normalized.includes("coursename") ||
        normalized === "subject" ||
        normalized === "course" ||
        normalized === "name",
    );

    if (dateIndex < 0 || hoursIndex < 0) {
      continue;
    }
    if (subjectCodeIndex < 0 && subjectNameIndex < 0) {
      continue;
    }

    const reasonIndex = findColumnIndex(
      row,
      (normalized) =>
        normalized.includes("reason") ||
        normalized.includes("remark") ||
        normalized.includes("note"),
    );

    return {
      headerRowIndex: rowIndex,
      dateIndex,
      hoursIndex,
      subjectCodeIndex,
      subjectNameIndex,
      reasonIndex,
    };
  }

  return null;
};

const readRowsFromSheet = ({
  content,
  kind,
}: {
  content: string;
  kind: PendingODFileKind;
}): (readonly unknown[])[] => {
  const workbook = XLSX.read(content, {
    type: kind === "csv" ? "string" : "base64",
    cellDates: true,
    raw: true,
  });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("Uploaded file has no sheet data.");
  }
  const firstSheet = workbook.Sheets[firstSheetName];
  if (!firstSheet) {
    throw new Error("Could not read the first sheet from uploaded file.");
  }

  return XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    raw: true,
    defval: "",
    blankrows: false,
  });
};

const parseWithoutHeader = (
  rows: readonly (readonly unknown[])[],
): PendingODUploadParseResult => {
  const parsedRows: PendingODUploadRow[] = [];
  const skippedRows: PendingODSkippedRow[] = [];

  rows.forEach((row, index) => {
    const date = parseDateCell(row[0]);
    const hours = parseHours(row[3]);
    const subjectCode = toCellText(row[1]);
    const subjectName = toCellText(row[2]);

    if (!date) {
      skippedRows.push({
        rowNumber: index + 1,
        reason: "Missing or invalid date",
      });
      return;
    }
    if (!hours) {
      skippedRows.push({
        rowNumber: index + 1,
        reason: "Missing or invalid hours",
      });
      return;
    }
    if (!subjectCode && !subjectName) {
      skippedRows.push({
        rowNumber: index + 1,
        reason: "Missing subject code/name",
      });
      return;
    }

    parsedRows.push({
      rowNumber: index + 1,
      date,
      subjectCode: subjectCode || undefined,
      subjectName: subjectName || undefined,
      hours,
      reason: toCellText(row[4]) || "Imported pending OD",
    });
  });

  return {
    rows: parsedRows,
    skippedRows,
  };
};

export const parsePendingODImportFile = ({
  content,
  kind,
}: {
  content: string;
  kind: PendingODFileKind;
}): PendingODUploadParseResult => {
  const rows = readRowsFromSheet({ content, kind });
  if (rows.length === 0) {
    return {
      rows: [],
      skippedRows: [],
    };
  }

  const header = resolveHeader(rows);
  if (!header) {
    return parseWithoutHeader(rows);
  }

  const parsedRows: PendingODUploadRow[] = [];
  const skippedRows: PendingODSkippedRow[] = [];

  for (let rowIndex = header.headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const date = parseDateCell(row[header.dateIndex]);
    const hours = parseHours(row[header.hoursIndex]);
    const subjectCode =
      header.subjectCodeIndex >= 0 ? toCellText(row[header.subjectCodeIndex]) : "";
    const subjectName =
      header.subjectNameIndex >= 0 ? toCellText(row[header.subjectNameIndex]) : "";
    const reason =
      header.reasonIndex >= 0 ? toCellText(row[header.reasonIndex]) : "Imported pending OD";

    if (!date && !subjectCode && !subjectName && !hours) {
      continue;
    }
    if (!date) {
      skippedRows.push({
        rowNumber: rowIndex + 1,
        reason: "Missing or invalid date",
      });
      continue;
    }
    if (!hours) {
      skippedRows.push({
        rowNumber: rowIndex + 1,
        reason: "Missing or invalid hours",
      });
      continue;
    }
    if (!subjectCode && !subjectName) {
      skippedRows.push({
        rowNumber: rowIndex + 1,
        reason: "Missing subject code/name",
      });
      continue;
    }

    parsedRows.push({
      rowNumber: rowIndex + 1,
      date,
      subjectCode: subjectCode || undefined,
      subjectName: subjectName || undefined,
      hours,
      reason: reason || "Imported pending OD",
    });
  }

  return {
    rows: parsedRows,
    skippedRows,
  };
};

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

const createSubjectFromPendingRow = (
  row: PendingODUploadRow,
  index: number,
): Subject => {
  const normalizedCode = (row.subjectCode ?? "").replace(/\s+/g, "").toUpperCase();
  const fallbackCode = normalizedCode || `SUBJ${String(index + 1).padStart(3, "0")}`;
  const name = row.subjectName?.trim() || row.subjectCode?.trim() || "Subject";

  return {
    id: generateId("subject"),
    code: fallbackCode,
    name,
    shortName: deriveShortName(name, fallbackCode),
    isLab: /lab/i.test(name),
    color: SUBJECT_COLOR_PALETTE[index % SUBJECT_COLOR_PALETTE.length] ?? "#1a5fa8",
  };
};

export const buildPendingODImportPlan = ({
  parsed,
  subjects,
  createdAt = new Date().toISOString(),
}: {
  parsed: PendingODUploadParseResult;
  subjects: Subject[];
  createdAt?: string;
}): PendingODImportPlan => {
  const byCode = new Map<string, Subject>();
  const byName = new Map<string, Subject>();
  subjects.forEach((subject) => {
    byCode.set(normalizeText(subject.code), subject);
    byName.set(normalizeText(subject.name), subject);
  });

  const createdSubjects: Subject[] = [];
  const matches: PendingODImportMatch[] = [];
  const odEvents: ODEvent[] = [];
  const logs: DailyLog[] = [];
  const skippedRows = [...parsed.skippedRows];

  parsed.rows.forEach((row, index) => {
    const normalizedCode = normalizeText(row.subjectCode ?? "");
    const normalizedName = normalizeText(row.subjectName ?? "");
    const codeMatch = normalizedCode ? byCode.get(normalizedCode) : undefined;
    const nameMatch = normalizedName ? byName.get(normalizedName) : undefined;

    let subject = codeMatch ?? nameMatch;
    let matchType: PendingODImportMatch["matchType"] = "created";

    if (codeMatch) {
      matchType = "code";
    } else if (nameMatch) {
      matchType = "name";
    } else {
      subject = createSubjectFromPendingRow(row, createdSubjects.length);
      createdSubjects.push(subject);
      byCode.set(normalizeText(subject.code), subject);
      byName.set(normalizeText(subject.name), subject);
      matchType = "created";
    }

    if (!subject) {
      skippedRows.push({
        rowNumber: row.rowNumber,
        reason: "Could not resolve subject",
      });
      return;
    }

    const eventId = generateId("od");
    const reason = row.reason.trim() || "Imported pending OD";
    const eventName = `Pending OD · ${subject.shortName || subject.name}`;
    odEvents.push({
      id: eventId,
      name: eventName,
      date: row.date,
      reason,
      type: "other",
      subjects: [
        {
          subjectId: subject.id,
          hours: row.hours,
          registered: false,
        },
      ],
      createdAt,
    });
    logs.push({
      id: `${eventId}_0`,
      date: row.date,
      subjectId: subject.id,
      status: "od",
      hours: row.hours,
      odEventId: eventId,
      note: reason,
      createdAt,
    });
    matches.push({
      row,
      subjectId: subject.id,
      matchType,
    });
  });

  return {
    createdSubjects,
    matches,
    odEvents,
    logs,
    skippedRows,
  };
};
