import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Controller, useForm } from "react-hook-form";
import { Button, HelperText, TextInput } from "react-native-paper";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { ProgressBar } from "@/components/shared/ProgressBar";
import { triggerSuccessHaptic, triggerTapHaptic } from "@/lib/haptics";
import { generateId } from "@/lib/utils";
import { useStudent } from "@/hooks/useStudent";

const studentSchema = z.object({
  name: z.string().min(2, "Full name is required"),
  rollNo: z.string().min(2, "Roll number is required"),
  batch: z.string().min(2, "Batch is required"),
  department: z.string().min(2, "Department is required"),
  collegeName: z.string().min(2, "College name is required"),
  term: z.string().min(2, "Term is required"),
});

type StudentFormValues = z.infer<typeof studentSchema>;

export default function StudentInfoScreen() {
  const { student, setStudent } = useStudent();
  const [targetPercentage, setTargetPercentage] = useState(
    student?.targetPercentage ?? 75,
  );
  const defaultValues = useMemo<StudentFormValues>(
    () => ({
      name: student?.name ?? "",
      rollNo: student?.rollNo ?? "",
      batch: student?.batch ?? "",
      department: student?.department ?? "",
      collegeName: student?.collegeName ?? "",
      term: student?.term ?? "",
    }),
    [student],
  );
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues,
  });

  const submit = handleSubmit(async (values) => {
    await triggerTapHaptic();
    await setStudent({
      id: student?.id ?? generateId("student"),
      createdAt: student?.createdAt ?? new Date().toISOString(),
      targetPercentage,
      ...values,
    });
    await triggerSuccessHaptic();
    router.push("/onboarding/schedule");
  });

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text className="font-inter text-sm uppercase tracking-[1.2px] text-white/50">
          Step 1 of 5
        </Text>
        <Text className="mt-3 font-inter-bold text-3xl text-white">
          Student info
        </Text>
        <Text className="mt-2 font-inter text-base leading-7 text-white/65">
          Enter the details that will appear across your dashboard, PDF reports,
          and share summary.
        </Text>

        <View className="mt-5">
          <ProgressBar progress={20} />
        </View>

        <View className="mt-6 gap-1">
          {(
            [
              ["name", "Full Name"],
              ["rollNo", "Roll Number"],
              ["batch", "Batch"],
              ["department", "Department"],
              ["collegeName", "College Name"],
              ["term", "Term"],
            ] as const
          ).map(([name, label]) => (
            <View key={name}>
              <Controller
                control={control}
                name={name}
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    mode="outlined"
                    label={label}
                    value={value}
                    onChangeText={onChange}
                    style={{ backgroundColor: "transparent", marginBottom: 2 }}
                  />
                )}
              />
              <HelperText type="error" visible={Boolean(errors[name])}>
                {errors[name]?.message}
              </HelperText>
            </View>
          ))}
        </View>

        <View className="mt-4 rounded-[24px] border border-white/10 bg-white/5 p-4">
          <Text className="font-inter-semibold text-sm text-white/75">
            Target attendance percentage
          </Text>
          <View className="mt-4 flex-row items-center justify-between">
            <Pressable
              className="rounded-full border border-white/10 bg-black/20 px-4 py-3"
              onPress={() => setTargetPercentage((currentValue) => Math.max(60, currentValue - 1))}
            >
              <Text className="font-inter-semibold text-white">-1%</Text>
            </Pressable>
            <Text className="font-inter-bold text-3xl text-white">
              {targetPercentage}%
            </Text>
            <Pressable
              className="rounded-full border border-white/10 bg-black/20 px-4 py-3"
              onPress={() => setTargetPercentage((currentValue) => Math.min(95, currentValue + 1))}
            >
              <Text className="font-inter-semibold text-white">+1%</Text>
            </Pressable>
          </View>
        </View>

        <Button
          mode="contained"
          onPress={submit}
          style={{ marginTop: 24 }}
          contentStyle={{ paddingVertical: 8 }}
        >
          Continue to schedule
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
