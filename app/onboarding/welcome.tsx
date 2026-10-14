import { router } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import { useState } from "react";
import { Image, View, Text } from "react-native";
import { Button } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { GradientCard } from "@/components/shared/GradientCard";
import { pickAndRestoreBackup } from "@/lib/backupRestore";
import { APP_COPY } from "@/lib/constants";
import { triggerTapHaptic } from "@/lib/haptics";

export default function WelcomeScreen() {
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState("");

  // Reinstall or new phone: bring everything back from a JSON backup. The root
  // layout sees the restored onboarded flag and opens the dashboard.
  const restore = async () => {
    void triggerTapHaptic();
    setRestoreError("");
    setRestoring(true);
    try {
      await pickAndRestoreBackup();
    } catch (error) {
      setRestoreError(error instanceof Error ? error.message : "Couldn't read that backup file.");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-between px-5 py-6">
        <View className="pt-6">
          <Image
            source={require("../../assets/images/icon.png")}
            accessibilityLabel="AttendX logo"
            style={{ width: 96, height: 96, borderRadius: 26 }}
          />
          <Text className="mt-8 font-inter-bold text-4xl leading-[48px] text-white">
            AttendX
          </Text>
          <Text className="mt-3 font-inter text-lg leading-8 text-white/65">
            {APP_COPY.tagline}
          </Text>
        </View>

        <GradientCard contentClassName="gap-4">
          <Text className="font-inter-bold text-2xl text-white">
            Smart attendance and OD tracking for Indian college life
          </Text>
          <Text className="font-inter text-base leading-7 text-white/70">
            Build your timetable once, mark classes in seconds, track official
            and pending OD separately, and stop guessing whether you can skip.
          </Text>
          <Button
            mode="contained"
            onPress={() => {
              void triggerTapHaptic();
              router.push("/onboarding/student-info");
            }}
            contentStyle={{ paddingVertical: 8 }}
          >
            Get Started
          </Button>
          <View className="flex-row items-center gap-2">
            <ArrowRight color="#f8fafc" size={16} />
            <Text className="font-inter text-sm text-white/60">
              Setup takes about 2 minutes.
            </Text>
          </View>
          <Button
            mode="outlined"
            icon="backup-restore"
            textColor="#f8fafc"
            style={{ borderColor: "rgba(248,250,252,0.45)" }}
            loading={restoring}
            disabled={restoring}
            onPress={() => void restore()}
          >
            Restore from backup
          </Button>
          {restoreError ? (
            <Text className="font-inter text-xs leading-5 text-red-300">{restoreError}</Text>
          ) : null}
        </GradientCard>
      </View>
    </SafeAreaView>
  );
}
