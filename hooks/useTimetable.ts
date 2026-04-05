import { getWorkingDayForDate, isDateWorking } from "@/lib/utils";
import { useStudentStore } from "@/store/studentStore";
import { useSubjectStore } from "@/store/subjectStore";

export const useTimetable = () => {
  const timetable = useSubjectStore((state) => state.timetable);
  const workingDays = useStudentStore((state) => state.workingDays);
  const workingDateOverrides = useStudentStore(
    (state) => state.workingDateOverrides,
  );

  const checkIfWorkingDate = (date: string) =>
    isDateWorking({
      date,
      workingDays,
      workingDateOverrides,
    });

  return {
    timetable,
    isWorkingDate: checkIfWorkingDate,
    setTimetable: useSubjectStore((state) => state.setTimetable),
    upsertTimetableSlot: useSubjectStore((state) => state.upsertTimetableSlot),
    removeTimetableSlot: useSubjectStore((state) => state.removeTimetableSlot),
    getSlotsForDay: (day: string) =>
      timetable.filter((slot) => slot.day === day).sort((left, right) => left.hour - right.hour),
    getSlotsForDate: (date: string) => {
      if (!checkIfWorkingDate(date)) {
        return [];
      }

      const workingDay = getWorkingDayForDate(date);
      return timetable
        .filter((slot) => slot.day === workingDay)
        .sort((left, right) => left.hour - right.hour);
    },
  };
};
