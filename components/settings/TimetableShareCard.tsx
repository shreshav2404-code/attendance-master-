import { CameraView, useCameraPermissions } from "expo-camera";
import * as Clipboard from "expo-clipboard";
import { useMemo, useRef, useState } from "react";
import { StyleSheet, Share, Text, View } from "react-native";
import { Button, TextInput } from "react-native-paper";
import QRCode from "react-native-qrcode-svg";

import { BottomSheet } from "@/components/shared/BottomSheet";
import { triggerSuccessHaptic, triggerTapHaptic } from "@/lib/haptics";
import {
  buildTimetableImportPlan,
  decodeTimetableShare,
  encodeTimetableShare,
} from "@/lib/timetableShare";
import type {
  HourSlot,
  Subject,
  TimetableImportPlan,
  TimetableSlot,
  WorkingDay,
} from "@/types";

interface TimetableShareCardProps {
  subjects: Subject[];
  timetable: TimetableSlot[];
  hourSlots: HourSlot[];
  workingDays: WorkingDay[];
  onImport: (plan: TimetableImportPlan) => Promise<void>;
  onToast: (message: string, type?: "success" | "warning") => void;
}

interface ImportPreview {
  plan?: TimetableImportPlan;
  error?: string;
}

const pluralize = (
  count: number,
  singular: string,
  plural = `${singular}s`,
): string => `${count} ${count === 1 ? singular : plural}`;

export const TimetableShareCard = ({
  subjects,
  timetable,
  hourSlots,
  workingDays,
  onImport,
  onToast,
}: TimetableShareCardProps) => {
  const [exportVisible, setExportVisible] = useState(false);
  const [importVisible, setImportVisible] = useState(false);
  const [importCode, setImportCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scanLockRef = useRef(false);

  const hasTimetable = timetable.length > 0;

  const shareCode = useMemo(() => {
    if (!hasTimetable) {
      return "";
    }
    try {
      return encodeTimetableShare({
        subjects,
        timetable,
        hourSlots,
        workingDays,
      });
    } catch {
      return "";
    }
  }, [hasTimetable, subjects, timetable, hourSlots, workingDays]);

  const exportSummary = useMemo(() => {
    const usedSubjects = new Set(timetable.map((slot) => slot.subjectId));
    return {
      slotCount: timetable.length,
      subjectCount: usedSubjects.size,
    };
  }, [timetable]);

  const preview: ImportPreview = useMemo(() => {
    const trimmed = importCode.trim();
    if (trimmed.length === 0) {
      return {};
    }
    try {
      const payload = decodeTimetableShare(trimmed);
      const plan = buildTimetableImportPlan({
        payload,
        existingSubjects: subjects,
      });
      return { plan };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Could not read this timetable code.",
      };
    }
  }, [importCode, subjects]);

  const handleCopy = async () => {
    if (!shareCode) {
      return;
    }
    await triggerTapHaptic();
    await Clipboard.setStringAsync(shareCode);
    onToast("Timetable code copied");
  };

  const handleShare = async () => {
    if (!shareCode) {
      return;
    }
    await triggerTapHaptic();
    await Share.share({
      message: `Here's my class timetable for AttendX. Open AttendX → Settings → Import timetable, and paste this code:\n\n${shareCode}`,
    });
  };

  const handlePaste = async () => {
    await triggerTapHaptic();
    const clipboardText = await Clipboard.getStringAsync();
    if (clipboardText.trim().length === 0) {
      onToast("Clipboard is empty", "warning");
      return;
    }
    setImportCode(clipboardText.trim());
  };

  const handleScanPress = async () => {
    await triggerTapHaptic();
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        onToast("Camera permission is needed to scan a QR code", "warning");
        return;
      }
    }
    scanLockRef.current = false;
    // Swap the sheet's content to the camera instead of stacking a second
    // native modal (unreliable on Android's new architecture).
    setScanning(true);
  };

  const closeScanner = () => {
    setScanning(false);
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanLockRef.current) {
      return;
    }
    scanLockRef.current = true;
    setImportCode(data.trim());
    void triggerSuccessHaptic();
    setScanning(false);
  };

  const handleApply = async () => {
    if (!preview.plan) {
      return;
    }
    setApplying(true);
    try {
      await triggerTapHaptic();
      await onImport(preview.plan);
      await triggerSuccessHaptic();
      onToast(
        `Timetable imported · ${pluralize(preview.plan.slotCount, "class", "classes")}, ${pluralize(preview.plan.createdCount, "new subject")}`,
      );
      setImportVisible(false);
      setImportCode("");
    } finally {
      setApplying(false);
    }
  };

  return (
    <View className="mt-4 rounded-[28px] border border-white/10 bg-surface p-5">
      <Text className="font-inter-bold text-lg text-white">Share timetable</Text>
      <Text className="mt-2 font-inter text-sm leading-6 text-white/60">
        Send your timetable to classmates as a QR or code — they import it in one
        tap, no manual setup. Or import a timetable someone shared with you.
      </Text>

      <View className="mt-4 gap-3">
        <Button
          mode="contained"
          icon="qrcode"
          contentStyle={{ paddingVertical: 6 }}
          onPress={async () => {
            await triggerTapHaptic();
            setExportVisible(true);
          }}
        >
          Share my timetable
        </Button>
        <Button
          mode="outlined"
          icon="import"
          contentStyle={{ paddingVertical: 6 }}
          onPress={async () => {
            await triggerTapHaptic();
            setImportVisible(true);
          }}
        >
          Import from code
        </Button>
      </View>

      <BottomSheet
        visible={exportVisible}
        title="Share my timetable"
        onClose={() => setExportVisible(false)}
      >
        {hasTimetable && shareCode ? (
          <View className="items-center">
            <View className="rounded-3xl bg-white p-4">
              <QRCode
                value={shareCode}
                size={220}
                color="#0a0f1e"
                backgroundColor="#ffffff"
                ecl="M"
              />
            </View>
            <Text className="mt-4 text-center font-inter text-sm text-white/60">
              {pluralize(exportSummary.subjectCount, "subject")} ·{" "}
              {pluralize(exportSummary.slotCount, "class", "classes")}
            </Text>
            <Text className="mt-1 text-center font-inter text-xs text-white/40">
              Classmates can scan this QR, or use the code below.
            </Text>

            <View className="mt-4 w-full gap-3">
              <Button mode="contained" icon="content-copy" onPress={handleCopy}>
                Copy code
              </Button>
              <Button mode="outlined" icon="share-variant" onPress={handleShare}>
                Share code
              </Button>
            </View>
          </View>
        ) : (
          <View className="items-center py-8">
            <Text className="text-center font-inter-semibold text-base text-white">
              No timetable to share yet
            </Text>
            <Text className="mt-2 text-center font-inter text-sm text-white/55">
              Build your timetable first, then come back here to share it.
            </Text>
          </View>
        )}
      </BottomSheet>

      <BottomSheet
        visible={importVisible}
        title={scanning ? "Scan timetable QR" : "Import timetable"}
        onClose={() => {
          setScanning(false);
          setImportVisible(false);
        }}
      >
        {scanning ? (
          <View>
            <View
              className="overflow-hidden rounded-3xl bg-black"
              style={{ height: 360 }}
            >
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={handleBarcodeScanned}
              />
              <View
                pointerEvents="none"
                style={StyleSheet.absoluteFill}
                className="items-center justify-center"
              >
                <View className="h-52 w-52 rounded-3xl border-2 border-white/80" />
              </View>
            </View>
            <Text className="mt-4 text-center font-inter text-sm text-white/60">
              Point at a classmate's timetable QR code.
            </Text>
            <Button
              mode="outlined"
              icon="close"
              style={{ marginTop: 16 }}
              onPress={closeScanner}
            >
              Cancel
            </Button>
          </View>
        ) : (
          <>
            <Text className="font-inter text-sm leading-6 text-white/60">
              Paste a timetable code a classmate shared with you. You'll see a
              preview before anything is applied.
            </Text>

            <TextInput
              mode="outlined"
              label="Timetable code"
              value={importCode}
              onChangeText={setImportCode}
              multiline
              numberOfLines={3}
              autoCapitalize="none"
              autoCorrect={false}
              style={{ marginTop: 16 }}
            />

            <View className="mt-2 flex-row items-center gap-2">
              <Button mode="text" icon="qrcode-scan" onPress={handleScanPress}>
                Scan QR code
              </Button>
              <Button
                mode="text"
                icon="clipboard-outline"
                onPress={handlePaste}
              >
                Paste code
              </Button>
            </View>

            {preview.error ? (
              <View className="mt-3 rounded-2xl border border-danger/40 bg-danger/10 p-4">
                <Text className="font-inter text-sm text-danger">
                  {preview.error}
                </Text>
              </View>
            ) : null}

            {preview.plan ? (
              <View className="mt-3 rounded-2xl border border-white/10 bg-surfaceAlt p-4">
                <Text className="font-inter-semibold text-sm text-white">
                  Ready to import
                </Text>
                <Text className="mt-2 font-inter text-sm leading-6 text-white/70">
                  {pluralize(preview.plan.slotCount, "class", "classes")} across
                  the week.{"\n"}
                  {pluralize(preview.plan.matchedCount, "subject")} matched your
                  existing ones, {preview.plan.createdCount} new will be created.
                </Text>
                {preview.plan.droppedSlotCount > 0 ? (
                  <Text className="mt-2 font-inter text-xs text-warning">
                    {preview.plan.droppedSlotCount} classes skipped (unknown
                    subject).
                  </Text>
                ) : null}
                <Text className="mt-2 font-inter text-xs text-white/40">
                  This replaces your current timetable and hour slots. Your
                  attendance history is untouched.
                </Text>
              </View>
            ) : null}

            <Button
              mode="contained"
              icon="check"
              disabled={!preview.plan || applying}
              loading={applying}
              style={{ marginTop: 16 }}
              contentStyle={{ paddingVertical: 6 }}
              onPress={handleApply}
            >
              Apply timetable
            </Button>
          </>
        )}
      </BottomSheet>
    </View>
  );
};
