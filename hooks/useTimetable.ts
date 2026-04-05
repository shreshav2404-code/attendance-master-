import { getWorkingDayForDate } from "@/lib/utils";
import { useSubjectStore } from "@/store/subjectStore";

export const useTimetable = () => {
  const timetable = useSubjectStore((state) => state.timetable);

  return {
    timetable,
    setTimetable: useSubjectStore((state) => state.setTimetable),
    upsertTimetableSlot: useSubjectStore((state) => state.upsertTimetableSlot),
    removeTimetableSlot: useSubjectStore((state) => state.removeTimetableSlot),
    getSlotsForDay: (day: string) =>
      timetable.filter((slot) => slot.day === day).sort((left, right) => left.hour - right.hour),
    getSlotsForDate: (date: string) => {
      const workingDay = getWorkingDayForDate(date);
      return timetable
        .filter((slot) => slot.day === workingDay)
        .sort((left, right) => left.hour - right.hour);
    },
  };
};
