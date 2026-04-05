import { useStudentStore } from "@/store/studentStore";

export const useStudent = () => {
  const student = useStudentStore((state) => state.student);
  const hourSlots = useStudentStore((state) => state.hourSlots);
  const workingDays = useStudentStore((state) => state.workingDays);
  const onboarded = useStudentStore((state) => state.onboarded);
  const notificationSettings = useStudentStore(
    (state) => state.notificationSettings,
  );
  const examWeek = useStudentStore((state) => state.examWeek);
  const lastSyncedAt = useStudentStore((state) => state.lastSyncedAt);
  const hydrated = useStudentStore((state) => state.hydrated);

  return {
    student,
    hourSlots,
    workingDays,
    onboarded,
    notificationSettings,
    examWeek,
    lastSyncedAt,
    hydrated,
    hydrate: useStudentStore((state) => state.hydrate),
    setStudent: useStudentStore((state) => state.setStudent),
    updateStudent: useStudentStore((state) => state.updateStudent),
    setHourSlots: useStudentStore((state) => state.setHourSlots),
    setNotificationSettings: useStudentStore(
      (state) => state.setNotificationSettings,
    ),
    setExamWeek: useStudentStore((state) => state.setExamWeek),
    setOnboarded: useStudentStore((state) => state.setOnboarded),
    setLastSyncedAt: useStudentStore((state) => state.setLastSyncedAt),
  };
};
