import { confirmAction } from "@/lib/confirm";
import { useAttendanceStore } from "@/store/attendanceStore";
import { useODStore } from "@/store/odStore";
import type { ODEvent } from "@/types";

// Deleting an OD event also removes the attendance entries it marked, so it
// always asks first. Resolves to true when the event was deleted.
export const useDeleteODEvent = () => {
  const removeODEvent = useODStore((state) => state.removeODEvent);
  const removeLogsByODEvent = useAttendanceStore((state) => state.removeLogsByODEvent);

  return async (event: ODEvent): Promise<boolean> => {
    const confirmed = await confirmAction({
      title: "Delete OD event?",
      message: `"${event.name}" and the classes it marked as OD will be removed. This can't be undone.`,
    });

    if (!confirmed) {
      return false;
    }

    await removeLogsByODEvent(event.id);
    await removeODEvent(event.id);
    return true;
  };
};
