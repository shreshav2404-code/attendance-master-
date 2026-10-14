import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";

import { DEFAULT_WORKING_DATE_OVERRIDES } from "@/lib/constants";
import { parseBackup, restoreBackup } from "@/lib/storage";
import { useAttendanceStore } from "@/store/attendanceStore";
import { useODStore } from "@/store/odStore";
import { useStudentStore } from "@/store/studentStore";
import { useSubjectStore } from "@/store/subjectStore";

/**
 * Lets the student pick an AttendX JSON backup and replaces all app data with it.
 * Used from Settings › Data management and from the welcome screen (reinstalls,
 * new phones). Throws with a user-facing message when the file isn't a backup.
 */
export const pickAndRestoreBackup = async (): Promise<"restored" | "cancelled"> => {
  const picked = await DocumentPicker.getDocumentAsync({
    // Backups saved through WhatsApp, Drive or Files often lose the JSON type,
    // which hid them from the picker; parseBackup checks the contents instead.
    type: "*/*",
    copyToCacheDirectory: true,
  });
  const asset = picked.canceled ? undefined : picked.assets[0];
  if (!asset) {
    return "cancelled";
  }

  const backup = parseBackup(await FileSystem.readAsStringAsync(asset.uri));
  await restoreBackup(backup);

  useStudentStore.setState((currentValue) => ({
    ...currentValue,
    student: backup.studentBundle.student,
    hourSlots: backup.hourSlotBundle.hourSlots,
    workingDays: backup.hourSlotBundle.workingDays,
    workingDateOverrides:
      backup.hourSlotBundle.workingDateOverrides ?? DEFAULT_WORKING_DATE_OVERRIDES,
    notificationSettings: backup.studentBundle.notificationSettings,
    examWeek: backup.studentBundle.examWeek,
    lastSyncedAt: backup.studentBundle.lastSyncedAt,
    officialSyncSnapshotBySubject: backup.studentBundle.officialSyncSnapshotBySubject ?? {},
    onboarded: backup.onboarded,
  }));
  useSubjectStore.setState((currentValue) => ({
    ...currentValue,
    subjects: backup.subjects,
    timetable: backup.timetable,
  }));
  useAttendanceStore.setState((currentValue) => ({
    ...currentValue,
    dailyLogs: backup.dailyLogs,
  }));
  useODStore.setState((currentValue) => ({
    ...currentValue,
    odEvents: backup.odEvents,
  }));
  return "restored";
};
