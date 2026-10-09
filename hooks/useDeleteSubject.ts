import { confirmAction } from "@/lib/confirm";
import { useAttendanceStore } from "@/store/attendanceStore";
import { useODStore } from "@/store/odStore";
import { useStudentStore } from "@/store/studentStore";
import { useSubjectStore } from "@/store/subjectStore";
import type { Subject } from "@/types";

// Deleting a subject also removes everything that belongs to it, so nothing is
// left behind pointing at a subject that no longer exists. Asks first when the
// subject already has attendance or OD history. Resolves to true when deleted.
export const useDeleteSubject = () => {
  const removeSubject = useSubjectStore((state) => state.removeSubject);

  return async (subject: Subject): Promise<boolean> => {
    const { dailyLogs, setDailyLogs } = useAttendanceStore.getState();
    const { odEvents, setODEvents } = useODStore.getState();
    const hasHistory =
      dailyLogs.some((log) => log.subjectId === subject.id) ||
      odEvents.some((event) =>
        event.subjects.some((item) => item.subjectId === subject.id),
      );

    if (
      hasHistory &&
      !(await confirmAction({
        title: `Delete ${subject.name}?`,
        message:
          "Its timetable classes, attendance history and OD hours will be removed too. This can't be undone.",
      }))
    ) {
      return false;
    }

    await removeSubject(subject.id);

    if (hasHistory) {
      await setDailyLogs(dailyLogs.filter((log) => log.subjectId !== subject.id));
      await setODEvents(
        odEvents
          .map((event) => ({
            ...event,
            subjects: event.subjects.filter((item) => item.subjectId !== subject.id),
          }))
          .filter((event) => event.subjects.length > 0),
      );
    }

    const { officialSyncSnapshotBySubject, setOfficialSyncSnapshotBySubject } =
      useStudentStore.getState();

    if (officialSyncSnapshotBySubject[subject.id]) {
      await setOfficialSyncSnapshotBySubject(
        Object.fromEntries(
          Object.entries(officialSyncSnapshotBySubject).filter(
            ([subjectId]) => subjectId !== subject.id,
          ),
        ),
      );
    }

    return true;
  };
};
