import { Camera } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button, TextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { SettingsPage } from "@/components/settings/SettingsPage";
import { BottomSheet } from "@/components/shared/BottomSheet";
import { ProfileAvatar } from "@/components/shared/ProfileAvatar";
import { useStudent } from "@/hooks/useStudent";
import { useToast } from "@/hooks/useToast";
import { triggerTapHaptic } from "@/lib/haptics";
import { pickProfilePhoto, removeProfilePhoto } from "@/lib/profilePhoto";
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

// The Settings tab is the profile page; everything else opens from the ☰ menu
// (components/settings/SettingsMenu.tsx) as its own page under app/settings/.
export default function SettingsScreen() {
  const { student, updateStudent } = useStudent();
  const toast = useToast();
  const [profile, setProfile] = useState(() => toProfileForm(student));
  const [photoSheetVisible, setPhotoSheetVisible] = useState(false);

  const changePhoto = async (source: "camera" | "library") => {
    void triggerTapHaptic();
    setPhotoSheetVisible(false);
    try {
      const photoUri = await pickProfilePhoto(source, student?.photoUri);
      if (photoUri) {
        await updateStudent({ photoUri });
        await toast.success("Profile photo updated");
      }
    } catch (error) {
      await toast.warn(error instanceof Error ? error.message : "Couldn't update the photo.");
    }
  };

  const removePhoto = async () => {
    void triggerTapHaptic();
    setPhotoSheetVisible(false);
    await removeProfilePhoto(student?.photoUri);
    await updateStudent({ photoUri: undefined });
    await toast.success("Profile photo removed");
  };

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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
          hitSlop={8}
          onPress={() => {
            void triggerTapHaptic();
            setPhotoSheetVisible(true);
          }}
        >
          <ProfileAvatar name={student.name} photoUri={student.photoUri} size={64} />
          <View className="absolute -bottom-0.5 -right-0.5 h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-[#2563eb]">
            <Camera color="#f8fafc" size={12} />
          </View>
        </Pressable>
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
      <BottomSheet
        visible={photoSheetVisible}
        title="Profile photo"
        onClose={() => setPhotoSheetVisible(false)}
      >
        <View className="gap-3">
          <Button mode="contained" icon="image" onPress={() => void changePhoto("library")}>
            Choose from gallery
          </Button>
          <Button mode="contained-tonal" icon="camera" onPress={() => void changePhoto("camera")}>
            Take a photo
          </Button>
          {student.photoUri ? (
            <Button mode="outlined" icon="delete" textColor="#fca5a5" onPress={() => void removePhoto()}>
              Remove photo
            </Button>
          ) : null}
        </View>
      </BottomSheet>
    </SettingsPage>
  );
}
