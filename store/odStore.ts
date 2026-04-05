import { create } from "zustand";

import { loadODEvents, saveODEvents } from "@/lib/storage";
import type { ODEvent } from "@/types";

interface ODStoreState {
  hydrated: boolean;
  hydrating: boolean;
  odEvents: ODEvent[];
  hydrate: () => Promise<void>;
  setODEvents: (odEvents: ODEvent[]) => Promise<void>;
  addODEvent: (odEvent: ODEvent) => Promise<void>;
  updateODEvent: (odEvent: ODEvent) => Promise<void>;
  removeODEvent: (odEventId: string) => Promise<void>;
  setEventSubjectRegistration: (
    odEventId: string,
    subjectId: string,
    registered: boolean,
  ) => Promise<void>;
}

export const useODStore = create<ODStoreState>((set, get) => ({
  hydrated: false,
  hydrating: false,
  odEvents: [],
  hydrate: async () => {
    if (get().hydrated || get().hydrating) {
      return;
    }

    set({ hydrating: true });
    const odEvents = await loadODEvents();
    set({
      hydrated: true,
      hydrating: false,
      odEvents,
    });
  },
  setODEvents: async (odEvents) => {
    set({ odEvents });
    await saveODEvents(odEvents);
  },
  addODEvent: async (odEvent) => {
    const odEvents = [...get().odEvents, odEvent];
    set({ odEvents });
    await saveODEvents(odEvents);
  },
  updateODEvent: async (odEvent) => {
    const odEvents = get().odEvents.map((item) =>
      item.id === odEvent.id ? odEvent : item,
    );
    set({ odEvents });
    await saveODEvents(odEvents);
  },
  removeODEvent: async (odEventId) => {
    const odEvents = get().odEvents.filter((event) => event.id !== odEventId);
    set({ odEvents });
    await saveODEvents(odEvents);
  },
  setEventSubjectRegistration: async (odEventId, subjectId, registered) => {
    const registeredAt = registered ? new Date().toISOString() : undefined;
    const odEvents = get().odEvents.map((event) =>
      event.id === odEventId
        ? {
            ...event,
            subjects: event.subjects.map((subject) =>
              subject.subjectId === subjectId
                ? {
                    ...subject,
                    registered,
                    registeredAt,
                  }
                : subject,
            ),
          }
        : event,
    );
    set({ odEvents });
    await saveODEvents(odEvents);
  },
}));
