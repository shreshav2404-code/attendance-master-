import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MMKV as MMKVType } from "react-native-mmkv";

import {
  DEFAULT_EXAM_WEEK_SETTINGS,
  DEFAULT_HOUR_SLOTS,
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_WORKING_DATE_OVERRIDES,
  DEFAULT_WORKING_DAYS,
  STORAGE_KEYS,
} from "@/lib/constants";
import type {
  AppBackupPayload,
  DailyLog,
  HourSlotBundle,
  ODEvent,
  StudentBundle,
  Subject,
  TimetableSlot,
} from "@/types";

type MMKVLike = Pick<
  MMKVType,
  "clearAll" | "contains" | "delete" | "getString" | "set"
>;

const createMMKVStorage = (): MMKVLike | null => {
  try {
    const mmkvModule = require("react-native-mmkv") as typeof import("react-native-mmkv");
    return new mmkvModule.MMKV({ id: "attendx" });
  } catch {
    return null;
  }
};

const mmkvStorage = createMMKVStorage();

const defaultStudentBundle: StudentBundle = {
  student: null,
  notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
  examWeek: DEFAULT_EXAM_WEEK_SETTINGS,
  officialSyncSnapshotBySubject: {},
};

const defaultHourSlotBundle: HourSlotBundle = {
  hourSlots: DEFAULT_HOUR_SLOTS,
  workingDays: DEFAULT_WORKING_DAYS,
  workingDateOverrides: DEFAULT_WORKING_DATE_OVERRIDES,
};

const readMMKV = (key: string): string | null => {
  if (mmkvStorage?.contains(key)) {
    return mmkvStorage.getString(key) ?? null;
  }

  return null;
};

const writeMMKV = (key: string, value: string): void => {
  mmkvStorage?.set(key, value);
};

const removeMMKV = (key: string): void => {
  mmkvStorage?.delete(key);
};

const readJson = async <T>(key: string, fallback: T): Promise<T> => {
  const cachedValue = readMMKV(key);

  if (cachedValue) {
    return JSON.parse(cachedValue) as T;
  }

  const persistedValue = await AsyncStorage.getItem(key);

  if (!persistedValue) {
    return fallback;
  }

  writeMMKV(key, persistedValue);
  return JSON.parse(persistedValue) as T;
};

const writeJson = async <T>(key: string, value: T): Promise<void> => {
  const serializedValue = JSON.stringify(value);

  writeMMKV(key, serializedValue);
  await AsyncStorage.setItem(key, serializedValue);
};

export const loadStudentBundle = async (): Promise<StudentBundle> => {
  const studentBundle = await readJson<StudentBundle>(
    STORAGE_KEYS.student,
    defaultStudentBundle,
  );

  return {
    ...studentBundle,
    notificationSettings:
      studentBundle.notificationSettings ?? DEFAULT_NOTIFICATION_SETTINGS,
    examWeek: studentBundle.examWeek ?? DEFAULT_EXAM_WEEK_SETTINGS,
    officialSyncSnapshotBySubject:
      studentBundle.officialSyncSnapshotBySubject ?? {},
  };
};

export const saveStudentBundle = async (bundle: StudentBundle): Promise<void> =>
  writeJson(STORAGE_KEYS.student, bundle);

export const loadSubjects = async (): Promise<Subject[]> =>
  readJson<Subject[]>(STORAGE_KEYS.subjects, []);

export const saveSubjects = async (subjects: Subject[]): Promise<void> =>
  writeJson(STORAGE_KEYS.subjects, subjects);

export const loadHourSlotBundle = async (): Promise<HourSlotBundle> => {
  const hourSlotBundle = await readJson<HourSlotBundle>(
    STORAGE_KEYS.hourSlots,
    defaultHourSlotBundle,
  );

  return {
    hourSlots: hourSlotBundle.hourSlots ?? DEFAULT_HOUR_SLOTS,
    workingDays: hourSlotBundle.workingDays ?? DEFAULT_WORKING_DAYS,
    workingDateOverrides:
      hourSlotBundle.workingDateOverrides ?? DEFAULT_WORKING_DATE_OVERRIDES,
  };
};

export const saveHourSlotBundle = async (
  hourSlotBundle: HourSlotBundle,
): Promise<void> => writeJson(STORAGE_KEYS.hourSlots, hourSlotBundle);

export const loadTimetable = async (): Promise<TimetableSlot[]> =>
  readJson<TimetableSlot[]>(STORAGE_KEYS.timetable, []);

export const saveTimetable = async (timetable: TimetableSlot[]): Promise<void> =>
  writeJson(STORAGE_KEYS.timetable, timetable);

export const loadDailyLogs = async (): Promise<DailyLog[]> =>
  readJson<DailyLog[]>(STORAGE_KEYS.dailyLogs, []);

export const saveDailyLogs = async (dailyLogs: DailyLog[]): Promise<void> =>
  writeJson(STORAGE_KEYS.dailyLogs, dailyLogs);

export const loadODEvents = async (): Promise<ODEvent[]> =>
  readJson<ODEvent[]>(STORAGE_KEYS.odEvents, []);

export const saveODEvents = async (odEvents: ODEvent[]): Promise<void> =>
  writeJson(STORAGE_KEYS.odEvents, odEvents);

export const loadOnboarded = async (): Promise<boolean> =>
  readJson<boolean>(STORAGE_KEYS.onboarded, false);

export const saveOnboarded = async (onboarded: boolean): Promise<void> =>
  writeJson(STORAGE_KEYS.onboarded, onboarded);

export const exportBackup = async (): Promise<AppBackupPayload> => {
  const [studentBundle, hourSlotBundle, subjects, timetable, dailyLogs, odEvents, onboarded] =
    await Promise.all([
      loadStudentBundle(),
      loadHourSlotBundle(),
      loadSubjects(),
      loadTimetable(),
      loadDailyLogs(),
      loadODEvents(),
      loadOnboarded(),
    ]);

  return {
    studentBundle,
    hourSlotBundle,
    subjects,
    timetable,
    dailyLogs,
    odEvents,
    onboarded,
  };
};

export const restoreBackup = async (backup: AppBackupPayload): Promise<void> => {
  await Promise.all([
    saveStudentBundle(backup.studentBundle),
    saveHourSlotBundle(backup.hourSlotBundle),
    saveSubjects(backup.subjects),
    saveTimetable(backup.timetable),
    saveDailyLogs(backup.dailyLogs),
    saveODEvents(backup.odEvents),
    saveOnboarded(backup.onboarded),
  ]);
};

export const clearAllStorage = async (): Promise<void> => {
  await Promise.all(
    Object.values(STORAGE_KEYS).map(async (key) => {
      removeMMKV(key);
      await AsyncStorage.removeItem(key);
    }),
  );
};
