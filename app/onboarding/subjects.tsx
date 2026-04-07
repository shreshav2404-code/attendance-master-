import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { router, useLocalSearchParams } from "expo-router";
import { Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { Button, HelperText, TextInput } from "react-native-paper";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { ProgressBar } from "@/components/shared/ProgressBar";
import { SubjectBadge } from "@/components/shared/SubjectBadge";
import { SUBJECT_COLOR_PALETTE } from "@/lib/constants";
import { triggerSuccessHaptic, triggerTapHaptic, triggerWarningHaptic } from "@/lib/haptics";
import {
  buildOfficialImportPlan,
  parseOfficialAttendanceWorkbook,
} from "@/lib/officialReportImport";
import { generateId } from "@/lib/utils";
import { useSubjects } from "@/hooks/useSubjects";

const subjectSchema = z.object({
  code: z.string().min(2, "Code is required"),
  name: z.string().min(2, "Name is required"),
  shortName: z.string().min(1, "Short name is required"),
});

type SubjectFormValues = z.infer<typeof subjectSchema>;

const defaultSubjectColor = SUBJECT_COLOR_PALETTE[0]!;

export default function SubjectsScreen() {
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const { subjects, addSubject, removeSubject, setSubjects } = useSubjects();
  const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const isEditMode = mode === "edit";
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectSchema),
    defaultValues: {
      code: "",
      name: "",
      shortName: "",
    },
  });
  const [selectedColor, setSelectedColor] = useState(defaultSubjectColor);
  const [isLab, setIsLab] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState("");
  const [importError, setImportError] = useState("");
  const [showSyncReminder, setShowSyncReminder] = useState(false);

  const submit = handleSubmit(async (values) => {
    await triggerTapHaptic();
    await addSubject({
      id: generateId("subject"),
      code: values.code.toUpperCase(),
      name: values.name,
      shortName: values.shortName.toUpperCase(),
      isLab,
      color: selectedColor,
    });
    await triggerSuccessHaptic();
    reset();
    setIsLab(false);
    setSelectedColor(defaultSubjectColor);
  });

  const importSubjectsFromOfficialReport = async (): Promise<void> => {
    await triggerTapHaptic();
    setImporting(true);
    setImportError("");

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
        setImportError("No file selected.");
        await triggerWarningHaptic();
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

      if (importPlan.matches.length === 0) {
        setImportError("No valid subject rows found in this report.");
        await triggerWarningHaptic();
        return;
      }

      if (importPlan.createdSubjects.length > 0) {
        await setSubjects([...subjects, ...importPlan.createdSubjects]);
      }

      const totalMapped = importPlan.matches.length;
      const createdCount = importPlan.createdSubjects.length;
      const matchedCount = totalMapped - createdCount;
      const studentLabel = parsedReport.student.name
        ? ` for ${parsedReport.student.name}`
        : "";
      setImportSummary(
        `Imported ${totalMapped} subjects${studentLabel}. Matched ${matchedCount}, added ${createdCount} new subjects.`,
      );
      setShowSyncReminder(true);
      await triggerSuccessHaptic();
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : "Could not import this file. Please use the official Excel format.",
      );
      await triggerWarningHaptic();
    } finally {
      setImporting(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text className="font-inter text-sm uppercase tracking-[1.2px] text-white/50">
        Step 3 of 5
      </Text>
      <Text className="mt-3 font-inter-bold text-3xl text-white">
        Add subjects
      </Text>
      <Text className="mt-2 font-inter text-base leading-7 text-white/65">
        Add every theory and lab subject now. You can always edit them later in
        Settings.
      </Text>

      <View className="mt-5">
        <ProgressBar progress={60} />
      </View>

      <View className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-4">
        <Controller
          control={control}
          name="code"
          render={({ field: { onChange, value } }) => (
            <TextInput
              mode="outlined"
              label="Subject Code"
              value={value}
              onChangeText={onChange}
              style={{ backgroundColor: "transparent" }}
            />
          )}
        />
        <HelperText type="error" visible={Boolean(errors.code)}>
          {errors.code?.message}
        </HelperText>

        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, value } }) => (
            <TextInput
              mode="outlined"
              label="Full Name"
              value={value}
              onChangeText={onChange}
              style={{ backgroundColor: "transparent" }}
            />
          )}
        />
        <HelperText type="error" visible={Boolean(errors.name)}>
          {errors.name?.message}
        </HelperText>

        <Controller
          control={control}
          name="shortName"
          render={({ field: { onChange, value } }) => (
            <TextInput
              mode="outlined"
              label="Short Name"
              value={value}
              onChangeText={onChange}
              style={{ backgroundColor: "transparent" }}
            />
          )}
        />
        <HelperText type="error" visible={Boolean(errors.shortName)}>
          {errors.shortName?.message}
        </HelperText>

        <View className="mt-3 flex-row gap-2">
          {["Theory", "Lab"].map((label) => {
            const selected = isLab === (label === "Lab");

            return (
              <Pressable
                key={label}
                className="rounded-full border px-4 py-3"
                style={{
                  backgroundColor: selected
                    ? "rgba(26,95,168,0.18)"
                    : "rgba(255,255,255,0.04)",
                  borderColor: selected
                    ? "rgba(26,95,168,0.45)"
                    : "rgba(255,255,255,0.08)",
                }}
                onPress={() => {
                  void triggerTapHaptic();
                  setIsLab(label === "Lab");
                }}
              >
                <Text className="font-inter-semibold text-sm text-white">
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text className="mt-4 font-inter-semibold text-sm text-white/70">
          Pick a color
        </Text>
        <View className="mt-3 flex-row flex-wrap gap-3">
          {SUBJECT_COLOR_PALETTE.map((color) => (
            <Pressable
              key={color}
              className="h-10 w-10 rounded-full border-2"
              style={{
                backgroundColor: color,
                borderColor: selectedColor === color ? "#ffffff" : "transparent",
              }}
              onPress={() => {
                void triggerTapHaptic();
                setSelectedColor(color);
              }}
            />
          ))}
        </View>

        <Button
          mode="contained"
          style={{ marginTop: 20 }}
          contentStyle={{ paddingVertical: 8 }}
          onPress={submit}
        >
          Add subject
        </Button>
        <Button
          mode="contained-tonal"
          style={{ marginTop: 12 }}
          contentStyle={{ paddingVertical: 8 }}
          loading={importing}
          disabled={importing}
          onPress={() => void importSubjectsFromOfficialReport()}
        >
          Import from official Excel
        </Button>
        {importSummary ? (
          <Text className="mt-3 font-inter text-xs leading-5 text-white/65">
            {importSummary}
          </Text>
        ) : null}
        {showSyncReminder ? (
          <View
            className="mt-3 rounded-2xl border px-3 py-3"
            style={{
              borderColor: "rgba(245, 158, 11, 0.35)",
              backgroundColor: "rgba(245, 158, 11, 0.09)",
            }}
          >
            <Text className="font-inter-semibold text-xs leading-5 text-[#fde68a]">
              Attendance sync pending: subject import only creates/matches subjects.
              Re-upload course-wise attendance in Settings and tap Compare and apply
              to sync TH/AH/DL values.
            </Text>
          </View>
        ) : null}
        {importError ? (
          <Text className="mt-2 font-inter text-xs leading-5 text-red-300">
            {importError}
          </Text>
        ) : null}
      </View>

      <View className="mt-6 gap-3">
        {subjects.map((subject) => (
          <View
            key={subject.id}
            className="flex-row items-center justify-between rounded-[24px] border border-white/10 bg-white/5 px-4 py-4"
          >
            <View className="flex-1 pr-4">
              <Text className="font-inter-bold text-base text-white">
                {subject.name}
              </Text>
              <Text className="mt-1 font-inter text-sm text-white/55">
                {subject.code} · {subject.isLab ? "Lab" : "Theory"}
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <SubjectBadge code={subject.shortName} color={subject.color} />
              <Pressable
                onPress={async () => {
                  await triggerWarningHaptic();
                  await removeSubject(subject.id);
                }}
              >
                <Trash2 color="#f87171" size={18} />
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      <Button
        mode="contained"
        style={{ marginTop: 24 }}
        disabled={subjects.length === 0}
        contentStyle={{ paddingVertical: 8 }}
        onPress={async () => {
          await triggerTapHaptic();
          router.push(
            isEditMode
              ? "/onboarding/timetable?mode=edit"
              : "/onboarding/timetable",
          );
        }}
      >
        Continue to timetable
      </Button>
    </ScrollView>
  );
}
