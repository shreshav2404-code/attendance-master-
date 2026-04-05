import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { Button } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="font-inter-bold text-3xl text-white">404</Text>
        <Text className="mt-3 text-center font-inter text-base text-white/60">
          This screen fell out of the timetable.
        </Text>
        <Button mode="contained" className="mt-6" onPress={() => router.replace("/(tabs)")}>
          Go back home
        </Button>
      </View>
    </SafeAreaView>
  );
}
