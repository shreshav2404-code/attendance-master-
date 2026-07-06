import {
  compressToBase64,
  decompressFromBase64,
} from "lz-string";
import { z } from "zod";

import { SUBJECT_COLOR_PALETTE, WORKING_DAYS } from "@/lib/constants";
import { generateId } from "@/lib/utils";
import type {
  HourSlot,
  Subject,
  TimetableImportPlan,
  TimetableSharePayload,
  TimetableSlot,
  WorkingDay,
} from "@/types";

export const TIMETABLE_SHARE_PREFIX = "ATTX-TT1:";
const CURRENT_SHARE_VERSION = 1;

const workingDaySchema = z.enum([
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
]);

const hourSlotSchema = z.object({
  hour: z.number().int(),
  startTime: z.string(),
  endTime: z.string(),
  isBreak: z.boolean(),
  isLunch: z.boolean(),
});

const shareSubjectSchema = z.object({
  code: z.string(),
  name: z.string(),
  shortName: z.string(),
  isLab: z.boolean(),
  color: z.string(),
});

const shareSlotSchema = z.object({
  day: workingDaySchema,
  hour: z.number().int(),
  subjectIndex: z.number().int(),
  isDouble: z.boolean(),
  isLab: z.boolean(),
});

const sharePayloadSchema = z.object({
  version: z.number().int(),
  workingDays: z.array(workingDaySchema),
  hourSlots: z.array(hourSlotSchema),
  subjects: z.array(shareSubjectSchema),
  slots: z.array(shareSlotSchema),
});

const normalizeText = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const deriveShortName = (name: string, code: string): string => {
  if (code.trim().length > 0) {
    return code.replace(/\s+/g, "").slice(0, 8).toUpperCase();
  }

  const tokens = name.split(" ").map((token) => token.trim()).filter(Boolean);
  if (tokens.length === 0) {
    return "SUBJ";
  }

  return tokens
    .map((token) => token[0])
    .join("")
    .slice(0, 8)
    .toUpperCase();
};

export const encodeTimetableShare = ({
  subjects,
  timetable,
  hourSlots,
  workingDays,
}: {
  subjects: Subject[];
  timetable: TimetableSlot[];
  hourSlots: HourSlot[];
  workingDays: WorkingDay[];
}): string => {
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));

  // Only ship subjects actually used by a slot, in first-seen order.
  const usedSubjects: Subject[] = [];
  const indexById = new Map<string, number>();
  timetable.forEach((slot) => {
    if (indexById.has(slot.subjectId)) {
      return;
    }
    const subject = subjectById.get(slot.subjectId);
    if (!subject) {
      return;
    }
    indexById.set(slot.subjectId, usedSubjects.length);
    usedSubjects.push(subject);
  });

  const payload: TimetableSharePayload = {
    version: CURRENT_SHARE_VERSION,
    workingDays,
    hourSlots,
    subjects: usedSubjects.map((subject) => ({
      code: subject.code,
      name: subject.name,
      shortName: subject.shortName,
      isLab: subject.isLab,
      color: subject.color,
    })),
    slots: timetable
      .filter((slot) => indexById.has(slot.subjectId))
      .map((slot) => ({
        day: slot.day,
        hour: slot.hour,
        subjectIndex: indexById.get(slot.subjectId) as number,
        isDouble: slot.isDouble,
        isLab: slot.isLab,
      })),
  };

  return TIMETABLE_SHARE_PREFIX + compressToBase64(JSON.stringify(payload));
};

const INVALID_CODE_MESSAGE =
  "This is not a valid AttendX timetable code. Ask the sender to copy it again.";

export const decodeTimetableShare = (raw: string): TimetableSharePayload => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error(INVALID_CODE_MESSAGE);
  }

  const body = trimmed.startsWith(TIMETABLE_SHARE_PREFIX)
    ? trimmed.slice(TIMETABLE_SHARE_PREFIX.length)
    : trimmed;

  let json: string | null = null;
  try {
    json = decompressFromBase64(body);
  } catch {
    throw new Error(INVALID_CODE_MESSAGE);
  }

  if (!json) {
    throw new Error(INVALID_CODE_MESSAGE);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("This timetable code looks corrupted or incomplete.");
  }

  const result = sharePayloadSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      "This timetable code is from an unsupported or newer app version.",
    );
  }

  return result.data;
};

export const buildTimetableImportPlan = ({
  payload,
  existingSubjects,
}: {
  payload: TimetableSharePayload;
  existingSubjects: Subject[];
}): TimetableImportPlan => {
  const byCode = new Map<string, Subject>();
  const byName = new Map<string, Subject>();
  existingSubjects.forEach((subject) => {
    byCode.set(normalizeText(subject.code), subject);
    byName.set(normalizeText(subject.name), subject);
  });

  const createdSubjects: Subject[] = [];
  const resolvedIds: (string | undefined)[] = [];
  let matchedCount = 0;
  let createdCount = 0;

  payload.subjects.forEach((shared, index) => {
    const normalizedCode = normalizeText(shared.code);
    const normalizedName = normalizeText(shared.name);

    const codeMatch = normalizedCode ? byCode.get(normalizedCode) : undefined;
    const nameMatch =
      !codeMatch && normalizedName ? byName.get(normalizedName) : undefined;
    const match = codeMatch ?? nameMatch;

    if (match) {
      resolvedIds[index] = match.id;
      matchedCount += 1;
      return;
    }

    const code =
      shared.code.trim().length > 0
        ? shared.code.trim().toUpperCase()
        : `SUBJ${String(index + 1).padStart(3, "0")}`;
    const name = shared.name.trim() || shared.code.trim() || "Subject";
    const created: Subject = {
      id: generateId("subject"),
      code,
      name,
      shortName: shared.shortName.trim() || deriveShortName(name, code),
      isLab: shared.isLab,
      color:
        shared.color.trim() ||
        SUBJECT_COLOR_PALETTE[
          (existingSubjects.length + createdCount) % SUBJECT_COLOR_PALETTE.length
        ] ||
        "#1a5fa8",
    };

    createdSubjects.push(created);
    byCode.set(normalizeText(created.code), created);
    byName.set(normalizeText(created.name), created);
    resolvedIds[index] = created.id;
    createdCount += 1;
  });

  let droppedSlotCount = 0;
  const timetable: TimetableSlot[] = [];
  payload.slots.forEach((slot) => {
    const subjectId = resolvedIds[slot.subjectIndex];
    if (!subjectId) {
      droppedSlotCount += 1;
      return;
    }

    timetable.push({
      id: `${slot.day}_${slot.hour}`,
      day: slot.day,
      hour: slot.hour,
      subjectId,
      isDouble: slot.isDouble,
      isLab: slot.isLab,
    });
  });

  timetable.sort((left, right) =>
    left.day === right.day
      ? left.hour - right.hour
      : left.day.localeCompare(right.day),
  );

  const workingDays =
    payload.workingDays.length > 0 ? payload.workingDays : WORKING_DAYS;

  return {
    createdSubjects,
    timetable,
    hourSlots: payload.hourSlots,
    workingDays,
    matchedCount,
    createdCount,
    slotCount: timetable.length,
    droppedSlotCount,
  };
};
