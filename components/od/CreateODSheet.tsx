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
import { generateId } from "@/lib/utils";
import type {
  DailyLog,
  ODEvent,
  ODEventType,
  Subject,
  TimetableSlot,
  WorkingDateOverrides,
  WorkingDay,
} from "@/types";

const odSchema = z.object({
  name: z.string().min(3, "Event name is required"),
  type: z.enum(["hackathon", "seminar", "club", "sports", "cultural", "other"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  endDate: z.string().optional(),
  reason: z.string().min(3, "Reason is required"),
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
  const [templateLogs, setTemplateLogs] = useState<DailyLog[]>([]);
  const {
    control,
    handleSubmit,
    setValue,
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

  const applyTemplate = (startDate: string, endDate: string) => {
    void triggerTapHaptic();
    const template = buildODTemplateFromTimetable({
      timetable,
      startDate,
      endDate,
      note: "Auto-filled from timetable",
      workingDays,
      workingDateOverrides,
    });
    setTemplateLogs(template.logs);
    setSelection(
      Object.fromEntries(
        template.subjects.map((subject) => [
          subject.subjectId,
          { enabled: true, hours: subject.hours },
        ]),
      ),
    );
    setValue("date", startDate);
    setValue("endDate", startDate === endDate ? "" : endDate);
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

    const logs =
      templateLogs.length > 0
        ? templateLogs.map((log, index) => ({
            ...log,
            id: `${odEventId}_${index}`,
            odEventId,
            createdAt,
          }))
        : selectedSubjects.map((subject, index) => ({
            id: `${odEventId}_${index}`,
            date: values.date,
            subjectId: subject.subjectId,
            status: "od" as const,
            hours: subject.hours,
            odEventId,
            note: values.reason,
            createdAt,
          }));

    onCreate(odEvent, logs);
    void triggerSuccessHaptic();
    setSelection({});
    setTemplateLogs([]);
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
              className="mb-4 bg-transparent"
            />
          )}
        />

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
        <AutoFillTemplate onApply={applyTemplate} />

        <View className="mt-4">
          <SubjectHoursPicker
            subjects={subjects}
            value={selection}
            onChange={setSelection}
          />
        </View>

        <Button mode="contained" className="mt-5" onPress={submit}>
          Save OD event
        </Button>
      </ScrollView>
    </BottomSheet>
  );
};
