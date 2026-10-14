import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { useState } from "react";
import { View } from "react-native";

import { PendingODManager } from "@/components/settings/PendingODManager";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { useDailyLog } from "@/hooks/useDailyLog";
import { useODEvents } from "@/hooks/useODEvents";
import { useSubjects } from "@/hooks/useSubjects";
import { useToast } from "@/hooks/useToast";
import { triggerTapHaptic } from "@/lib/haptics";
import {
  buildPendingODImportPlan,
  parsePendingODImportFile,
} from "@/lib/pendingODImport";
import { generateId } from "@/lib/utils";
import { useAttendanceStore } from "@/store/attendanceStore";
import { useODStore } from "@/store/odStore";
import { useSubjectStore } from "@/store/subjectStore";

export default function PendingODSettingsScreen() {
  const { subjects, setSubjects } = useSubjects();
  const { setDailyLogs } = useDailyLog();
  const { setODEvents } = useODEvents();
  const toast = useToast();
  const [importLoading, setImportLoading] = useState(false);
  const [importSummary, setImportSummary] = useState("");

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
      await toast.warn("Date must be YYYY-MM-DD", 1800);
      return;
    }

    const subject = subjects.find((item) => item.id === subjectId);
    if (!subject) {
      await toast.warn("Select a valid subject", 1800);
      return;
    }

    const safeHours = Number(hours);
    if (!Number.isFinite(safeHours) || safeHours <= 0) {
      await toast.warn("Hours must be greater than 0", 1800);
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
      source: "manual-pending" as const,
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

    await toast.success(`Added ${safeHours}h pending OD for ${subject.shortName}`);
  };

  const importPendingODFile = async (): Promise<void> => {
    await triggerTapHaptic();
    setImportLoading(true);

    try {
      const pickedDocument = await DocumentPicker.getDocumentAsync({
        // Android labels .csv files "text/comma-separated-values", so asking only
        // for "text/csv" hid every CSV in the file picker.
        type: [
          "text/csv",
          "text/comma-separated-values",
          "application/csv",
          "text/x-csv",
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

      const normalizedName = (pickedAsset.name ?? "").toLowerCase();
      const normalizedMimeType = (pickedAsset.mimeType ?? "").toLowerCase();
      const isCsvFile =
        normalizedName.endsWith(".csv") ||
        normalizedMimeType.includes("csv") ||
        normalizedMimeType.includes("comma-separated");
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
        setImportSummary(
          skipped > 0
            ? `No valid pending OD rows imported. Skipped ${skipped} rows.`
            : "No valid pending OD rows imported.",
        );
        await toast.warn("No pending OD rows were imported");
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
      setImportSummary(
        `Imported ${importPlan.odEvents.length} pending OD rows. Matched ${matchedCount}, created ${importPlan.createdSubjects.length} subjects, skipped ${importPlan.skippedRows.length}.`,
      );
      await toast.success("Pending OD file imported", 2200);
    } catch (error) {
      await toast.warn(
        error instanceof Error ? error.message : "Could not import pending OD file.",
        2600,
      );
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <SettingsPage
      page="od"
      title="OD"
      description="Add OD hours that are still waiting for college registration, or import them from a file. Create full OD events from the OD tab."
      toast={toast}
    >
      <View className="mt-6">
        <PendingODManager
          subjects={subjects}
          onManualAdd={addManualPendingOD}
          onImportPress={importPendingODFile}
          importLoading={importLoading}
          importSummary={importSummary}
        />
      </View>
    </SettingsPage>
  );
}
