import { router } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import { View, Text } from "react-native";
import { Button } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { GradientCard } from "@/components/shared/GradientCard";
import { APP_COPY } from "@/lib/constants";
import { triggerTapHaptic } from "@/lib/haptics";

export default function WelcomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-between px-5 py-6">
        <View className="pt-6">
          <View className="h-24 w-24 items-center justify-center rounded-[32px] border border-white/10 bg-white/5">
            <Text className="font-inter-bold text-3xl text-white">AX</Text>
          </View>
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
        </GradientCard>
      </View>
    </SafeAreaView>
  );
}
