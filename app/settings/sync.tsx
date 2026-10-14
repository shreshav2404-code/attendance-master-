import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { useState } from "react";
import { Text, View } from "react-native";
import { Button } from "react-native-paper";

import { SettingsPage } from "@/components/settings/SettingsPage";
import { SyncReportForm } from "@/components/settings/SyncReportForm";
import { useAttendanceSummary } from "@/hooks/useAttendanceSummary";
import { useDailyLog } from "@/hooks/useDailyLog";
import { useODEvents } from "@/hooks/useODEvents";
import { useStudent } from "@/hooks/useStudent";
import { useSubjects } from "@/hooks/useSubjects";
import { useToast } from "@/hooks/useToast";
import { triggerTapHaptic } from "@/lib/haptics";
import {
  buildOfficialImportPlan,
  parseOfficialAttendanceWorkbook,
} from "@/lib/officialReportImport";
import { applyOfficialSync } from "@/lib/sync";
import type { OfficialSubjectInput, Student } from "@/types";

type ReportStudentDetails = Partial<
  Pick<Student, "name" | "rollNo" | "batch" | "department" | "term">
>;

const REPORT_PROFILE_FIELDS = [
  ["name", "Name"],
  ["rollNo", "Roll number"],
  ["batch", "Batch"],
  ["department", "Department"],
  ["term", "Term"],
] as const;

export default function OfficialSyncSettingsScreen() {
  const {
    student,
    updateStudent,
    setLastSyncedAt,
    officialSyncSnapshotBySubject,
    setOfficialSyncSnapshotBySubject,
  } = useStudent();
  const { subjects, setSubjects } = useSubjects();
  const { dailyLogs, setDailyLogs } = useDailyLog();
  const { odEvents, setODEvents } = useODEvents();
  const { summaries } = useAttendanceSummary();
  const toast = useToast();
  const [prefillRows, setPrefillRows] = useState<OfficialSubjectInput[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importSummary, setImportSummary] = useState("");
  const [reportStudent, setReportStudent] = useState<ReportStudentDetails>({});

  // Profile details from the imported report that differ from the saved profile.
  const profileChanges = REPORT_PROFILE_FIELDS.flatMap(([key, label]) => {
    const value = reportStudent[key]?.trim();
    return value && student && value !== student[key] ? [{ key, label, value }] : [];
  });

  const importOfficialReport = async (): Promise<void> => {
    await triggerTapHaptic();
    setImportLoading(true);

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
        await toast.warn("No file selected", 1800);
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
        await toast.warn("No valid course rows found in the report");
        return;
      }

      if (importPlan.createdSubjects.length > 0) {
        await setSubjects([...subjects, ...importPlan.createdSubjects]);
      }

      setReportStudent({
        name: parsedReport.student.name,
        rollNo: parsedReport.student.rollNo,
        batch: parsedReport.student.batch,
        department: parsedReport.student.department,
        term: parsedReport.student.term,
      });
      setPrefillRows(importPlan.officialInputs);
      const importedCount = importPlan.officialInputs.length;
      const createdCount = importPlan.createdSubjects.length;
      const matchedCount = importPlan.matches.length - createdCount;
      const studentLabel = parsedReport.student.name
        ? ` for ${parsedReport.student.name}`
        : "";
      setImportSummary(
        `Imported ${importedCount} courses${studentLabel}. Matched ${matchedCount}, created ${createdCount} new subjects.`,
      );
      await toast.success("Report imported. Review values, then tap Compare and apply.", 2200);
    } catch (error) {
      await toast.warn(
        error instanceof Error
          ? error.message
          : "Could not parse Excel file. Please verify report format.",
        2600,
      );
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <SettingsPage
      page="sync"
      title="Official sync"
      description="Import the college's course-wise attendance report (or type TH/AH/DL) so the app matches the official numbers."
      toast={toast}
    >
      {profileChanges.length > 0 ? (
        <View className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-4">
          <Text className="font-inter-bold text-base text-white">
            Report has different profile details
          </Text>
          <View className="mt-2 gap-1">
            {profileChanges.map(({ key, label, value }) => (
              <Text key={key} className="font-inter text-sm text-white/70">
                {label}: <Text className="text-white">{value}</Text>
              </Text>
            ))}
          </View>
          <View className="mt-3 flex-row flex-wrap gap-2">
            <Button
              mode="contained-tonal"
              onPress={async () => {
                await triggerTapHaptic();
                await updateStudent(
                  Object.fromEntries(profileChanges.map(({ key, value }) => [key, value])),
                );
                setReportStudent({});
                await toast.success("Profile updated from report");
              }}
            >
              Update profile
            </Button>
            <Button mode="text" onPress={() => setReportStudent({})}>
              Keep mine
            </Button>
          </View>
        </View>
      ) : null}

      <View className="mt-6">
        <SyncReportForm
          subjects={subjects}
          summaries={summaries}
          prefillRows={prefillRows}
          onImportPress={importOfficialReport}
          importLoading={importLoading}
          importSummary={importSummary}
          onApply={(officialInputs) => {
            void triggerTapHaptic();
            const result = applyOfficialSync({
              officialInputs,
              summaries,
              odEvents,
              dailyLogs,
            });
            void setODEvents(result.odEvents);
            if (result.dailyLogs !== dailyLogs) {
              void setDailyLogs(result.dailyLogs);
            }
            void setLastSyncedAt(result.lastSyncedAt);
            void setOfficialSyncSnapshotBySubject({
              ...officialSyncSnapshotBySubject,
              ...result.officialSyncSnapshotBySubject,
            });
            void toast.success("Official sync applied");
            return result.reports;
          }}
        />
      </View>
    </SettingsPage>
  );
}
