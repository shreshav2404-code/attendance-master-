import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Button, TextInput } from "react-native-paper";

import type {
  AttendanceSummary,
  OfficialSubjectInput,
  Subject,
  SyncReport,
} from "@/types";

interface SyncReportFormProps {
  subjects: Subject[];
  summaries: AttendanceSummary[];
  onApply: (officialInputs: OfficialSubjectInput[]) => SyncReport[];
}

export const SyncReportForm = ({
  subjects,
  summaries,
  onApply,
}: SyncReportFormProps) => {
  const [rows, setRows] = useState<Record<string, OfficialSubjectInput>>(
    Object.fromEntries(
      subjects.map((subject) => {
        const summary = summaries.find((item) => item.subjectId === subject.id);

        return [
          subject.id,
          {
            subjectId: subject.id,
            officialTH: summary?.TH ?? 0,
            officialAH: summary?.AH ?? 0,
            officialDL: summary?.DL ?? 0,
          },
        ];
      }),
    ),
  );
  const [reports, setReports] = useState<SyncReport[]>([]);

  return (
    <View className="rounded-[28px] border border-white/10 bg-white/5 p-4">
      <Text className="font-inter-bold text-lg text-white">
        Sync with official report
      </Text>
      <ScrollView
        className="mt-4"
        style={{ maxHeight: 420 }}
        contentContainerStyle={{ paddingBottom: 8 }}
        keyboardDismissMode="on-drag"
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-4">
          {subjects.map((subject) => {
            const currentRow = rows[subject.id];

            return (
              <View
                key={subject.id}
                className="rounded-[22px] border border-white/10 bg-black/10 p-4"
              >
                <Text className="font-inter-semibold text-base text-white">
                  {subject.name}
                </Text>
                <Text className="mt-1 font-inter text-xs text-white/50">
                  {subject.code}
                </Text>
                <View className="mt-3 gap-3">
                  <TextInput
                    mode="outlined"
                    label="Official TH"
                    value={String(currentRow?.officialTH ?? 0)}
                    keyboardType="number-pad"
                    onChangeText={(value) =>
                      setRows((currentRows) => ({
                        ...currentRows,
                        [subject.id]: {
                          ...(currentRows[subject.id] ?? {
                            subjectId: subject.id,
                            officialTH: 0,
                            officialAH: 0,
                            officialDL: 0,
                          }),
                          officialTH: Number(value || 0),
                        },
                      }))
                    }
                  />
                  <TextInput
                    mode="outlined"
                    label="Official AH"
                    value={String(currentRow?.officialAH ?? 0)}
                    keyboardType="number-pad"
                    onChangeText={(value) =>
                      setRows((currentRows) => ({
                        ...currentRows,
                        [subject.id]: {
                          ...(currentRows[subject.id] ?? {
                            subjectId: subject.id,
                            officialTH: 0,
                            officialAH: 0,
                            officialDL: 0,
                          }),
                          officialAH: Number(value || 0),
                        },
                      }))
                    }
                  />
                  <TextInput
                    mode="outlined"
                    label="Official DL"
                    value={String(currentRow?.officialDL ?? 0)}
                    keyboardType="number-pad"
                    onChangeText={(value) =>
                      setRows((currentRows) => ({
                        ...currentRows,
                        [subject.id]: {
                          ...(currentRows[subject.id] ?? {
                            subjectId: subject.id,
                            officialTH: 0,
                            officialAH: 0,
                            officialDL: 0,
                          }),
                          officialDL: Number(value || 0),
                        },
                      }))
                    }
                  />
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Button
        mode="contained"
        className="mt-4"
        onPress={() => setReports(onApply(Object.values(rows)))}
      >
        Compare and apply
      </Button>

      {reports.length > 0 ? (
        <View className="mt-4 gap-3">
          {reports.map((report) => (
            <View
              key={report.subjectId}
              className="rounded-[20px] bg-black/15 px-4 py-3"
            >
              <Text className="font-inter-semibold text-sm text-white">
                {subjects.find((subject) => subject.id === report.subjectId)?.shortName ??
                  report.subjectId}
              </Text>
              <Text className="mt-1 font-inter text-xs text-white/55">
                TH diff: {report.thDiff} · AH diff: {report.ahDiff} · Newly
                registered OD: {report.newlyRegisteredOD}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};
