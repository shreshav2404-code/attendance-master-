import { SUBJECT_COLOR_PALETTE, WORKING_DAYS } from "@/lib/constants";
import { generateId } from "@/lib/utils";
import type {
  HourSlot,
  Subject,
  TimetableImportPlan,
  TimetableSlot,
  WorkingDay,
} from "@/types";

// Builds a timetable from on-device OCR of a timetable photo. The shapes below
// match @react-native-ml-kit/text-recognition's result; they are redeclared so
// the parser stays a plain function that tests can feed synthetic OCR output.

export interface ScanFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ScanPoint {
  x: number;
  y: number;
}

export interface ScanElement {
  text: string;
  frame?: ScanFrame;
}

export interface ScanLine {
  text: string;
  frame?: ScanFrame;
  cornerPoints?: readonly ScanPoint[];
  elements: ScanElement[];
}

export interface ScanBlock {
  text: string;
  lines: ScanLine[];
}

export interface ScanOcrResult {
  text: string;
  blocks: ScanBlock[];
}

export interface ScannedCell {
  day: WorkingDay;
  /** 1-based hour the cell starts at. */
  hour: number;
  /** Hours this cell covers; more than 1 for merged cells such as labs. */
  span: number;
  /** All text read in the cell. */
  text: string;
  /** Subject name read from the cell (first line, room numbers removed). */
  label: string;
  /** Existing subject the cell matched, if any. */
  subjectId?: string;
  /** Set when nothing matched; cells with the same key share one choice. */
  unknownKey?: string;
}

export interface UnknownScanLabel {
  key: string;
  label: string;
  count: number;
  isLab: boolean;
}

export interface ScanBatchGroup {
  /** "B" for B1/B2 halves, "Bat" for Bat1-Bat4 lab batches. */
  family: string;
  options: number[];
}

export type ScanBatchSelection = Record<string, number>;

export interface TimetableScanResult {
  days: WorkingDay[];
  /** Class columns found (break and lunch columns excluded). */
  columnCount: number;
  cells: ScannedCell[];
  unknownLabels: UnknownScanLabel[];
  /** Batch labels found in split cells; pass a choice back as `batches` to re-read. */
  batchGroups: ScanBatchGroup[];
  /** Timings read from the header when they differ from the saved hour timings. */
  scannedHourSlots?: HourSlot[];
  warnings: string[];
}

export type ScanChoice =
  | { kind: "subject"; subjectId: string }
  | { kind: "new" }
  | { kind: "free" };

interface Token {
  text: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  cx: number;
  cy: number;
  /** Text height, for gap tolerances. */
  h: number;
  /** Upright position, kept when the grid is transposed so text still reads in order. */
  textX: number;
  textY: number;
}

interface Column {
  cx: number;
  headerText: string;
  isBreak: boolean;
  start?: number;
  end?: number;
}

interface DayAnchor {
  day: WorkingDay | "Sun";
  cy: number;
  x1: number;
}

const WEEK_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const DAY_PATTERNS: [WorkingDay | "Sun", RegExp][] = [
  ["Mon", /^mon(day)?$/],
  ["Tue", /^tue(s(day)?)?$/],
  ["Wed", /^wed(s|nesday)?$/],
  ["Thu", /^thu(r(s(day)?)?)?$/],
  ["Fri", /^fri(day)?$/],
  ["Sat", /^sat(urday)?$/],
  ["Sun", /^sun(day)?$/],
];

const BREAK_PATTERN = /break|lunch|recess|interval/i;
const CLOCK_PATTERN = /(\d{1,2})\s*[:.]\s*(\d{2})\s*(am|pm)?/gi;
const HEADER_NUMBER_PATTERN =
  /^(\d{1,2}|[ivx]{1,4}|\d{1,2}(st|nd|rd|th)|(p|h|hr|hour|period)\d{1,2})$/i;
const EMPTY_CELL_PATTERN = /^(X|NIL|NA)?$/;
const STOP_WORDS = new Set(["of", "and", "the", "in", "to", "for", "with", "&"]);

const median = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};

const canonical = (value: string): string => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

// OCR mixes these characters up often enough ("MA1O1" for "MA101").
const confusable = (value: string): string =>
  canonical(value)
    .replace(/0/g, "O")
    .replace(/[1L]/g, "I")
    .replace(/5/g, "S")
    .replace(/8/g, "B");

const similarity = (left: string, right: string): number => {
  if (!left || !right) {
    return 0;
  }
  const cols = right.length + 1;
  let previous = Array.from({ length: cols }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let col = 1; col < cols; col += 1) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1;
      current[col] = Math.min(
        (previous[col] ?? 0) + 1,
        (current[col - 1] ?? 0) + 1,
        (previous[col - 1] ?? 0) + cost,
      );
    }
    previous = current;
  }
  return 1 - (previous[cols - 1] ?? 0) / Math.max(left.length, right.length);
};

const matchDay = (text: string): WorkingDay | "Sun" | undefined => {
  const normalized = text.toLowerCase().replace(/0/g, "o").replace(/[^a-z]/g, "");
  return DAY_PATTERNS.find(([, pattern]) => pattern.test(normalized))?.[0];
};

// "DBMS (R-204)" and "DBMS LH 3" are the same subject in different rooms.
const cleanLabel = (label: string): string => {
  const cleaned = label
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/\b(room|rm|lh|lab\s*no|r)\s*[-.:#]?\s*\d+\w*/gi, " ")
    .replace(/(^|\s)\d[\w-]*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || label.trim();
};

const toTokens = (ocr: ScanOcrResult): { tokens: Token[]; lines: ScanLine[] } => {
  const tokens: Token[] = [];
  const lines: ScanLine[] = [];

  ocr.blocks.forEach((block) => {
    block.lines.forEach((line) => {
      lines.push(line);
      line.elements.forEach((element) => {
        const text = element.text.trim();
        if (!text || !element.frame) {
          return;
        }
        const { left, top, width, height } = element.frame;
        const cx = left + width / 2;
        const cy = top + height / 2;
        tokens.push({
          text,
          x0: left,
          x1: left + width,
          y0: top,
          y1: top + height,
          cx,
          cy,
          h: height,
          textX: cx,
          textY: cy,
        });
      });
    });
  });

  return { tokens, lines };
};

// Phone photos are rarely straight; a few degrees of tilt moves the far end of a
// row into the next one. Estimate the tilt from the text lines and undo it.
const estimateSkew = (lines: ScanLine[]): number => {
  const angles: number[] = [];

  lines.forEach((line) => {
    const [topLeft, topRight] = line.cornerPoints ?? [];
    if (topLeft && topRight && line.frame) {
      const dx = topRight.x - topLeft.x;
      const dy = topRight.y - topLeft.y;
      if (dx > line.frame.height * 2) {
        angles.push(Math.atan2(dy, dx));
      }
    }
  });

  return median(angles);
};

const rotateTokens = (tokens: Token[], angle: number): Token[] => {
  if (Math.abs(angle) < 0.004) {
    return tokens;
  }
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return tokens.map((token) => {
    const cx = token.cx * cos + token.cy * sin;
    const cy = -token.cx * sin + token.cy * cos;
    const halfWidth = (token.x1 - token.x0) / 2;
    const halfHeight = (token.y1 - token.y0) / 2;
    return {
      ...token,
      cx,
      cy,
      x0: cx - halfWidth,
      x1: cx + halfWidth,
      y0: cy - halfHeight,
      y1: cy + halfHeight,
      textX: cx,
      textY: cy,
    };
  });
};

const transposeTokens = (tokens: Token[]): Token[] =>
  tokens.map((token) => ({
    ...token,
    x0: token.y0,
    x1: token.y1,
    y0: token.x0,
    y1: token.x1,
    cx: token.cy,
    cy: token.cx,
  }));

const findDayAnchors = (
  tokens: Token[],
): { anchors: DayAnchor[]; tokens: Token[] } | null => {
  const isCandidate = (token: Token) => matchDay(token.text) !== undefined;
  const candidates = tokens.filter(isCandidate);

  if (new Set(candidates.map((token) => matchDay(token.text))).size < 2) {
    return null;
  }

  // Days down the side share an x position; days across the top share a y
  // position. Work in "days down the side" coordinates either way.
  const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
  const transposed =
    spread(candidates.map((token) => token.cx)) > spread(candidates.map((token) => token.cy));
  const working = transposed ? transposeTokens(tokens) : tokens;
  const workingCandidates = working.filter(isCandidate);
  const medianX = median(workingCandidates.map((token) => token.cx));

  const anchors: DayAnchor[] = [];
  WEEK_ORDER.forEach((day) => {
    const options = workingCandidates.filter((token) => matchDay(token.text) === day);
    if (options.length === 0) {
      return;
    }
    const best = options.reduce((left, right) =>
      Math.abs(left.cx - medianX) <= Math.abs(right.cx - medianX) ? left : right,
    );
    anchors.push({ day, cy: best.cy, x1: best.x1 });
  });

  anchors.sort((left, right) => left.cy - right.cy);
  return { anchors, tokens: working };
};

// A day name OCR missed leaves a double-height gap; put the day back so the
// rows either side don't swallow its classes.
const fillMissingDays = (anchors: DayAnchor[]): DayAnchor[] => {
  const weekIndex = (day: DayAnchor["day"]) => WEEK_ORDER.indexOf(day);
  const unitGaps: number[] = [];
  anchors.slice(1).forEach((anchor, index) => {
    const previous = anchors[index];
    const steps = previous ? weekIndex(anchor.day) - weekIndex(previous.day) : 0;
    if (previous && steps >= 1) {
      unitGaps.push((anchor.cy - previous.cy) / steps);
    }
  });
  const unitGap = median(unitGaps);
  if (unitGap <= 0) {
    return anchors;
  }

  const filled: DayAnchor[] = [];
  anchors.forEach((anchor, index) => {
    const previous = anchors[index - 1];
    if (previous) {
      const steps = weekIndex(anchor.day) - weekIndex(previous.day);
      const actual = anchor.cy - previous.cy;
      if (steps >= 2 && Math.abs(actual - steps * unitGap) < unitGap * 0.4) {
        for (let step = 1; step < steps; step += 1) {
          const missing = WEEK_ORDER[weekIndex(previous.day) + step];
          if (missing) {
            filled.push({ day: missing, cy: previous.cy + (actual * step) / steps, x1: previous.x1 });
          }
        }
      }
    }
    filled.push(anchor);
  });
  return filled;
};

const parseClock = (hourText: string, minuteText: string, meridiem?: string): number => {
  let hour = Number(hourText);
  const suffix = meridiem?.toLowerCase();
  if (suffix === "pm" && hour < 12) {
    hour += 12;
  } else if (suffix === "am" && hour === 12) {
    hour = 0;
  } else if (!suffix && hour < 7) {
    // College days run roughly 7 am to 6 pm, so "1:25" means 13:25.
    hour += 12;
  }
  return hour * 60 + Number(minuteText);
};

const formatClock = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** Groups tokens whose horizontal gap is at most `tolerance` (lines of one cell overlap, so they join). */
const clusterByGap = (tokens: Token[], tolerance: number): Token[][] => {
  const sorted = [...tokens].sort((left, right) => left.x0 - right.x0);
  const clusters: Token[][] = [];
  let right = -Infinity;
  sorted.forEach((token) => {
    const current = clusters[clusters.length - 1];
    if (current && token.x0 - right <= tolerance) {
      current.push(token);
      right = Math.max(right, token.x1);
      return;
    }
    clusters.push([token]);
    right = token.x1;
  });
  return clusters;
};

const joinLines = (tokens: Token[]): string[] => {
  const sorted = [...tokens].sort((left, right) => left.textY - right.textY);
  const lines: Token[][] = [];
  sorted.forEach((token) => {
    const line = lines[lines.length - 1];
    const lineY = line ? median(line.map((item) => item.textY)) : undefined;
    if (line && lineY !== undefined && Math.abs(token.textY - lineY) < token.h * 0.6) {
      line.push(token);
    } else {
      lines.push([token]);
    }
  });
  return lines.map((line) =>
    line
      .sort((left, right) => left.textX - right.textX)
      .map((token) => token.text)
      .join(" "),
  );
};

const spanOf = (tokens: Token[]) => {
  const x0 = Math.min(...tokens.map((token) => token.x0));
  const x1 = Math.max(...tokens.map((token) => token.x1));
  return { x0, x1, cx: (x0 + x1) / 2 };
};

/** Lines of text as printed (upright), even when the grid itself is transposed. */
const groupIntoLines = (tokens: Token[]): Token[][] => {
  const lines: Token[][] = [];
  [...tokens]
    .sort((left, right) => left.textY - right.textY)
    .forEach((token) => {
      const line = lines[lines.length - 1];
      const lineY = line ? median(line.map((item) => item.textY)) : undefined;
      if (line && lineY !== undefined && Math.abs(token.textY - lineY) < token.h * 0.6) {
        line.push(token);
      } else {
        lines.push([token]);
      }
    });
  return lines;
};

interface HeaderEntry {
  cx: number;
  text: string;
  start?: number;
  end?: number;
}

// Time headers ("8:50 - 9:45") often fill their cells, leaving neighbouring
// headers barely a space apart, so pair the clock times into ranges instead of
// splitting on gaps: each range is one column.
const readClockColumns = (line: Token[]): HeaderEntry[] | undefined => {
  const clocks = [...line]
    .sort((left, right) => left.textX - right.textX)
    .flatMap((token) =>
      [...token.text.matchAll(CLOCK_PATTERN)]
        .filter((match) => Number(match[1]) <= 23 && Number(match[2]) <= 59)
        .map((match) => ({
          minutes: parseClock(match[1] ?? "0", match[2] ?? "0", match[3]),
          x0: token.x0,
          x1: token.x1,
          text: match[0],
        })),
    );
  if (clocks.length < 2) {
    return undefined;
  }

  const pairs: { start: (typeof clocks)[number]; end: (typeof clocks)[number] }[] = [];
  for (let index = 0; index + 1 < clocks.length; index += 2) {
    const start = clocks[index];
    const end = clocks[index + 1];
    if (start && end) {
      pairs.push({ start, end });
    }
  }
  const pairsAreRanges =
    clocks.length % 2 === 0 &&
    pairs.every(({ start, end }, index) => {
      const duration = end.minutes - start.minutes;
      const previousEnd = pairs[index - 1]?.end.minutes;
      return (
        duration >= 5 &&
        duration <= 240 &&
        (previousEnd === undefined || Math.abs(start.minutes - previousEnd) <= 60)
      );
    });

  if (pairsAreRanges) {
    return pairs.map(({ start, end }) => ({
      cx: (Math.min(start.x0, end.x0) + Math.max(start.x1, end.x1)) / 2,
      text: `${start.text}-${end.text}`,
      start: start.minutes,
      end: end.minutes,
    }));
  }

  // One time per column (start times only).
  return clocks.map((clock) => ({
    cx: (clock.x0 + clock.x1) / 2,
    text: clock.text,
    start: clock.minutes,
  }));
};

const readHeaderColumns = (headerTokens: Token[], textHeight: number): Column[] => {
  const headerLike = headerTokens.filter((token) => {
    const compact = token.text.replace(/[^a-z0-9]/gi, "");
    return (
      HEADER_NUMBER_PATTERN.test(compact) ||
      /\d{1,2}\s*[:.]\s*\d{2}/.test(token.text) ||
      BREAK_PATTERN.test(token.text)
    );
  });

  const entries = groupIntoLines(headerLike)
    .flatMap(
      (line): HeaderEntry[] =>
        readClockColumns(line) ??
        clusterByGap(line, textHeight * 0.6).map((cluster) => ({
          cx: spanOf(cluster).cx,
          text: joinLines(cluster).join(" "),
        })),
    )
    .sort((left, right) => left.cx - right.cx);

  // Header text of one column (period number, time, "Break") is centred on the
  // same spot; the next column's is a full column width away.
  const groups: HeaderEntry[][] = [];
  entries.forEach((entry) => {
    const group = groups[groups.length - 1];
    if (group && entry.cx - median(group.map((item) => item.cx)) <= textHeight * 1.5) {
      group.push(entry);
    } else {
      groups.push([entry]);
    }
  });
  if (groups.length < 2) {
    return [];
  }

  const columns = groups.map((group) => ({
    cx: median(group.map((item) => item.cx)),
    text: group.map((item) => item.text).join(" "),
    start: group.find((item) => item.start !== undefined)?.start,
    end: group.find((item) => item.end !== undefined)?.end,
  }));

  return columns.map((entry) => ({
    cx: entry.cx,
    headerText: entry.text,
    // A 10-15 minute column is a break even when it isn't labelled.
    isBreak:
      BREAK_PATTERN.test(entry.text) ||
      (entry.start !== undefined && entry.end !== undefined && entry.end - entry.start < 25),
    start: entry.start,
    end: entry.end,
  }));
};

const findColumns = ({
  headerTokens,
  bodyChunks,
  textHeight,
}: {
  headerTokens: Token[];
  bodyChunks: Token[][];
  textHeight: number;
}): Column[] => {
  const headerColumns = readHeaderColumns(headerTokens, textHeight);
  if (headerColumns.length >= 2) {
    return headerColumns;
  }

  // No usable header: columns are where cell text lines up across the rows.
  const centers = bodyChunks
    .map((chunk) => {
      const span = spanOf(chunk);
      return { cx: span.cx, width: span.x1 - span.x0 };
    })
    .sort((left, right) => left.cx - right.cx);
  const gapLimit = Math.max(median(centers.map((center) => center.width)) * 0.6, textHeight);
  const groups: number[][] = [];
  centers.forEach((center) => {
    const group = groups[groups.length - 1];
    const last = group?.[group.length - 1];
    if (group && last !== undefined && center.cx - last <= gapLimit) {
      group.push(center.cx);
    } else {
      groups.push([center.cx]);
    }
  });

  return groups.map((group) => ({ cx: median(group), headerText: "", isBreak: false }));
};

interface SubjectKeys {
  subject: Subject;
  codes: string[];
  /** Codes without digits (short names, acronyms), safe to compare loosely. */
  looseCodes: string[];
  name: string;
}

const buildSubjectKeys = (subjects: Subject[]): SubjectKeys[] =>
  subjects.map((subject) => {
    const acronym = subject.name
      .split(/\s+/)
      .filter((word) => word && !STOP_WORDS.has(word.toLowerCase()))
      .map((word) => word[0] ?? "")
      .join("");
    const rawCodes = [subject.code, subject.shortName, acronym].filter(
      (code) => canonical(code).length >= 2,
    );
    return {
      subject,
      codes: rawCodes.map(confusable),
      // CSE1500 and CSE1501 are different courses: codes with digits must match exactly.
      looseCodes: rawCodes.filter((code) => !/\d/.test(code)).map(confusable),
      name: confusable(subject.name),
    };
  });

const matchSubject = (label: string, text: string, keys: SubjectKeys[]): string | undefined => {
  const rawWords = text.split(/[\s/,()[\]|:-]+/).filter((word) => canonical(word).length >= 2);
  const words = rawWords.map(confusable);
  const looseWords = rawWords.filter((word) => !/\d/.test(word)).map(confusable);
  const labelKey = confusable(label);
  const textKey = confusable(text);
  const mentionsLab = /\blab\b/i.test(text);
  let best: { subjectId: string; score: number } | undefined;

  keys.forEach(({ subject, codes, looseCodes, name }) => {
    let score = 0;
    if (labelKey && (codes.includes(labelKey) || labelKey === name)) {
      score = 100;
    } else if (words.some((word) => codes.includes(word))) {
      score = 90;
    } else if (name.length >= 5 && textKey.includes(name)) {
      score = 85;
    } else if (labelKey.length >= 5 && name.startsWith(labelKey)) {
      score = 70;
    } else {
      const fuzzy = Math.max(
        0,
        ...looseWords.flatMap((word) =>
          looseCodes.filter((code) => code.length >= 3).map((code) => similarity(word, code)),
        ),
        labelKey.length >= 5 ? similarity(labelKey, name) : 0,
      );
      if (fuzzy >= 0.75) {
        score = 50 + fuzzy * 20;
      }
    }

    if (score === 0) {
      return;
    }
    if (mentionsLab) {
      score += subject.isLab ? 5 : -5;
    } else if (subject.isLab) {
      score -= 3;
    }
    if (score >= 60 && (!best || score > best.score)) {
      best = { subjectId: subject.id, score };
    }
  });

  return best?.subjectId;
};

/** Maps each class column to an hour: by start time when the photo's timings match the saved ones. */
const mapColumnsToHours = (
  classColumns: Column[],
  hourSlots: HourSlot[],
): { hours: number[]; scannedHourSlots?: HourSlot[] } => {
  const byOrder = classColumns.map((_, index) => index + 1);
  if (!classColumns.every((column) => column.start !== undefined && column.end !== undefined)) {
    return { hours: byOrder };
  }

  const toMinutes = (time: string) => {
    const [hour, minute] = time.split(":").map(Number);
    return (hour ?? 0) * 60 + (minute ?? 0);
  };
  const byTime = classColumns.map((column) =>
    hourSlots.find((slot) => Math.abs(toMinutes(slot.startTime) - (column.start ?? -999)) <= 5)?.hour,
  );
  const increasing = byTime.every(
    (hour, index) => hour !== undefined && (index === 0 || hour > (byTime[index - 1] ?? 0)),
  );
  if (increasing) {
    return { hours: byTime.map((hour) => hour ?? 0) };
  }

  return {
    hours: byOrder,
    scannedHourSlots: classColumns.map((column, index) => ({
      hour: index + 1,
      startTime: formatClock(column.start ?? 0),
      endTime: formatClock(column.end ?? 0),
      isBreak: false,
      isLunch: false,
    })),
  };
};

interface BatchTag {
  family: string;
  number: number;
}

// Batch markers in split cells: "B1", "B2" (tutorial halves) or "Bat1"-"Bat4" (lab batches).
const readBatch = (text: string): BatchTag | undefined => {
  const match = /^(b|bat|batch)[-_ ]?([1-9il|])$/i.exec(text.trim());
  if (!match) {
    return undefined;
  }
  const digit = /[il|]/i.test(match[2] ?? "") ? 1 : Number(match[2]);
  return { family: (match[1] ?? "").toLowerCase() === "b" ? "B" : "Bat", number: digit };
};

// Course codes such as CSE1500 or MAT4011, and practicals such as AIE4002_P.
// Digits misread as letters ("CSE15OO") are put back.
const readCourseCode = (text: string): { code: string; base: string } | undefined => {
  const compact = text.toUpperCase().replace(/[^A-Z0-9_]/g, "");
  const match = /^([A-Z]{2,4})([0-9OISBZ]{3,4})([A-OQ-Z]?)(_?P)?$/.exec(compact);
  if (!match || (match[2] ?? "").replace(/[^0-9]/g, "").length < 2) {
    return undefined;
  }
  const digits = (match[2] ?? "")
    .replace(/O/g, "0")
    .replace(/I/g, "1")
    .replace(/S/g, "5")
    .replace(/B/g, "8")
    .replace(/Z/g, "2");
  const base = `${match[1]}${digits}${match[3]}`;
  return { code: match[4] ? `${base}_P` : base, base };
};

// Room numbers left alone in a cell: "RB01", "LIVL05a", "FFL01/LTL10", "R-204".
const isRoomLike = (text: string): boolean =>
  text
    .replace(/[()[\]]/g, "")
    .split("/")
    .every((part) => /^[A-Z]{1,5}[-_]?\d{1,3}[A-Z]?$/i.test(part.trim()));

/**
 * Reads days, class columns and cell text out of OCR output and matches each
 * cell to a subject. Throws with a user-facing message when it can't find a timetable.
 * `batches` picks the student's batch per family ({ B: 1, Bat: 3 }) in split cells.
 */
export const parseTimetableScan = ({
  ocr,
  subjects,
  hourSlots,
  batches = {},
}: {
  ocr: ScanOcrResult;
  subjects: Subject[];
  hourSlots: HourSlot[];
  batches?: ScanBatchSelection;
}): TimetableScanResult => {
  const { tokens: rawTokens, lines } = toTokens(ocr);
  if (rawTokens.length === 0) {
    throw new Error("No text found in the photo. Try a sharper, well-lit photo.");
  }

  const found = findDayAnchors(rotateTokens(rawTokens, estimateSkew(lines)));
  if (!found) {
    throw new Error(
      "Couldn't find day names (Mon, Tue…) in the photo. Crop to the timetable and try again.",
    );
  }

  const warnings: string[] = [];
  const anchors = fillMissingDays(found.anchors);
  const { tokens } = found;
  const textHeight = median(tokens.map((token) => token.h)) || 1;
  const rowGap =
    median(anchors.slice(1).map((anchor, index) => anchor.cy - (anchors[index]?.cy ?? anchor.cy))) ||
    textHeight * 3;
  const dayColumnRight = Math.max(...found.anchors.map((anchor) => anchor.x1));

  const bands = anchors.map((anchor, index) => {
    const previous = anchors[index - 1];
    const next = anchors[index + 1];
    return {
      day: anchor.day,
      top: previous
        ? Math.max((previous.cy + anchor.cy) / 2, anchor.cy - rowGap * 0.75)
        : anchor.cy - rowGap / 2,
      bottom: next
        ? Math.min((anchor.cy + next.cy) / 2, anchor.cy + rowGap * 0.75)
        : anchor.cy + rowGap / 2,
    };
  });

  const firstTop = bands[0]?.top ?? 0;
  const inBody = (token: Token) =>
    token.x0 > dayColumnRight + textHeight * 0.2 && matchDay(token.text) === undefined;
  const headerTokens = tokens.filter(
    (token) => inBody(token) && token.cy < firstTop && token.cy > firstTop - rowGap * 2.5,
  );
  const rowTokens = bands.map((band) =>
    tokens.filter((token) => inBody(token) && token.cy >= band.top && token.cy < band.bottom),
  );
  // Words of one cell are a space apart; neighbouring cells are further apart.
  const rowChunks = rowTokens.map((row) => clusterByGap(row, textHeight * 0.55));

  const columns = findColumns({ headerTokens, bodyChunks: rowChunks.flat(), textHeight });
  const centers = columns.map((column) => column.cx);
  const nearestColumn = (x: number) =>
    centers.reduce(
      (best, center, index) =>
        Math.abs(center - x) < Math.abs((centers[best] ?? 0) - x) ? index : best,
      0,
    );
  const boundaryBefore = (index: number) =>
    index <= 0 ? -Infinity : ((centers[index - 1] ?? 0) + (centers[index] ?? 0)) / 2;
  const boundaryAfter = (index: number) =>
    index >= centers.length - 1 ? Infinity : ((centers[index] ?? 0) + (centers[index + 1] ?? 0)) / 2;

  /** Which columns text at x0..x1 belongs to; more than one for a merged cell. */
  const placeOnColumns = (x0: number, x1: number, cx: number) => {
    const nearest = nearestColumn(cx);
    const covered = centers
      .map((center, index) => (center >= x0 && center <= x1 ? index : -1))
      .filter((index) => index >= 0);
    if (covered.length >= 2) {
      return { columns: covered, nearest, merged: true };
    }
    const neighbour = cx > (centers[nearest] ?? 0) ? nearest + 1 : nearest - 1;
    const neighbourCenter = centers[neighbour];
    // Text centred on a column line belongs to a cell merged across both.
    if (
      neighbourCenter !== undefined &&
      Math.abs(cx - (centers[nearest] ?? 0)) >
        Math.abs(neighbourCenter - (centers[nearest] ?? 0)) * 0.38
    ) {
      return {
        columns: [Math.min(nearest, neighbour), Math.max(nearest, neighbour)],
        nearest,
        merged: true,
      };
    }
    return { columns: [nearest], nearest, merged: false };
  };

  // Merged "B R E A K" / "Lunch Break" columns read top to bottom.
  columns.forEach((column, index) => {
    const letters = rowTokens
      .flat()
      .filter((token) => nearestColumn(token.cx) === index)
      .sort((left, right) => left.cy - right.cy)
      .map((token) => token.text)
      .join("");
    if (BREAK_PATTERN.test(letters)) {
      column.isBreak = true;
    }
  });

  const classColumns = columns.filter((column) => !column.isBreak);
  if (classColumns.length === 0) {
    throw new Error("Couldn't find the class columns. Crop to the timetable and try again.");
  }
  const { hours, scannedHourSlots } = mapColumnsToHours(classColumns, hourSlots);
  const hoursOf = (columnIndexes: number[]) =>
    columnIndexes
      .map((index) => columns[index])
      .filter((column): column is Column => column !== undefined && !column.isBreak)
      .map((column) => hours[classColumns.indexOf(column)] ?? 0)
      .filter((hour) => hour > 0)
      .sort((left, right) => left - right);

  const keys = buildSubjectKeys(subjects);
  const cells: ScannedCell[] = [];
  const batchOptions = new Map<string, Set<number>>();

  const addCell = (day: WorkingDay, cellHours: number[], text: string, label: string) => {
    const first = cellHours[0];
    if (first === undefined) {
      return;
    }
    const last = cellHours[cellHours.length - 1] ?? first;
    const taken = cells.some(
      (cell) => cell.day === day && cell.hour <= last && cell.hour + cell.span - 1 >= first,
    );
    if (taken) {
      return;
    }
    const subjectId = matchSubject(label, text, keys);
    cells.push({
      day,
      hour: first,
      span: last - first + 1,
      text,
      label,
      subjectId,
      unknownKey: subjectId ? undefined : canonical(label) || canonical(text),
    });
  };

  bands.forEach((band, bandIndex) => {
    const bandTokens = rowTokens[bandIndex] ?? [];
    if (band.day === "Sun") {
      if (bandTokens.length > 0) {
        warnings.push("Sunday classes were skipped; AttendX tracks Monday to Saturday.");
      }
      return;
    }
    const day = band.day;

    // Cells that print a course code (aSc and most college timetables) are read
    // by the code; faculty names and rooms around it are ignored.
    {
      const markers = bandTokens.flatMap((token) => {
        const batch = readBatch(token.text);
        return batch ? [{ token, batch }] : [];
      });
      const codes = bandTokens.flatMap((token) => {
        const course = readCourseCode(token.text);
        if (!course) {
          return [];
        }
        const { columns: placed } = placeOnColumns(token.x0, token.x1, token.cx);
        return [
          {
            token,
            course,
            placed,
            left: boundaryBefore(placed[0] ?? 0),
            right: boundaryAfter(placed[placed.length - 1] ?? 0),
          },
        ];
      });
      // A split cell's batch label sits on its code's line or below it, above the
      // next batch's code, so each label belongs to the nearest code above it.
      const batchOf = new Map<Token, { batch: BatchTag; distance: number }>();
      markers.forEach(({ token: mark, batch }) => {
        const owner = codes
          .filter(
            (code) =>
              mark.cx >= code.left &&
              mark.cx <= code.right &&
              code.token.cy <= mark.cy + code.token.h * 0.6,
          )
          .sort((first, second) => second.token.cy - first.token.cy)[0];
        const distance = owner ? mark.cy - owner.token.cy : Infinity;
        const current = owner ? batchOf.get(owner.token) : undefined;
        if (owner && (!current || distance < current.distance)) {
          batchOf.set(owner.token, { batch, distance });
        }
      });
      const entries = codes.map((code) => ({ ...code, batch: batchOf.get(code.token)?.batch }));

      entries.forEach(({ batch }) => {
        if (batch) {
          batchOptions.set(
            batch.family,
            (batchOptions.get(batch.family) ?? new Set<number>()).add(batch.number),
          );
        }
      });

      const groups = new Map<string, typeof entries>();
      entries
        .filter(({ batch }) => {
          const chosen = batch ? batches[batch.family] : undefined;
          return !batch || chosen === undefined || chosen === batch.number;
        })
        .forEach((entry) => {
          const key = entry.placed.join(",");
          groups.set(key, [...(groups.get(key) ?? []), entry]);
        });

      [...groups.values()].forEach((group) => {
        const sorted = [...group].sort((first, second) => first.token.cy - second.token.cy);
        const codes = [...new Set(sorted.map((entry) => entry.course.code))];
        addCell(day, hoursOf(sorted[0]?.placed ?? []), codes.join(" / "), sorted[0]?.course.base ?? "");
      });
    }

    // Then cells that name the subject instead ("Data Structures", "PHY (R-204)").
    const single = new Map<number, Token[]>();
    const spanning: { columns: number[]; nearest: number; tokens: Token[] }[] = [];
    const nameChunks = (rowChunks[bandIndex] ?? []).filter(
      (chunk) =>
        !chunk.some((token) => readCourseCode(token.text)) &&
        !chunk.every((token) => readBatch(token.text) || isRoomLike(token.text)),
    );
    nameChunks.forEach((chunk) => {
      const { x0, x1, cx } = spanOf(chunk);
      const placement = placeOnColumns(x0, x1, cx);
      if (placement.merged) {
        spanning.push({ columns: placement.columns, nearest: placement.nearest, tokens: chunk });
      } else {
        single.set(placement.nearest, [...(single.get(placement.nearest) ?? []), ...chunk]);
      }
    });

    const merged = new Map<string, { columns: number[]; tokens: Token[] }>();
    spanning.forEach((item) => {
      const free = item.columns.filter((index) => !single.has(index));
      if (free.length <= 1) {
        single.set(item.nearest, [...(single.get(item.nearest) ?? []), ...item.tokens]);
        return;
      }
      const key = free.join(",");
      merged.set(key, {
        columns: free,
        tokens: [...(merged.get(key)?.tokens ?? []), ...item.tokens],
      });
    });

    [
      ...[...single.entries()].map(([index, groupTokens]) => ({
        columns: [index],
        tokens: groupTokens,
      })),
      ...merged.values(),
    ].forEach((group) => {
      const lineTexts = joinLines(group.tokens);
      const text = lineTexts.join(" / ");
      if (EMPTY_CELL_PATTERN.test(canonical(text))) {
        return;
      }
      // Prefer the line naming a known subject over a faculty name or room above it.
      const labelLine =
        lineTexts.find((line) => matchSubject(cleanLabel(line), line, keys)) ?? lineTexts[0] ?? text;
      addCell(day, hoursOf(group.columns), text, cleanLabel(labelLine));
    });
  });

  cells.sort((left, right) =>
    left.day === right.day
      ? left.hour - right.hour
      : WORKING_DAYS.indexOf(left.day) - WORKING_DAYS.indexOf(right.day),
  );

  const unknownMap = new Map<string, UnknownScanLabel>();
  cells.forEach((cell) => {
    if (!cell.unknownKey) {
      return;
    }
    const existing = unknownMap.get(cell.unknownKey);
    unknownMap.set(cell.unknownKey, {
      key: cell.unknownKey,
      label: existing?.label ?? cell.label,
      count: (existing?.count ?? 0) + 1,
      isLab: (existing?.isLab ?? false) || /\blab\b/i.test(cell.text),
    });
  });

  return {
    days: WORKING_DAYS.filter((day) => anchors.some((anchor) => anchor.day === day)),
    columnCount: classColumns.length,
    cells,
    unknownLabels: [...unknownMap.values()].sort((left, right) => right.count - left.count),
    batchGroups: [...batchOptions.entries()]
      .sort(([left], [right]) => left.length - right.length)
      .map(([family, options]) => ({
        family,
        options: [...options].sort((left, right) => left - right),
      })),
    scannedHourSlots,
    warnings,
  };
};

export const getScanCellKey = (cell: { day: WorkingDay; hour: number }): string =>
  `${cell.day}_${cell.hour}`;

/** The subject a cell ends up with, after the user's choices. */
export const resolveScanCell = ({
  cell,
  unknownChoices,
  cellChoices,
}: {
  cell: ScannedCell;
  unknownChoices: Record<string, ScanChoice>;
  cellChoices: Record<string, ScanChoice>;
}): ScanChoice => {
  const override = cellChoices[getScanCellKey(cell)];
  if (override) {
    return override;
  }
  if (cell.subjectId) {
    return { kind: "subject", subjectId: cell.subjectId };
  }
  return (cell.unknownKey ? unknownChoices[cell.unknownKey] : undefined) ?? { kind: "new" };
};

const newSubjectFromLabel = (unknown: UnknownScanLabel, colorIndex: number): Subject => {
  const code = canonical(unknown.label).slice(0, 10) || "SUBJ";
  return {
    id: generateId("subject"),
    code,
    name: unknown.label.trim() || code,
    shortName: code.slice(0, 8),
    isLab: unknown.isLab,
    color: SUBJECT_COLOR_PALETTE[colorIndex % SUBJECT_COLOR_PALETTE.length] ?? "#1a5fa8",
  };
};

/**
 * Turns a reviewed scan into the same import plan the timetable share uses.
 * Days in the photo replace those days' classes; other days stay as they are.
 */
export const buildTimetableScanPlan = ({
  result,
  subjects,
  timetable,
  hourSlots,
  workingDays,
  unknownChoices,
  cellChoices,
  useScannedTimings,
}: {
  result: TimetableScanResult;
  subjects: Subject[];
  timetable: TimetableSlot[];
  hourSlots: HourSlot[];
  workingDays: WorkingDay[];
  unknownChoices: Record<string, ScanChoice>;
  cellChoices: Record<string, ScanChoice>;
  useScannedTimings: boolean;
}): TimetableImportPlan => {
  const nextHourSlots =
    useScannedTimings && result.scannedHourSlots ? result.scannedHourSlots : hourSlots;
  const hourCount = nextHourSlots.length;
  const createdByKey = new Map<string, Subject>();
  const createdSubjects: Subject[] = [];
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  const subjectAt = new Map<string, string>();
  let matchedCount = 0;
  let droppedSlotCount = 0;

  const placeSubject = (day: WorkingDay, hour: number, subjectId: string) => {
    if (hour > hourCount) {
      droppedSlotCount += 1;
      return;
    }
    subjectAt.set(getScanCellKey({ day, hour }), subjectId);
  };

  result.cells.forEach((cell) => {
    const choice = resolveScanCell({ cell, unknownChoices, cellChoices });
    let subject: Subject | undefined;

    if (choice.kind === "subject") {
      subject = subjectById.get(choice.subjectId);
      if (subject && cell.subjectId === choice.subjectId) {
        matchedCount += 1;
      }
    } else if (choice.kind === "new") {
      const key = cell.unknownKey ?? canonical(cell.label);
      subject = createdByKey.get(key);
      if (!subject) {
        const unknown = result.unknownLabels.find((item) => item.key === key) ?? {
          key,
          label: cell.label,
          count: 1,
          isLab: /\blab\b/i.test(cell.text),
        };
        subject = newSubjectFromLabel(unknown, subjects.length + createdSubjects.length);
        createdByKey.set(key, subject);
        createdSubjects.push(subject);
      }
    }

    if (subject) {
      for (let offset = 0; offset < cell.span; offset += 1) {
        placeSubject(cell.day, cell.hour + offset, subject.id);
      }
    }
  });

  // Choices for hours that had no cell of their own (empty, or the second hour
  // of a merged cell).
  const cellStarts = new Set(result.cells.map(getScanCellKey));
  Object.entries(cellChoices).forEach(([key, choice]) => {
    if (cellStarts.has(key)) {
      return;
    }
    if (choice.kind === "free") {
      subjectAt.delete(key);
    } else if (choice.kind === "subject" && subjectById.has(choice.subjectId)) {
      subjectAt.set(key, choice.subjectId);
    }
  });

  const lookup = (id: string) =>
    subjectById.get(id) ?? createdSubjects.find((item) => item.id === id);
  const scannedSlots: TimetableSlot[] = [];

  result.days.forEach((day) => {
    let hour = 1;
    while (hour <= hourCount) {
      const key = getScanCellKey({ day, hour });
      const subjectId = subjectAt.get(key);
      const subject = subjectId ? lookup(subjectId) : undefined;
      if (!subjectId || !subject) {
        hour += 1;
        continue;
      }
      const continuesBlock = subjectAt.get(getScanCellKey({ day, hour: hour - 1 })) === subjectId;
      const nextId = subjectAt.get(getScanCellKey({ day, hour: hour + 1 }));
      const hasNextHour = hour < hourCount;
      const base = { id: key, day, hour, subjectId };

      if (!continuesBlock && hasNextHour && nextId === subjectId) {
        // Two hours of the same subject: one lab or double-period slot.
        scannedSlots.push({ ...base, isDouble: !subject.isLab, isLab: subject.isLab });
        hour += 2;
      } else if (!continuesBlock && subject.isLab && hasNextHour && nextId === undefined) {
        // A lab in a single cell with a free hour after it: labs run two hours.
        scannedSlots.push({ ...base, isDouble: false, isLab: true });
        hour += 2;
      } else {
        scannedSlots.push({ ...base, isDouble: false, isLab: false });
        hour += 1;
      }
    }
  });

  const keptSlots = timetable.filter(
    (slot) => !result.days.includes(slot.day) && slot.hour <= hourCount,
  );

  return {
    createdSubjects,
    timetable: [...keptSlots, ...scannedSlots].sort((left, right) =>
      left.day === right.day
        ? left.hour - right.hour
        : WORKING_DAYS.indexOf(left.day) - WORKING_DAYS.indexOf(right.day),
    ),
    hourSlots: nextHourSlots,
    workingDays: WORKING_DAYS.filter((day) => workingDays.includes(day) || result.days.includes(day)),
    matchedCount,
    createdCount: createdSubjects.length,
    slotCount: scannedSlots.length,
    droppedSlotCount,
  };
};
