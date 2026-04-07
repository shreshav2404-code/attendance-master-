import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, Linking, Platform, Share, ScrollView, Text, View } from "react-native";
import { Button, Switch, TextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { ExamWeekToggle } from "@/components/settings/ExamWeekToggle";
import { PendingODManager } from "@/components/settings/PendingODManager";
import { SyncReportForm } from "@/components/settings/SyncReportForm";
import { BottomSheet } from "@/components/shared/BottomSheet";
import { Toast } from "@/components/shared/Toast";
import { buildODTemplateFromTimetable } from "@/lib/calculations";
import {
  DEFAULT_EXAM_WEEK_SETTINGS,
  DEFAULT_HOUR_SLOTS,
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_WORKING_DATE_OVERRIDES,
  DEFAULT_WORKING_DAYS,
} from "@/lib/constants";
import { triggerSuccessHaptic, triggerTapHaptic, triggerWarningHaptic } from "@/lib/haptics";
import {
  checkForAppUpdate,
  getCurrentAppVersion,
  type AppUpdateResult,
} from "@/lib/appUpdate";
import { generateAttendancePdf, shareAttendancePdf } from "@/lib/pdf";
import { shareAttendanceSummary, buildShareSummary } from "@/lib/share";
import { clearAllStorage, exportBackup, restoreBackup } from "@/lib/storage";
import { applyOfficialSync } from "@/lib/sync";
import {
  buildOfficialImportPlan,
  parseOfficialAttendanceWorkbook,
} from "@/lib/officialReportImport";
import {
  buildPendingODImportPlan,
  parsePendingODImportFile,
} from "@/lib/pendingODImport";
import { formatDateLabel, generateId, getTodayKey } from "@/lib/utils";
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
import type { OfficialSubjectInput } from "@/types";

const CREATOR_UPI_CONFIG = {
  upiId: "kkjha537428-1@okaxis",
  payeeName: "Keshav Jha",
  note: "AttendX support",
  amountInr: "49",
} as const;

const buildCreatorUpiPayUrl = (): string => {
  const query = [
    `pa=${encodeURIComponent(CREATOR_UPI_CONFIG.upiId)}`,
    `pn=${encodeURIComponent(CREATOR_UPI_CONFIG.payeeName)}`,
    `tn=${encodeURIComponent(CREATOR_UPI_CONFIG.note)}`,
    `am=${encodeURIComponent(CREATOR_UPI_CONFIG.amountInr)}`,
    "cu=INR",
  ].join("&");
  return `upi://pay?${query}`;
};

export default function SettingsScreen() {
  const {
    student,
    examWeek,
    notificationSettings,
    workingDays,
    workingDateOverrides,
    updateStudent,
    setExamWeek,
    setWorkingDateOverride,
    removeWorkingDateOverride,
    setNotificationSettings,
    setLastSyncedAt,
    officialSyncSnapshotBySubject,
    setOfficialSyncSnapshotBySubject,
  } = useStudent();
  const { subjects, setSubjects } = useSubjects();
  const { timetable } = useTimetable();
  const { dailyLogs, setDailyLogs } = useDailyLog();
  const { odEvents, setODEvents } = useODEvents();
  const { summaries, overall } = useAttendanceSummary();
  const { initializeNotifications } = useNotifications();
  const [toastMessage, setToastMessage] = useState("");
  const [syncPrefillRows, setSyncPrefillRows] = useState<OfficialSubjectInput[]>([]);
  const [syncImportLoading, setSyncImportLoading] = useState(false);
  const [syncImportSummary, setSyncImportSummary] = useState("");
  const [pendingImportLoading, setPendingImportLoading] = useState(false);
  const [pendingImportSummary, setPendingImportSummary] = useState("");
  const [upiQrVisible, setUpiQrVisible] = useState(false);
  const [updateCheck, setUpdateCheck] = useState<AppUpdateResult | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [saturdayDate, setSaturdayDate] = useState(getTodayKey());
  const [saturdayWorking, setSaturdayWorking] = useState(true);
  const [profile, setProfile] = useState({
    name: student?.name ?? "",
    rollNo: student?.rollNo ?? "",
    batch: student?.batch ?? "",
    department: student?.department ?? "",
    collegeName: student?.collegeName ?? "",
    term: student?.term ?? "",
    targetPercentage: String(student?.targetPercentage ?? 75),
  });
  const saturdayOverrides = useMemo(
    () =>
      Object.entries(workingDateOverrides)
        .filter(([date]) => {
          try {
            return formatDateLabel(date, "EEE") === "Sat";
          } catch {
            return false;
          }
        })
        .sort(([left], [right]) => left.localeCompare(right)),
    [workingDateOverrides],
  );
  const currentAppVersion = useMemo(() => getCurrentAppVersion(), []);

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

  useEffect(() => {
    const override = workingDateOverrides[saturdayDate];

    if (override !== undefined) {
      setSaturdayWorking(override);
      return;
    }

    setSaturdayWorking(workingDays.includes("Sat"));
  }, [saturdayDate, workingDateOverrides, workingDays]);

  const refreshUpdateCheck = async ({
    showLatestToast = false,
  }: {
    showLatestToast?: boolean;
  } = {}): Promise<void> => {
    setCheckingUpdates(true);

    try {
      const result = await checkForAppUpdate();
      setUpdateCheck(result);

      if (result.error) {
        setToastMessage(result.error);
        await triggerWarningHaptic();
        setTimeout(() => setToastMessage(""), 2200);
        return;
      }

      if (result.isForceUpdate) {
        setToastMessage("Mandatory update available. Please update to continue safely.");
        await triggerWarningHaptic();
        setTimeout(() => setToastMessage(""), 2600);
        return;
      }

      if (!showLatestToast) {
        return;
      }

      if (result.isUpdateAvailable) {
        setToastMessage("New update available.");
        await triggerSuccessHaptic();
        setTimeout(() => setToastMessage(""), 1800);
        return;
      }

      if (result.updateUrl && !result.manifest) {
        setToastMessage("Direct APK link is ready.");
        await triggerSuccessHaptic();
        setTimeout(() => setToastMessage(""), 1800);
        return;
      }

      setToastMessage("You are already on the latest version.");
      await triggerSuccessHaptic();
      setTimeout(() => setToastMessage(""), 1800);
    } finally {
      setCheckingUpdates(false);
    }
  };

  useEffect(() => {
    void refreshUpdateCheck();
  }, []);

  const openUpdateDownload = async (): Promise<void> => {
    await triggerTapHaptic();

    const updateUrl = updateCheck?.updateUrl;
    if (!updateUrl) {
      setToastMessage("Update link unavailable. Configure release manifest first.");
      await triggerWarningHaptic();
      setTimeout(() => setToastMessage(""), 2400);
      return;
    }

    try {
      await Linking.openURL(updateUrl);
      setToastMessage(
        Platform.OS === "android"
          ? "Latest APK opened in browser/download manager."
          : "Opening update page.",
      );
      await triggerSuccessHaptic();
      setTimeout(() => setToastMessage(""), 2200);
    } catch {
      setToastMessage("Unable to open update link.");
      await triggerWarningHaptic();
      setTimeout(() => setToastMessage(""), 2200);
    }
  };

  const openCreatorUPIPayment = async (): Promise<void> => {
    await triggerTapHaptic();

    if (!CREATOR_UPI_CONFIG.upiId.trim()) {
      setToastMessage("Set your UPI ID in settings.tsx to enable payments");
      await triggerWarningHaptic();
      setTimeout(() => setToastMessage(""), 2200);
      return;
    }

    const upiUrl = buildCreatorUpiPayUrl();

    try {
      const canOpenUPI = await Linking.canOpenURL(upiUrl);

      if (!canOpenUPI) {
        throw new Error("UPI app unavailable");
      }

      await Linking.openURL(upiUrl);
      setToastMessage("Opened UPI app");
      await triggerSuccessHaptic();
      setTimeout(() => setToastMessage(""), 1800);
    } catch {
      setUpiQrVisible(true);
      setToastMessage("UPI app not available. Showing QR.");
      await triggerWarningHaptic();
      setTimeout(() => setToastMessage(""), 2200);
    }
  };

  const importOfficialReport = async (): Promise<void> => {
    await triggerTapHaptic();
    setSyncImportLoading(true);

    try {
      const pickedDocument = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
        ],
        copyToCacheDirectory: true,
      });

      if (pickedDocument.canceled) {
        return;
      }

      const pickedAsset = pickedDocument.assets[0];
      if (!pickedAsset) {
        setToastMessage("No file selected");
        await triggerWarningHaptic();
        setTimeout(() => setToastMessage(""), 1800);
        return;
      }

      const workbookBase64 = await FileSystem.readAsStringAsync(pickedAsset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const parsedReport = parseOfficialAttendanceWorkbook(workbookBase64);
      const importPlan = buildOfficialImportPlan({
        report: parsedReport,
        subjects,
      });

      if (importPlan.officialInputs.length === 0) {
        setToastMessage("No valid course rows found in the report");
        await triggerWarningHaptic();
        setTimeout(() => setToastMessage(""), 2200);
        return;
      }

      if (importPlan.createdSubjects.length > 0) {
        const mergedSubjects = [...subjects, ...importPlan.createdSubjects];
        await setSubjects(mergedSubjects);
      }

      setProfile((currentProfile) => ({
        ...currentProfile,
        name: parsedReport.student.name ?? currentProfile.name,
        rollNo: parsedReport.student.rollNo ?? currentProfile.rollNo,
        batch: parsedReport.student.batch ?? currentProfile.batch,
        department: parsedReport.student.department ?? currentProfile.department,
        term: parsedReport.student.term ?? currentProfile.term,
      }));

      setSyncPrefillRows(importPlan.officialInputs);
      const importedCount = importPlan.officialInputs.length;
      const createdCount = importPlan.createdSubjects.length;
      const matchedCount = importPlan.matches.length - createdCount;
      const studentLabel = parsedReport.student.name
        ? ` for ${parsedReport.student.name}`
        : "";
      const summary = `Imported ${importedCount} courses${studentLabel}. Matched ${matchedCount}, created ${createdCount} new subjects.`;
      setSyncImportSummary(summary);
      setToastMessage("Report imported. Review values, then tap Compare and apply.");
      await triggerSuccessHaptic();
      setTimeout(() => setToastMessage(""), 2200);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not parse Excel file. Please verify report format.";
      setToastMessage(message);
      await triggerWarningHaptic();
      setTimeout(() => setToastMessage(""), 2600);
    } finally {
      setSyncImportLoading(false);
    }
  };

  const addManualPendingOD = async ({
    subjectId,
    date,
    hours,
    reason,
  }: {
    subjectId: string;
    date: string;
    hours: number;
    reason: string;
  }): Promise<void> => {
    await triggerTapHaptic();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setToastMessage("Date must be YYYY-MM-DD");
      await triggerWarningHaptic();
      setTimeout(() => setToastMessage(""), 1800);
      return;
    }

    const subject = subjects.find((item) => item.id === subjectId);
    if (!subject) {
      setToastMessage("Select a valid subject");
      await triggerWarningHaptic();
      setTimeout(() => setToastMessage(""), 1800);
      return;
    }

    const safeHours = Number(hours);
    if (!Number.isFinite(safeHours) || safeHours <= 0) {
      setToastMessage("Hours must be greater than 0");
      await triggerWarningHaptic();
      setTimeout(() => setToastMessage(""), 1800);
      return;
    }

    const odEventId = generateId("od");
    const createdAt = new Date().toISOString();
    const eventName = `Manual Pending OD · ${subject.shortName}`;
    const nextEvent = {
      id: odEventId,
      name: eventName,
      date,
      reason,
      type: "other" as const,
      subjects: [
        {
          subjectId,
          hours: safeHours,
          registered: false,
        },
      ],
      createdAt,
    };
    const nextLog = {
      id: `${odEventId}_0`,
      date,
      subjectId,
      status: "od" as const,
      hours: safeHours,
      odEventId,
      note: reason,
      createdAt,
    };
    const latestEvents = useODStore.getState().odEvents;
    const latestLogs = useAttendanceStore.getState().dailyLogs;
    await setODEvents([...latestEvents, nextEvent]);
    await setDailyLogs([...latestLogs, nextLog]);

    setToastMessage(`Added ${safeHours}h pending OD for ${subject.shortName}`);
    await triggerSuccessHaptic();
    setTimeout(() => setToastMessage(""), 1800);
  };

  const importPendingODFile = async (): Promise<void> => {
    await triggerTapHaptic();
    setPendingImportLoading(true);

    try {
      const pickedDocument = await DocumentPicker.getDocumentAsync({
        type: [
          "text/csv",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
        ],
        copyToCacheDirectory: true,
      });

      if (pickedDocument.canceled) {
        return;
      }

      const pickedAsset = pickedDocument.assets[0];
      if (!pickedAsset) {
        setToastMessage("No file selected");
        await triggerWarningHaptic();
        setTimeout(() => setToastMessage(""), 1800);
        return;
      }

      const normalizedName = (pickedAsset.name ?? "").toLowerCase();
      const normalizedMimeType = (pickedAsset.mimeType ?? "").toLowerCase();
      const isCsvFile =
        normalizedName.endsWith(".csv") || normalizedMimeType.includes("csv");
      const fileContent = await FileSystem.readAsStringAsync(pickedAsset.uri, {
        encoding: isCsvFile
          ? FileSystem.EncodingType.UTF8
          : FileSystem.EncodingType.Base64,
      });
      const parsed = parsePendingODImportFile({
        content: fileContent,
        kind: isCsvFile ? "csv" : "workbook",
      });
      const importPlan = buildPendingODImportPlan({
        parsed,
        subjects: useSubjectStore.getState().subjects,
      });

      if (importPlan.odEvents.length === 0) {
        const skipped = importPlan.skippedRows.length;
        setPendingImportSummary(
          skipped > 0
            ? `No valid pending OD rows imported. Skipped ${skipped} rows.`
            : "No valid pending OD rows imported.",
        );
        setToastMessage("No pending OD rows were imported");
        await triggerWarningHaptic();
        setTimeout(() => setToastMessage(""), 2200);
        return;
      }

      if (importPlan.createdSubjects.length > 0) {
        const latestSubjects = useSubjectStore.getState().subjects;
        await setSubjects([...latestSubjects, ...importPlan.createdSubjects]);
      }

      const latestEvents = useODStore.getState().odEvents;
      const latestLogs = useAttendanceStore.getState().dailyLogs;
      await setODEvents([...latestEvents, ...importPlan.odEvents]);
      await setDailyLogs([...latestLogs, ...importPlan.logs]);

      const matchedCount =
        importPlan.matches.length - importPlan.createdSubjects.length;
      const summary = `Imported ${importPlan.odEvents.length} pending OD rows. Matched ${matchedCount}, created ${importPlan.createdSubjects.length} subjects, skipped ${importPlan.skippedRows.length}.`;
      setPendingImportSummary(summary);
      setToastMessage("Pending OD file imported");
      await triggerSuccessHaptic();
      setTimeout(() => setToastMessage(""), 2200);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not import pending OD file.";
      setToastMessage(message);
      await triggerWarningHaptic();
      setTimeout(() => setToastMessage(""), 2600);
    } finally {
      setPendingImportLoading(false);
    }
  };

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
      <ScrollView
        nestedScrollEnabled
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
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
            <Button
              mode="outlined"
              onPress={() => router.push("/onboarding/subjects?mode=edit")}
            >
              Edit subjects
            </Button>
            <Button
              mode="outlined"
              onPress={() => router.push("/onboarding/timetable?mode=edit")}
            >
              Edit timetable
            </Button>
          </View>
        </View>

        <View className="mt-6">
          <SyncReportForm
            subjects={subjects}
            summaries={summaries}
            prefillRows={syncPrefillRows}
            onImportPress={importOfficialReport}
            importLoading={syncImportLoading}
            importSummary={syncImportSummary}
            onApply={(officialInputs) => {
              void triggerTapHaptic();
              const result = applyOfficialSync({
                officialInputs,
                summaries,
                odEvents,
              });
              void setODEvents(result.odEvents);
              void setLastSyncedAt(result.lastSyncedAt);
              void setOfficialSyncSnapshotBySubject({
                ...officialSyncSnapshotBySubject,
                ...result.officialSyncSnapshotBySubject,
              });
              setToastMessage("Official sync applied");
              void triggerSuccessHaptic();
              setTimeout(() => setToastMessage(""), 1800);
              return result.reports;
            }}
          />
        </View>

        <View className="mt-6">
          <PendingODManager
            subjects={subjects}
            onManualAdd={addManualPendingOD}
            onImportPress={importPendingODFile}
            importLoading={pendingImportLoading}
            importSummary={pendingImportSummary}
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
                    workingDays,
                    workingDateOverrides,
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
          <Text className="font-inter-bold text-lg text-white">
            Flexible Saturday
          </Text>
          <Text className="mt-2 font-inter text-sm leading-6 text-white/60">
            Override individual Saturdays as working day or holiday, without changing the full timetable.
          </Text>
          <TextInput
            mode="outlined"
            label="Saturday date (YYYY-MM-DD)"
            value={saturdayDate}
            onChangeText={setSaturdayDate}
            style={{ marginTop: 14, backgroundColor: "transparent" }}
          />
          <View className="mt-4 flex-row items-center justify-between">
            <Text className="font-inter text-sm text-white/70">
              Mark as working day
            </Text>
            <Switch
              value={saturdayWorking}
              onValueChange={(value) => {
                void triggerTapHaptic();
                setSaturdayWorking(value);
              }}
            />
          </View>
          <View className="mt-4 flex-row gap-3">
            <Button
              mode="contained-tonal"
              onPress={async () => {
                await triggerTapHaptic();

                if (!/^\d{4}-\d{2}-\d{2}$/.test(saturdayDate)) {
                  setToastMessage("Enter date as YYYY-MM-DD");
                  await triggerWarningHaptic();
                  setTimeout(() => setToastMessage(""), 1800);
                  return;
                }

                let dayLabel = "";
                try {
                  dayLabel = formatDateLabel(saturdayDate, "EEE");
                } catch {
                  setToastMessage("Invalid date");
                  await triggerWarningHaptic();
                  setTimeout(() => setToastMessage(""), 1800);
                  return;
                }

                if (dayLabel !== "Sat") {
                  setToastMessage("Pick a Saturday date");
                  await triggerWarningHaptic();
                  setTimeout(() => setToastMessage(""), 1800);
                  return;
                }

                await setWorkingDateOverride(saturdayDate, saturdayWorking);
                setToastMessage(
                  saturdayWorking
                    ? "Saturday marked as working"
                    : "Saturday marked as holiday",
                );
                await triggerSuccessHaptic();
                setTimeout(() => setToastMessage(""), 1800);
              }}
            >
              Save Saturday override
            </Button>
            <Button
              mode="outlined"
              disabled={workingDateOverrides[saturdayDate] === undefined}
              onPress={async () => {
                await triggerTapHaptic();
                await removeWorkingDateOverride(saturdayDate);
                setToastMessage("Saturday override removed");
                await triggerSuccessHaptic();
                setTimeout(() => setToastMessage(""), 1800);
              }}
            >
              Reset date
            </Button>
          </View>

          {saturdayOverrides.length === 0 ? (
            <Text className="mt-4 font-inter text-sm text-white/45">
              No Saturday overrides yet.
            </Text>
          ) : (
            <View className="mt-4 gap-2">
              {saturdayOverrides.map(([date, isWorking]) => (
                <View
                  key={date}
                  className="flex-row items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                >
                  <Text className="font-inter text-sm text-white/80">
                    {date} · {isWorking ? "Working" : "Holiday"}
                  </Text>
                  <Button
                    compact
                    mode="text"
                    onPress={async () => {
                      await triggerTapHaptic();
                      await removeWorkingDateOverride(date);
                    }}
                  >
                    Remove
                  </Button>
                </View>
              ))}
            </View>
          )}
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
                  workingDateOverrides:
                    backup.hourSlotBundle.workingDateOverrides ??
                    DEFAULT_WORKING_DATE_OVERRIDES,
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
              }}
            >
              Clear all data
            </Button>
          </View>
        </View>

        <View className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-4">
          <Text className="font-inter-bold text-lg text-white">
            Help & User Manual
          </Text>
          <Text className="mt-2 font-inter text-sm leading-6 text-white/65">
            Step-by-step setup and daily workflow guide for new users.
          </Text>
          <Button
            mode="outlined"
            style={{ marginTop: 14 }}
            onPress={async () => {
              await triggerTapHaptic();
              router.push("../help");
            }}
          >
            Open user manual
          </Button>
        </View>

        <View className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-4">
          <Text className="font-inter-bold text-lg text-white">App updates</Text>
          <Text className="mt-2 font-inter text-sm text-white/65">
            Current version: {currentAppVersion}
          </Text>
          <Text className="mt-1 font-inter text-sm text-white/65">
            Latest release: {updateCheck?.manifest?.latestVersion ?? "Unknown"}
          </Text>
          {!updateCheck?.manifest && updateCheck?.updateUrl ? (
            <Text className="mt-2 font-inter text-xs leading-5 text-white/55">
              Release manifest is unavailable, direct APK link mode is active.
            </Text>
          ) : null}
          {updateCheck?.manifest?.notes ? (
            <Text className="mt-2 font-inter text-xs leading-5 text-white/55">
              {updateCheck.manifest.notes}
            </Text>
          ) : null}
          {updateCheck?.isForceUpdate ? (
            <Text className="mt-3 font-inter-semibold text-sm text-[#fca5a5]">
              Mandatory update required. Install latest build before continuing.
            </Text>
          ) : null}
          {updateCheck?.isUpdateAvailable && !updateCheck?.isForceUpdate ? (
            <Text className="mt-3 font-inter-semibold text-sm text-[#93c5fd]">
              New update available.
            </Text>
          ) : null}
          <View className="mt-4 flex-row gap-3">
            <Button
              mode="outlined"
              loading={checkingUpdates}
              disabled={checkingUpdates}
              onPress={() => {
                void refreshUpdateCheck({ showLatestToast: true });
              }}
            >
              Check for updates
            </Button>
            <Button
              mode="contained-tonal"
              disabled={!updateCheck?.updateUrl}
              onPress={() => {
                void openUpdateDownload();
              }}
            >
              Download latest APK
            </Button>
          </View>
        </View>

        <View className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-4">
          <Text className="font-inter-bold text-lg text-white">About</Text>
          <Text className="mt-3 font-inter text-sm text-white/65">
            Version {Constants.expoConfig?.version ?? "1.0.0"} · Built with AttendX
          </Text>
          <Text className="mt-2 font-inter text-sm text-white/65">
            Made with love{" "}
            <Text
              className="font-inter-semibold"
              style={{ color: "#60a5fa" }}
              onPress={async () => {
                await triggerTapHaptic();
                await Linking.openURL("https://instagram.com/the_jha_keshav2404");
              }}
            >
              keshav jha
            </Text>
          </Text>
          <Text className="mt-1 font-inter text-sm text-white/65">
            Checkout my portfolio{" "}
            <Text
              className="font-inter-semibold"
              style={{ color: "#60a5fa" }}
              onPress={async () => {
                await triggerTapHaptic();
                await Linking.openURL("https://portfolio-keshav.vercel.app");
              }}
            >
              portfolio-keshav.vercel.app
            </Text>
          </Text>
          <View
            className="mt-4 rounded-2xl border p-4"
            style={{
              borderColor: "rgba(245, 158, 11, 0.35)",
              backgroundColor: "rgba(245, 158, 11, 0.08)",
            }}
          >
            <View className="flex-row items-center">
              <MaterialCommunityIcons name="coffee" size={22} color="#f59e0b" />
              <Text className="ml-2 font-inter-bold text-base text-[#fde68a]">
                Buy Me A Coffee
              </Text>
            </View>
            <Text className="mt-2 font-inter-semibold text-sm leading-6 text-white/90">
              If AttendX is saving your attendance, fuel the developer once in a while.
            </Text>
            <Text className="mt-1 font-inter text-xs leading-5 text-white/65">
              No pressure. But caffeine definitely improves bug-fix speed.
            </Text>
            <Button
              mode="contained"
              icon="coffee"
              buttonColor="#f59e0b"
              textColor="#0a0f1e"
              style={{ marginTop: 12 }}
              onPress={() => {
                void openCreatorUPIPayment();
              }}
            >
              Send coffee via UPI
            </Button>
            <Button
              mode="text"
              icon="qrcode"
              style={{ marginTop: 8 }}
              onPress={async () => {
                await triggerTapHaptic();
                setUpiQrVisible(true);
              }}
            >
              Show UPI QR
            </Button>
          </View>
          <Button
            mode="outlined"
            style={{ marginTop: 16 }}
            onPress={async () => {
              await triggerTapHaptic();
              await Share.share({
                message: [
                  "AttendX helps you track physical attendance, official OD, and projected recovery in one place.",
                  "",
                  "Follow updates:",
                  "https://github.com/shreshav2404-code/attendance-master-/releases",
                  "",
                  "Checkout my portfolio:",
                  "https://portfolio-keshav.vercel.app",
                  "",
                  "Instagram:",
                  "https://instagram.com/the_jha_keshav2404",
                ].join("\n"),
              });
              await triggerSuccessHaptic();
            }}
          >
            Share app link
          </Button>
        </View>
      </ScrollView>
      <BottomSheet
        visible={upiQrVisible}
        title="UPI QR"
        onClose={() => setUpiQrVisible(false)}
      >
        <View className="items-center">
          <Text className="mb-3 text-center font-inter text-sm text-white/70">
            Scan this QR to pay with any UPI app.
          </Text>
          <Image
            source={require("../../assets/images/upi-keshav-qr.jpeg")}
            resizeMode="contain"
            style={{ width: 260, height: 320, borderRadius: 18 }}
          />
          <Text className="mt-2 font-inter text-sm text-white/70">
            UPI ID: {CREATOR_UPI_CONFIG.upiId}
          </Text>
          <View className="mt-4 w-full flex-row gap-3">
            <Button
              mode="contained-tonal"
              style={{ flex: 1 }}
              onPress={async () => {
                await triggerTapHaptic();
                await Clipboard.setStringAsync(CREATOR_UPI_CONFIG.upiId);
                setToastMessage("UPI ID copied");
                await triggerSuccessHaptic();
                setTimeout(() => setToastMessage(""), 1800);
              }}
            >
              Copy UPI ID
            </Button>
            <Button
              mode="outlined"
              style={{ flex: 1 }}
              onPress={() => {
                setUpiQrVisible(false);
                void triggerTapHaptic();
              }}
            >
              Close
            </Button>
          </View>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}
