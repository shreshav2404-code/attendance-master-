import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Button, HelperText, TextInput } from "react-native-paper";

import { getTodayKey } from "@/lib/utils";
import type { Subject } from "@/types";

interface PendingODManualInput {
  subjectId: string;
  date: string;
  hours: number;
  reason: string;
}

interface PendingODManagerProps {
  subjects: Subject[];
  onManualAdd: (input: PendingODManualInput) => Promise<void> | void;
  onImportPress: () => Promise<void> | void;
  importLoading?: boolean;
  importSummary?: string;
}

export const PendingODManager = ({
  subjects,
  onManualAdd,
  onImportPress,
  importLoading = false,
  importSummary,
}: PendingODManagerProps) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjects[0]?.id ?? "");
  const [date, setDate] = useState(getTodayKey());
  const [hours, setHours] = useState("1");
  const [reason, setReason] = useState("Pending OD added manually");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedSubjectId && subjects.length > 0) {
      setSelectedSubjectId(subjects[0]?.id ?? "");
      return;
    }

    if (
      selectedSubjectId &&
      !subjects.some((subject) => subject.id === selectedSubjectId)
    ) {
      setSelectedSubjectId(subjects[0]?.id ?? "");
    }
  }, [selectedSubjectId, subjects]);

  const submitManual = async (): Promise<void> => {
    const numericHours = Number(hours);

    if (!selectedSubjectId) {
      setError("Select a subject");
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Date must be YYYY-MM-DD");
      return;
    }

    if (!Number.isFinite(numericHours) || numericHours <= 0) {
      setError("Hours must be greater than 0");
      return;
    }

    setError("");
    await onManualAdd({
      subjectId: selectedSubjectId,
      date,
      hours: numericHours,
      reason: reason.trim() || "Pending OD added manually",
    });
  };

  return (
    <View className="rounded-[28px] border border-white/10 bg-white/5 p-4">
      <Text className="font-inter-bold text-lg text-white">
        Pending OD adjustments
      </Text>
      <Text className="mt-2 font-inter text-sm leading-6 text-white/60">
        For students joining in between semester: add pending OD manually or import a CSV/XLSX file.
      </Text>

      <Text className="mt-4 font-inter-semibold text-sm text-white/75">
        Manual add
      </Text>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 10 }}
      >
        {subjects.map((subject) => (
          <Button
            key={subject.id}
            mode={selectedSubjectId === subject.id ? "contained-tonal" : "outlined"}
            onPress={() => setSelectedSubjectId(subject.id)}
          >
            {subject.shortName}
          </Button>
        ))}
      </ScrollView>

      <View className="mt-2 gap-3">
        <TextInput
          mode="outlined"
          label="Date (YYYY-MM-DD)"
          value={date}
          onChangeText={setDate}
          style={{ backgroundColor: "transparent" }}
        />
        <TextInput
          mode="outlined"
          label="Hours"
          value={hours}
          onChangeText={setHours}
          keyboardType="decimal-pad"
          style={{ backgroundColor: "transparent" }}
        />
        <TextInput
          mode="outlined"
          label="Reason"
          value={reason}
          onChangeText={setReason}
          style={{ backgroundColor: "transparent" }}
        />
      </View>
      <HelperText type="error" visible={Boolean(error)}>
        {error}
      </HelperText>
      <Button mode="contained" onPress={() => void submitManual()}>
        Add pending OD
      </Button>

      <View className="mt-5">
        <Text className="font-inter-semibold text-sm text-white/75">
          Bulk import (CSV/XLSX)
        </Text>
        <Text className="mt-2 font-inter text-xs leading-5 text-white/55">
          Accepted columns: `Date`, `Subject Code` or `Subject Name`, `Hours`, `Reason`.
        </Text>
        <Button
          className="mt-3"
          mode="contained-tonal"
          loading={importLoading}
          disabled={importLoading}
          onPress={() => void onImportPress()}
        >
          Import pending OD file
        </Button>
        {importSummary ? (
          <Text className="mt-2 font-inter text-xs text-white/60">
            {importSummary}
          </Text>
        ) : null}
      </View>
    </View>
  );
};
