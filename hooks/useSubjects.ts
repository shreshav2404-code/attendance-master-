import { useSubjectStore } from "@/store/subjectStore";

export const useSubjects = () => ({
  subjects: useSubjectStore((state) => state.subjects),
  hydrated: useSubjectStore((state) => state.hydrated),
  hydrate: useSubjectStore((state) => state.hydrate),
  setSubjects: useSubjectStore((state) => state.setSubjects),
  addSubject: useSubjectStore((state) => state.addSubject),
  updateSubject: useSubjectStore((state) => state.updateSubject),
  removeSubject: useSubjectStore((state) => state.removeSubject),
});
