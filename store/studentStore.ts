import { create } from "zustand";

import {
  DEFAULT_EXAM_WEEK_SETTINGS,
  DEFAULT_HOUR_SLOTS,
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_WORKING_DAYS,
} from "@/lib/constants";
import {
  loadHourSlotBundle,
  loadOnboarded,
  loadStudentBundle,
  saveHourSlotBundle,
  saveOnboarded,
  saveStudentBundle,
} from "@/lib/storage";
import type {
  ExamWeekSettings,
  HourSlot,
  NotificationSettings,
  Student,
  StudentBundle,
  WorkingDay,
} from "@/types";

interface StudentStoreState {
  hydrated: boolean;
  hydrating: boolean;
  student: Student | null;
  hourSlots: HourSlot[];
  workingDays: WorkingDay[];
  onboarded: boolean;
  notificationSettings: NotificationSettings;
  examWeek: ExamWeekSettings;
  lastSyncedAt?: string;
  hydrate: () => Promise<void>;
  setStudent: (student: Student | null) => Promise<void>;
  updateStudent: (updates: Partial<Student>) => Promise<void>;
  setHourSlots: (hourSlots: HourSlot[], workingDays: WorkingDay[]) => Promise<void>;
  setNotificationSettings: (
    notificationSettings: NotificationSettings,
  ) => Promise<void>;
  setExamWeek: (examWeek: ExamWeekSettings) => Promise<void>;
  setOnboarded: (onboarded: boolean) => Promise<void>;
  setLastSyncedAt: (lastSyncedAt?: string) => Promise<void>;
}

const buildStudentBundle = (
  state: Pick<
    StudentStoreState,
    "student" | "notificationSettings" | "examWeek" | "lastSyncedAt"
  >,
): StudentBundle => ({
  student: state.student,
  notificationSettings: state.notificationSettings,
  examWeek: state.examWeek,
  lastSyncedAt: state.lastSyncedAt,
});

export const useStudentStore = create<StudentStoreState>((set, get) => ({
  hydrated: false,
  hydrating: false,
  student: null,
  hourSlots: DEFAULT_HOUR_SLOTS,
  workingDays: DEFAULT_WORKING_DAYS,
  onboarded: false,
  notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
  examWeek: DEFAULT_EXAM_WEEK_SETTINGS,
  lastSyncedAt: undefined,
  hydrate: async () => {
    if (get().hydrated || get().hydrating) {
      return;
    }

    set({ hydrating: true });
    const [studentBundle, hourSlotBundle, onboarded] = await Promise.all([
      loadStudentBundle(),
      loadHourSlotBundle(),
      loadOnboarded(),
    ]);

    set({
      hydrated: true,
      hydrating: false,
      student: studentBundle.student,
      hourSlots: hourSlotBundle.hourSlots,
      workingDays: hourSlotBundle.workingDays,
      onboarded,
      notificationSettings: studentBundle.notificationSettings,
      examWeek: studentBundle.examWeek,
      lastSyncedAt: studentBundle.lastSyncedAt,
    });
  },
  setStudent: async (student) => {
    set({ student });
    await saveStudentBundle(buildStudentBundle(get()));
  },
  updateStudent: async (updates) => {
    const currentStudent = get().student;

    if (!currentStudent) {
      return;
    }

    set({
      student: {
        ...currentStudent,
        ...updates,
      },
    });
    await saveStudentBundle(buildStudentBundle(get()));
  },
  setHourSlots: async (hourSlots, workingDays) => {
    set({ hourSlots, workingDays });
    await saveHourSlotBundle({ hourSlots, workingDays });
  },
  setNotificationSettings: async (notificationSettings) => {
    set({ notificationSettings });
    await saveStudentBundle(buildStudentBundle(get()));
  },
  setExamWeek: async (examWeek) => {
    set({ examWeek });
    await saveStudentBundle(buildStudentBundle(get()));
  },
  setOnboarded: async (onboarded) => {
    set({ onboarded });
    await saveOnboarded(onboarded);
  },
  setLastSyncedAt: async (lastSyncedAt) => {
    set({ lastSyncedAt });
    await saveStudentBundle(buildStudentBundle(get()));
  },
}));
