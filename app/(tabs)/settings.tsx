import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Button, TextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { SettingsPage } from "@/components/settings/SettingsPage";
import { useStudent } from "@/hooks/useStudent";
import { useToast } from "@/hooks/useToast";
import { triggerTapHaptic } from "@/lib/haptics";
import type { Student } from "@/types";

const PROFILE_FIELDS = [
  ["name", "Full Name"],
  ["rollNo", "Roll Number"],
  ["batch", "Batch"],
  ["department", "Department"],
  ["collegeName", "College Name"],
  ["term", "Term"],
  ["targetPercentage", "Target %"],
] as const;

const toProfileForm = (student: Student | null) => ({
  name: student?.name ?? "",
  rollNo: student?.rollNo ?? "",
  batch: student?.batch ?? "",
  department: student?.department ?? "",
  collegeName: student?.collegeName ?? "",
  term: student?.term ?? "",
  targetPercentage: String(student?.targetPercentage ?? 75),
});

const getInitials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

// The Settings tab is the profile page; everything else opens from the ☰ menu
// (components/settings/SettingsMenu.tsx) as its own page under app/settings/.
export default function SettingsScreen() {
  const { student, updateStudent } = useStudent();
  const toast = useToast();
  const [profile, setProfile] = useState(() => toProfileForm(student));

  useEffect(() => {
    setProfile(toProfileForm(student));
  }, [student]);

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

  const subtitle = [student.rollNo, student.department, student.collegeName]
    .filter((part) => part.trim())
    .join(" · ");

  return (
    <SettingsPage
      page="profile"
      title="Settings"
      description="Your profile. Tap ☰ for OD, timetable, exam week, Saturdays, backups and help."
      toast={toast}
    >
      <View className="mt-6 flex-row items-center rounded-[28px] border border-white/10 bg-white/5 p-4">
        <View className="h-14 w-14 items-center justify-center rounded-full bg-[#1d4ed8]">
          <Text className="font-inter-bold text-xl text-white">
            {getInitials(student.name)}
          </Text>
        </View>
        <View className="ml-4 flex-1">
          <Text className="font-inter-bold text-lg text-white" numberOfLines={1}>
            {student.name}
          </Text>
          {subtitle ? (
            <Text className="mt-0.5 font-inter text-sm text-white/60" numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
          <Text className="mt-0.5 font-inter text-xs text-[#93c5fd]">
            Target {student.targetPercentage}%
          </Text>
        </View>
      </View>

      <View className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-4">
        <Text className="font-inter-bold text-lg text-white">Profile</Text>
        <View className="mt-4 gap-3">
          {PROFILE_FIELDS.map(([key, label]) => (
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
            const targetPercentage = Number(profile.targetPercentage.trim());

            // A non-number or out-of-range target broke every "hours needed" figure.
            if (
              !Number.isInteger(targetPercentage) ||
              targetPercentage < 1 ||
              targetPercentage > 100
            ) {
              await toast.warn("Target % must be a whole number from 1 to 100");
              return;
            }

            if (!profile.name.trim()) {
              await toast.warn("Name can't be empty");
              return;
            }

            await updateStudent({
              ...profile,
              name: profile.name.trim(),
              targetPercentage,
            });
            await toast.success("Profile updated");
          }}
        >
          Save profile
        </Button>
      </View>
    </SettingsPage>
  );
}
