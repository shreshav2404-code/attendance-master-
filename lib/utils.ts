import { format, isWithinInterval, parseISO } from "date-fns";

import type {
  DailyLog,
  HourSlot,
  TimetableSlot,
  WorkingDateOverrides,
  WorkingDay,
} from "@/types";

export const roundToTwo = (value: number): number =>
  Number.isFinite(value) ? Number(value.toFixed(2)) : 0;

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const generateId = (prefix: string): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export const formatDateLabel = (
  date: string | Date,
  pattern = "dd MMM yyyy",
): string => format(typeof date === "string" ? parseISO(date) : date, pattern);

export const getTodayKey = (): string => format(new Date(), "yyyy-MM-dd");

export const getWorkingDayForDate = (date: string): WorkingDay => {
  const weekday = format(parseISO(date), "EEE");
  return weekday.slice(0, 3) as WorkingDay;
};

export const isDateWorking = ({
  date,
  workingDays,
  workingDateOverrides,
}: {
  date: string;
  workingDays: WorkingDay[];
  workingDateOverrides: WorkingDateOverrides;
}): boolean => {
  const overriddenValue = workingDateOverrides[date];

  if (overriddenValue !== undefined) {
    return overriddenValue;
  }

  const weekday = format(parseISO(date), "EEE").slice(0, 3);
  return workingDays.includes(weekday as WorkingDay);
};

export const isDateInRange = (
  date: string,
  startDate: string,
  endDate: string,
): boolean =>
  isWithinInterval(parseISO(date), {
    start: parseISO(startDate),
    end: parseISO(endDate),
  });

export const sortTimetableSlots = (slots: TimetableSlot[]): TimetableSlot[] =>
  [...slots].sort((left, right) => left.hour - right.hour);

export const sortLogsByDate = (logs: DailyLog[]): DailyLog[] =>
  [...logs].sort((left, right) =>
    left.date === right.date ? left.createdAt.localeCompare(right.createdAt) : left.date.localeCompare(right.date),
  );

export const getHourSlotLabel = (slot: HourSlot): string =>
  `${slot.startTime} - ${slot.endTime}`;

export const isCoveredByDoubleSlot = (
  slots: TimetableSlot[],
  day: WorkingDay,
  hour: number,
): boolean =>
  slots.some(
    (slot) =>
      slot.day === day &&
      (slot.isDouble || slot.isLab) &&
      slot.hour + 1 === hour,
  );

export const toRecord = <T extends string | number, V>(
  entries: readonly (readonly [T, V])[],
): Record<T, V> => Object.fromEntries(entries) as Record<T, V>;
