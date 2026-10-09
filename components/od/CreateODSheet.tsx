import { useMemo, useState } from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { Button, HelperText, TextInput } from "react-native-paper";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { AutoFillTemplate } from "@/components/od/AutoFillTemplate";
import {
  SubjectHoursPicker,
  type SelectedODSubjectState,
} from "@/components/od/SubjectHoursPicker";
import { BottomSheet } from "@/components/shared/BottomSheet";
import { buildODTemplateFromTimetable } from "@/lib/calculations";
import { triggerSuccessHaptic, triggerTapHaptic } from "@/lib/haptics";
import { generateId, isValidDateKey } from "@/lib/utils";
import type {
  DailyLog,
  ODEvent,
  ODEventType,
  Subject,
  TimetableSlot,
  WorkingDateOverrides,
  WorkingDay,
} from "@/types";

const odSchema = z
  .object({
    name: z.string().min(3, "Event name is required"),
    type: z.enum(["hackathon", "seminar", "club", "sports", "cultural", "other"]),
    date: z.string().refine(isValidDateKey, "Use a real date as YYYY-MM-DD"),
    endDate: z.string().optional(),
    reason: z.string().min(3, "Reason is required"),
  })
  .refine((values) => !values.endDate || isValidDateKey(values.endDate), {
    message: "Use a real date as YYYY-MM-DD",
    path: ["endDate"],
  })
  .refine((values) => !values.endDate || values.endDate >= values.date, {
    message: "End date can't be before the start date",
    path: ["endDate"],
  });

type ODFormValues = z.infer<typeof odSchema>;

const typeOptions: ODEventType[] = [
  "hackathon",
  "seminar",
  "club",
  "sports",
  "cultural",
  "other",
];

interface CreateODSheetProps {
  visible: boolean;
  subjects: Subject[];
  timetable: TimetableSlot[];
  workingDays: WorkingDay[];
  workingDateOverrides: WorkingDateOverrides;
  onClose: () => void;
  onCreate: (odEvent: ODEvent, logs: DailyLog[]) => void;
}

export const CreateODSheet = ({
  visible,
  subjects,
  timetable,
  workingDays,
  workingDateOverrides,
  onClose,
  onCreate,
}: CreateODSheetProps) => {
  const { height } = useWindowDimensions();
  const scrollMaxHeight = useMemo(
    () => Math.max(360, Math.floor(height * 0.62)),
    [height],
  );
  const [selection, setSelection] = useState<Record<string, SelectedODSubjectState>>({});
  const [autoFillMessage, setAutoFillMessage] = useState("");
  const [selectionError, setSelectionError] = useState("");
  const {
    control,
    handleSubmit,
    getValues,
    setError,
    clearErrors,
    formState: { errors },
    reset,
  } = useForm<ODFormValues>({
    resolver: zodResolver(odSchema),
    defaultValues: {
      name: "",
      type: "hackathon",
      date: "",
      endDate: "",
      reason: "",
    },
  });

  const buildTemplate = (startDate: string, endDate: string) =>
    buildODTemplateFromTimetable({
      timetable,
      startDate,
      endDate,
      workingDays,
      workingDateOverrides,
    });

  // Auto-fill reads the Date / End date fields at the top, so there is only one
  // place to type the OD dates.
  const applyTemplate = () => {
    void triggerTapHaptic();
    const startDate = getValues("date");
    const endDate = getValues("endDate") || startDate;

    if (!isValidDateKey(startDate)) {
      setError("date", { message: "Enter the OD date first (YYYY-MM-DD)" });
      setAutoFillMessage("");
      return;
    }

    if (!isValidDateKey(endDate) || endDate < startDate) {
      setError("endDate", { message: "End date must be a real date on or after the start" });
      setAutoFillMessage("");
      return;
    }

    clearErrors(["date", "endDate"]);
    const template = buildTemplate(startDate, endDate);

    if (template.subjects.length === 0) {
      setAutoFillMessage("No classes in your timetable on these dates.");
      return;
    }

    setAutoFillMessage("");
    setSelectionError("");
    setSelection(
      Object.fromEntries(
        template.subjects.map((subject) => [
          subject.subjectId,
          { enabled: true, hours: subject.hours },
        ]),
      ),
    );
  };

  const submit = handleSubmit((values) => {
    void triggerTapHaptic();
    const selectedSubjects = Object.entries(selection)
      .filter((entry) => entry[1].enabled)
      .map(([subjectId, subjectSelection]) => ({
        subjectId,
        hours: subjectSelection.hours,
        registered: false,
      }));

    if (selectedSubjects.length === 0) {
      setSelectionError("Turn on at least one subject below.");
      return;
    }

    const odEventId = generateId("od");
    const createdAt = new Date().toISOString();
    const odEvent: ODEvent = {
      id: odEventId,
      name: values.name,
      date: values.date,
      endDate: values.endDate || undefined,
      reason: values.reason,
      type: values.type,
      subjects: selectedSubjects,
      createdAt,
    };

    // Logs are built from the final selection, so subjects switched off after
    // auto-fill get no OD entry. A subject whose hours match the timetable gets
    // one entry per class (replacing that class's Today entry); edited hours
    // become a single entry on the start date.
    const template = buildTemplate(values.date, values.endDate || values.date);
    const timetableHours = new Map(
      template.subjects.map((subject) => [subject.subjectId, subject.hours]),
    );
    const logs: DailyLog[] = selectedSubjects.flatMap((subject) => {
      if (timetableHours.get(subject.subjectId) === subject.hours) {
        return template.logs
          .filter((log) => log.subjectId === subject.subjectId)
          .map((log) => ({ ...log, odEventId, note: values.reason, createdAt }));
      }

      return [
        {
          id: `${odEventId}_${subject.subjectId}`,
          date: values.date,
          subjectId: subject.subjectId,
          status: "od" as const,
          hours: subject.hours,
          odEventId,
          note: values.reason,
          createdAt,
        },
      ];
    });

    onCreate(odEvent, logs);
    void triggerSuccessHaptic();
    setSelection({});
    setAutoFillMessage("");
    setSelectionError("");
    reset();
    onClose();
  });

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Create OD Event">
      <ScrollView
        style={{ maxHeight: scrollMaxHeight }}
        contentContainerStyle={{ paddingBottom: 16 }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        <Controller
          control={control}
          name="name"
          render={({ field: { value, onChange } }) => (
            <TextInput
              mode="outlined"
              label="Event name"
              value={value}
              onChangeText={onChange}
              className="mb-1 bg-transparent"
            />
          )}
        />
        <HelperText type="error" visible={Boolean(errors.name)}>
          {errors.name?.message}
        </HelperText>

        <Controller
          control={control}
          name="type"
          render={({ field: { value, onChange } }) => (
            <View className="mb-4 flex-row flex-wrap gap-2">
              {typeOptions.map((option) => (
                <Button
                  key={option}
                  mode={value === option ? "contained" : "outlined"}
                  onPress={() => onChange(option)}
                >
                  {option}
                </Button>
              ))}
            </View>
          )}
        />

        <Controller
          control={control}
          name="date"
          render={({ field: { value, onChange } }) => (
            <TextInput
              mode="outlined"
              label="Date (YYYY-MM-DD)"
              value={value}
              onChangeText={onChange}
              className="mb-1 bg-transparent"
            />
          )}
        />
        <HelperText type="error" visible={Boolean(errors.date)}>
          {errors.date?.message}
        </HelperText>

        <Controller
          control={control}
          name="endDate"
          render={({ field: { value, onChange } }) => (
            <TextInput
              mode="outlined"
              label="End date (optional)"
              value={value}
              onChangeText={onChange}
              className="mb-1 bg-transparent"
            />
          )}
        />
        <HelperText type="error" visible={Boolean(errors.endDate)}>
          {errors.endDate?.message}
        </HelperText>

        <Controller
          control={control}
          name="reason"
          render={({ field: { value, onChange } }) => (
            <TextInput
              mode="outlined"
              label="Reason"
              multiline
              value={value}
              onChangeText={onChange}
              className="mb-1 bg-transparent"
            />
          )}
        />
        <HelperText type="error" visible={Boolean(errors.reason)}>
          {errors.reason?.message}
        </HelperText>

        <Text className="mb-3 mt-3 font-inter-semibold text-sm text-white/75">
          Subject selector
        </Text>
        <AutoFillTemplate onApply={applyTemplate} message={autoFillMessage} />

        <View className="mt-4">
          <SubjectHoursPicker
            subjects={subjects}
            value={selection}
            onChange={(nextSelection) => {
              setSelection(nextSelection);
              setSelectionError("");
            }}
          />
        </View>

        <HelperText type="error" visible={Boolean(selectionError)}>
          {selectionError}
        </HelperText>
        <Button mode="contained" className="mt-1" onPress={submit}>
          Save OD event
        </Button>
      </ScrollView>
    </BottomSheet>
  );
};
