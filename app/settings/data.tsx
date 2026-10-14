import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import { Text, View } from "react-native";
import { Button } from "react-native-paper";

import { SettingsPage } from "@/components/settings/SettingsPage";
import { useAttendanceSummary } from "@/hooks/useAttendanceSummary";
import { useDailyLog } from "@/hooks/useDailyLog";
import { useODEvents } from "@/hooks/useODEvents";
import { useStudent } from "@/hooks/useStudent";
import { useSubjects } from "@/hooks/useSubjects";
import { useToast } from "@/hooks/useToast";
import { confirmAction } from "@/lib/confirm";
import {
  DEFAULT_EXAM_WEEK_SETTINGS,
  DEFAULT_HOUR_SLOTS,
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_WORKING_DATE_OVERRIDES,
  DEFAULT_WORKING_DAYS,
} from "@/lib/constants";
import { triggerTapHaptic, triggerWarningHaptic } from "@/lib/haptics";
import { generateAttendancePdf, shareAttendancePdf } from "@/lib/pdf";
import { buildShareSummary, shareAttendanceSummary } from "@/lib/share";
import { clearAllStorage, exportBackup, parseBackup, restoreBackup } from "@/lib/storage";
import { getTodayKey } from "@/lib/utils";
import { useAttendanceStore } from "@/store/attendanceStore";
import { useODStore } from "@/store/odStore";
import { useStudentStore } from "@/store/studentStore";
import { useSubjectStore } from "@/store/subjectStore";

export default function DataSettingsScreen() {
  const { student } = useStudent();
  const { subjects } = useSubjects();
  const { dailyLogs } = useDailyLog();
  const { odEvents } = useODEvents();
  const { summaries, overall } = useAttendanceSummary();
  const toast = useToast();

  const exportJsonBackup = async () => {
    await triggerTapHaptic();
    const backup = await exportBackup();
    const directory = FileSystem.documentDirectory;

    if (!directory) {
      return;
    }

    const uri = `${directory}attendx-backup-${Date.now()}.json`;
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(backup, null, 2));
    await Sharing.shareAsync(uri);
    await toast.success("Backup file ready");
  };

  const importJsonRestore = async () => {
    await triggerTapHaptic();
    const pickedDocument = await DocumentPicker.getDocumentAsync({
      type: "application/json",
      copyToCacheDirectory: true,
    });

    if (pickedDocument.canceled) {
      return;
    }

    const pickedAsset = pickedDocument.assets[0];

    if (!pickedAsset) {
      return;
    }

    const fileContents = await FileSystem.readAsStringAsync(pickedAsset.uri);
    let backup: ReturnType<typeof parseBackup>;

    try {
      backup = parseBackup(fileContents);
    } catch (error) {
      await toast.warn(
        error instanceof Error ? error.message : "Couldn't read that backup file.",
        2600,
      );
      return;
    }

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
      officialSyncSnapshotBySubject:
        backup.studentBundle.officialSyncSnapshotBySubject ?? {},
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
    await toast.success("Backup imported");
  };

  const clearAllData = async () => {
    await triggerWarningHaptic();
    const confirmed = await confirmAction({
      title: "Clear all data?",
      message:
        "This erases your profile, subjects, timetable, attendance and OD events from this phone. Export a backup first if you might need them. This can't be undone.",
      confirmLabel: "Erase everything",
    });

    if (!confirmed) {
      return;
    }

    await clearAllStorage();
    useStudentStore.setState((currentValue) => ({
      ...currentValue,
      student: null,
      hourSlots: DEFAULT_HOUR_SLOTS,
      workingDays: DEFAULT_WORKING_DAYS,
      workingDateOverrides: DEFAULT_WORKING_DATE_OVERRIDES,
      notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      examWeek: DEFAULT_EXAM_WEEK_SETTINGS,
      lastSyncedAt: undefined,
      officialSyncSnapshotBySubject: {},
      onboarded: false,
      hydrated: true,
    }));
    useSubjectStore.setState((currentValue) => ({
      ...currentValue,
      subjects: [],
      timetable: [],
    }));
    useAttendanceStore.setState((currentValue) => ({
      ...currentValue,
      dailyLogs: [],
    }));
    useODStore.setState((currentValue) => ({
      ...currentValue,
      odEvents: [],
    }));
    router.replace("/onboarding/welcome");
  };

  return (
    <SettingsPage
      page="data"
      title="Data management"
      description="Everything stays on this phone. Back it up to move phones or keep a copy safe."
      toast={toast}
    >
      <View className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-4">
        <Text className="font-inter-bold text-lg text-white">Backup</Text>
        <View className="mt-4 gap-3">
          <Button mode="outlined" onPress={() => void exportJsonBackup()}>
            Export JSON backup
          </Button>
          <Button mode="outlined" onPress={() => void importJsonRestore()}>
            Import JSON restore
          </Button>
        </View>
      </View>

      <View className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-4">
        <Text className="font-inter-bold text-lg text-white">Reports</Text>
        <View className="mt-4 gap-3">
          <Button
            mode="contained-tonal"
            disabled={!student}
            onPress={async () => {
              await triggerTapHaptic();
              if (!student) {
                return;
              }
              const summaryText = buildShareSummary({
                student,
                overall,
                summaries,
                subjects,
                date: getTodayKey(),
              });
              await shareAttendanceSummary(summaryText);
              await toast.success("Share summary copied and opened");
            }}
          >
            Share summary
          </Button>
          <Button
            mode="contained-tonal"
            disabled={!student}
            onPress={async () => {
              await triggerTapHaptic();
              if (!student) {
                return;
              }
              const startDate = dailyLogs.map((log) => log.date).sort()[0] ?? getTodayKey();
              const uri = await generateAttendancePdf({
                student,
                subjects,
                summaries,
                overall,
                odEvents,
                startDate,
                endDate: getTodayKey(),
              });
              await shareAttendancePdf(uri);
              await toast.success("PDF report ready");
            }}
          >
            Export PDF report
          </Button>
        </View>
      </View>

      <View
        className="mt-6 rounded-[28px] border p-4"
        style={{
          borderColor: "rgba(239, 68, 68, 0.3)",
          backgroundColor: "rgba(127, 29, 29, 0.12)",
        }}
      >
        <Text className="font-inter-bold text-lg text-white">Danger zone</Text>
        <Text className="mt-2 font-inter text-sm leading-6 text-white/60">
          Erases all AttendX data on this phone and restarts setup.
        </Text>
        <Button
          mode="contained"
          buttonColor="#7f1d1d"
          style={{ marginTop: 14 }}
          onPress={() => void clearAllData()}
        >
          Clear all data
        </Button>
      </View>
    </SettingsPage>
  );
}
