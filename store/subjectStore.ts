import { create } from "zustand";

import {
  loadSubjects,
  loadTimetable,
  saveSubjects,
  saveTimetable,
} from "@/lib/storage";
import type { Subject, TimetableSlot } from "@/types";

interface SubjectStoreState {
  hydrated: boolean;
  hydrating: boolean;
  subjects: Subject[];
  timetable: TimetableSlot[];
  hydrate: () => Promise<void>;
  setSubjects: (subjects: Subject[]) => Promise<void>;
  addSubject: (subject: Subject) => Promise<void>;
  updateSubject: (subject: Subject) => Promise<void>;
  removeSubject: (subjectId: string) => Promise<void>;
  setTimetable: (timetable: TimetableSlot[]) => Promise<void>;
  upsertTimetableSlot: (slot: TimetableSlot) => Promise<void>;
  removeTimetableSlot: (slotId: string) => Promise<void>;
}

export const useSubjectStore = create<SubjectStoreState>((set, get) => ({
  hydrated: false,
  hydrating: false,
  subjects: [],
  timetable: [],
  hydrate: async () => {
    if (get().hydrated || get().hydrating) {
      return;
    }

    set({ hydrating: true });
    const [subjects, timetable] = await Promise.all([loadSubjects(), loadTimetable()]);
    set({
      hydrated: true,
      hydrating: false,
      subjects,
      timetable,
    });
  },
  setSubjects: async (subjects) => {
    set({ subjects });
    await saveSubjects(subjects);
  },
  addSubject: async (subject) => {
    const subjects = [...get().subjects, subject];
    set({ subjects });
    await saveSubjects(subjects);
  },
  updateSubject: async (subject) => {
    const subjects = get().subjects.map((item) =>
      item.id === subject.id ? subject : item,
    );
    set({ subjects });
    await saveSubjects(subjects);
  },
  removeSubject: async (subjectId) => {
    const subjects = get().subjects.filter((subject) => subject.id !== subjectId);
    const timetable = get().timetable.filter((slot) => slot.subjectId !== subjectId);
    set({ subjects, timetable });
    await Promise.all([saveSubjects(subjects), saveTimetable(timetable)]);
  },
  setTimetable: async (timetable) => {
    set({ timetable });
    await saveTimetable(timetable);
  },
  upsertTimetableSlot: async (slot) => {
    const timetable = [
      ...get().timetable.filter((item) => item.id !== slot.id),
      slot,
    ].sort((left, right) =>
      left.day === right.day ? left.hour - right.hour : left.day.localeCompare(right.day),
    );
    set({ timetable });
    await saveTimetable(timetable);
  },
  removeTimetableSlot: async (slotId) => {
    const timetable = get().timetable.filter((slot) => slot.id !== slotId);
    set({ timetable });
    await saveTimetable(timetable);
  },
}));
