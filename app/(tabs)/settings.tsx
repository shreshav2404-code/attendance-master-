import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Share, ScrollView, Text, View } from "react-native";
import { Button, Switch, TextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { ExamWeekToggle } from "@/components/settings/ExamWeekToggle";
import { SyncReportForm } from "@/components/settings/SyncReportForm";
import { Toast } from "@/components/shared/Toast";
import { buildODTemplateFromTimetable } from "@/lib/calculations";
import {
  DEFAULT_EXAM_WEEK_SETTINGS,
  DEFAULT_HOUR_SLOTS,
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_WORKING_DAYS,
} from "@/lib/constants";
import { triggerSuccessHaptic, triggerTapHaptic, triggerWarningHaptic } from "@/lib/haptics";
import { generateAttendancePdf, shareAttendancePdf } from "@/lib/pdf";
import { shareAttendanceSummary, buildShareSummary } from "@/lib/share";
import { clearAllStorage, exportBackup, restoreBackup } from "@/lib/storage";
import { applyOfficialSync } from "@/lib/sync";
import { generateId, getTodayKey } from "@/lib/utils";
import { useAttendanceSummary } from "@/hooks/useAttendanceSummary";
import { useDailyLog } from "@/hooks/useDailyLog";
import { useNotifications } from "@/hooks/useNotifications";
import { useODEvents } from "@/hooks/useODEvents";
import { useStudent } from "@/hooks/useStudent";
import { useSubjects } from "@/hooks/useSubjects";
import { useTimetable } from "@/hooks/useTimetable";
import { useAttendanceStore } from "@/store/attendanceStore";
import { useODStore } from "@/store/odStore";
import { useStudentStore } from "@/store/studentStore";
import { useSubjectStore } from "@/store/subjectStore";

export default function SettingsScreen() {
  const {
    student,
    examWeek,
    notificationSettings,
    updateStudent,
    setExamWeek,
    setNotificationSettings,
    setLastSyncedAt,
  } = useStudent();
  const { subjects } = useSubjects();
  const { timetable } = useTimetable();
  const { dailyLogs, setDailyLogs } = useDailyLog();
  const { odEvents, setODEvents } = useODEvents();
  const { summaries, overall } = useAttendanceSummary();
  const { initializeNotifications } = useNotifications();
  const [toastMessage, setToastMessage] = useState("");
  const [profile, setProfile] = useState({
    name: student?.name ?? "",
    rollNo: student?.rollNo ?? "",
    batch: student?.batch ?? "",
    department: student?.department ?? "",
    collegeName: student?.collegeName ?? "",
    term: student?.term ?? "",
    targetPercentage: String(student?.targetPercentage ?? 75),
  });

  useEffect(() => {
    setProfile({
      name: student?.name ?? "",
      rollNo: student?.rollNo ?? "",
      batch: student?.batch ?? "",
      department: student?.department ?? "",
      collegeName: student?.collegeName ?? "",
      term: student?.term ?? "",
      targetPercentage: String(student?.targetPercentage ?? 75),
    });
  }, [student]);

  if (!student) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-5">
          <Text className="font-inter-bold text-2xl text-white">
            Settings unavailable
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Toast visible={Boolean(toastMessage)} message={toastMessage} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text className="font-inter-bold text-3xl text-white">Settings</Text>
        <Text className="mt-2 font-inter text-base leading-7 text-white/65">
          Manage profile, sync official numbers, configure notifications, and
          back up everything locally.
        </Text>

        <View className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-4">
          <Text className="font-inter-bold text-lg text-white">Profile</Text>
          <View className="mt-4 gap-3">
            {(
              [
                ["name", "Full Name"],
                ["rollNo", "Roll Number"],
                ["batch", "Batch"],
                ["department", "Department"],
                ["collegeName", "College Name"],
                ["term", "Term"],
                ["targetPercentage", "Target %"],
              ] as const
            ).map(([key, label]) => (
              <TextInput
                key={key}
                mode="outlined"
                label={label}
                value={profile[key]}
                onChangeText={(value) =>
                  setProfile((currentValue) => ({
                    ...currentValue,
                    [key]: value,
                  }))
                }
                keyboardType={key === "targetPercentage" ? "number-pad" : "default"}
                style={{ backgroundColor: "transparent" }}
              />
            ))}
          </View>
          <Button
            mode="contained"
            style={{ marginTop: 16 }}
            onPress={async () => {
              await triggerTapHaptic();
              await updateStudent({
                ...profile,
                targetPercentage: Number(profile.targetPercentage || 75),
              });
              setToastMessage("Profile updated");
              await triggerSuccessHaptic();
              setTimeout(() => setToastMessage(""), 1800);
            }}
          >
            Save profile
          </Button>
        </View>

        <View className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-4">
          <Text className="font-inter-bold text-lg text-white">Timetable</Text>
          <Text className="mt-2 font-inter text-sm text-white/60">
            Need to change subjects, hour timings, or the weekly grid?
          </Text>
          <View className="mt-4 flex-row gap-3">
            <Button mode="outlined" onPress={() => router.push("/onboarding/subjects")}>
              Edit subjects
            </Button>
            <Button mode="outlined" onPress={() => router.push("/onboarding/timetable")}>
              Edit timetable
            </Button>
          </View>
        </View>

        <View className="mt-6">
          <SyncReportForm
            subjects={subjects}
            summaries={summaries}
            onApply={(officialInputs) => {
              void triggerTapHaptic();
              const result = applyOfficialSync({
                officialInputs,
                summaries,
                odEvents,
              });
              void setODEvents(result.odEvents);
              void setLastSyncedAt(result.lastSyncedAt);
              setToastMessage("Official sync applied");
              void triggerSuccessHaptic();
              setTimeout(() => setToastMessage(""), 1800);
              return result.reports;
            }}
          />
        </View>

        <View className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-4">
          <Text className="font-inter-bold text-lg text-white">Exam Week Mode</Text>
          <Text className="mt-2 font-inter text-sm leading-6 text-white/60">
            Enable this to bulk mark timetable slots as suspended for the selected date range.
          </Text>
          <View className="mt-4">
            <ExamWeekToggle
              value={examWeek}
              onChange={(nextValue) => {
                void triggerTapHaptic();
                void setExamWeek(nextValue);

                if (
                  nextValue.enabled &&
                  nextValue.startDate &&
                  nextValue.endDate
                ) {
                  const template = buildODTemplateFromTimetable({
                    timetable,
                    startDate: nextValue.startDate,
                    endDate: nextValue.endDate,
                    note: "Exam week suspension",
                  });
                  const existingKeys = new Set(
                    dailyLogs.map(
                      (log) =>
                        `${log.date}_${log.subjectId}_${log.status}_${log.hours}`,
                    ),
                  );
                  const suspendedLogs = template.logs
                    .map((log) => ({
                      ...log,
                      id: generateId("suspended"),
                      status: "suspended" as const,
                      odEventId: undefined,
                    }))
                    .filter(
                      (log) =>
                        !existingKeys.has(
                          `${log.date}_${log.subjectId}_${log.status}_${log.hours}`,
                        ),
                    );

                  void setDailyLogs([...dailyLogs, ...suspendedLogs]);
                }

                setToastMessage("Exam week updated");
                void triggerSuccessHaptic();
                setTimeout(() => setToastMessage(""), 1800);
              }}
            />
          </View>
        </View>

        <View className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-4">
          <Text className="font-inter-bold text-lg text-white">Notifications</Text>
          <View className="mt-4 gap-4">
            <View className="flex-row items-center justify-between">
              <Text className="font-inter text-sm text-white/70">Daily reminder</Text>
              <Switch
                value={notificationSettings.dailyReminderEnabled}
                onValueChange={(dailyReminderEnabled) =>
                  void setNotificationSettings({
                    ...notificationSettings,
                    dailyReminderEnabled,
                  })
                }
              />
            </View>
            <TextInput
              mode="outlined"
              label="Reminder time (HH:mm)"
              value={notificationSettings.dailyReminderTime}
              onChangeText={(dailyReminderTime) =>
                void setNotificationSettings({
                  ...notificationSettings,
                  dailyReminderTime,
                })
              }
              style={{ backgroundColor: "transparent" }}
            />
            <View className="flex-row items-center justify-between">
              <Text className="font-inter text-sm text-white/70">
                Low attendance alerts
              </Text>
              <Switch
                value={notificationSettings.lowAttendanceAlertsEnabled}
                onValueChange={(lowAttendanceAlertsEnabled) =>
                  void setNotificationSettings({
                    ...notificationSettings,
                    lowAttendanceAlertsEnabled,
                  })
                }
              />
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="font-inter text-sm text-white/70">OD reminders</Text>
              <Switch
                value={notificationSettings.odReminderEnabled}
                onValueChange={(odReminderEnabled) =>
                  void setNotificationSettings({
                    ...notificationSettings,
                    odReminderEnabled,
                  })
                }
              />
            </View>
            <Button
              mode="contained-tonal"
              onPress={async () => {
                await triggerTapHaptic();
                await initializeNotifications();
                setToastMessage("Notification preferences saved");
                await triggerSuccessHaptic();
                setTimeout(() => setToastMessage(""), 1800);
              }}
            >
              Save notifications
            </Button>
          </View>
        </View>

        <View className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-4">
          <Text className="font-inter-bold text-lg text-white">Data management</Text>
          <View className="mt-4 gap-3">
            <Button
              mode="outlined"
              onPress={async () => {
                await triggerTapHaptic();
                const backup = await exportBackup();
                const directory = FileSystem.documentDirectory;

                if (!directory) {
                  return;
                }

                const uri = `${directory}attendx-backup-${Date.now()}.json`;
                await FileSystem.writeAsStringAsync(uri, JSON.stringify(backup, null, 2));
                await Sharing.shareAsync(uri);
                await triggerSuccessHaptic();
              }}
            >
              Export JSON backup
            </Button>
            <Button
              mode="outlined"
              onPress={async () => {
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

                const fileContents = await FileSystem.readAsStringAsync(
                  pickedAsset.uri,
                );
                const backup = JSON.parse(fileContents) as Awaited<
                  ReturnType<typeof exportBackup>
                >;
                await restoreBackup(backup);

                useStudentStore.setState((currentValue) => ({
                  ...currentValue,
                  student: backup.studentBundle.student,
                  hourSlots: backup.hourSlotBundle.hourSlots,
                  workingDays: backup.hourSlotBundle.workingDays,
                  notificationSettings: backup.studentBundle.notificationSettings,
                  examWeek: backup.studentBundle.examWeek,
                  lastSyncedAt: backup.studentBundle.lastSyncedAt,
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
                setToastMessage("Backup imported");
                await triggerSuccessHaptic();
                setTimeout(() => setToastMessage(""), 1800);
              }}
            >
              Import JSON restore
            </Button>
            <Button
              mode="contained-tonal"
              onPress={async () => {
                await triggerTapHaptic();
                const summaryText = buildShareSummary({
                  student,
                  overall,
                  summaries,
                  subjects,
                  date: getTodayKey(),
                });
                await shareAttendanceSummary(summaryText);
                setToastMessage("Share summary copied and opened");
                await triggerSuccessHaptic();
                setTimeout(() => setToastMessage(""), 1800);
              }}
            >
              Share summary
            </Button>
            <Button
              mode="contained-tonal"
              onPress={async () => {
                await triggerTapHaptic();
                const startDate =
                  dailyLogs.map((log) => log.date).sort()[0] ?? getTodayKey();
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
                await triggerSuccessHaptic();
              }}
            >
              Export PDF report
            </Button>
            <Button
              mode="contained"
              buttonColor="#7f1d1d"
              onPress={async () => {
                await triggerWarningHaptic();
                await clearAllStorage();
                useStudentStore.setState((currentValue) => ({
                  ...currentValue,
                  student: null,
                  hourSlots: DEFAULT_HOUR_SLOTS,
                  workingDays: DEFAULT_WORKING_DAYS,
                  notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
                  examWeek: DEFAULT_EXAM_WEEK_SETTINGS,
                  lastSyncedAt: undefined,
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
              }}
            >
              Clear all data
            </Button>
          </View>
        </View>

        <View className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-4">
          <Text className="font-inter-bold text-lg text-white">About</Text>
          <Text className="mt-3 font-inter text-sm text-white/65">
            Version {Constants.expoConfig?.version ?? "1.0.0"} · Built with AttendX
          </Text>
          <Button
            mode="outlined"
            style={{ marginTop: 16 }}
            onPress={async () => {
              await triggerTapHaptic();
              await Share.share({
                message:
                  "AttendX helps you track physical attendance, official OD, and projected recovery in one place.",
              });
              await triggerSuccessHaptic();
            }}
          >
            Share app link
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
