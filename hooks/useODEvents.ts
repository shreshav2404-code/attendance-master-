import { getODPendingEvents } from "@/lib/calculations";
import { useODStore } from "@/store/odStore";

export const useODEvents = () => {
  const odEvents = useODStore((state) => state.odEvents);

  return {
    odEvents,
    pendingEvents: getODPendingEvents(odEvents),
    hydrated: useODStore((state) => state.hydrated),
    hydrate: useODStore((state) => state.hydrate),
    setODEvents: useODStore((state) => state.setODEvents),
    addODEvent: useODStore((state) => state.addODEvent),
    updateODEvent: useODStore((state) => state.updateODEvent),
    removeODEvent: useODStore((state) => state.removeODEvent),
    setEventSubjectRegistration: useODStore(
      (state) => state.setEventSubjectRegistration,
    ),
  };
};
