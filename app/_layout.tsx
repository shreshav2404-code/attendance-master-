import "../global.css";

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import {
  Stack,
  useGlobalSearchParams,
  useRouter,
  useSegments,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { MD3DarkTheme, PaperProvider, ActivityIndicator } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { calculateAttendanceSummaries } from "@/lib/calculations";
import { COLORS } from "@/lib/constants";
import {
  cancelDailyReminder,
  configureNotificationChannel,
  requestNotificationPermissions,
  runProactiveAlerts,
  scheduleDailyReminder,
} from "@/lib/notifications";
import { useAttendanceStore } from "@/store/attendanceStore";
import { useODStore } from "@/store/odStore";
import { useStudentStore } from "@/store/studentStore";
import { useSubjectStore } from "@/store/subjectStore";

void SplashScreen.preventAutoHideAsync();

const paperTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: COLORS.secondary,
    secondary: COLORS.projected,
    background: COLORS.background,
    surface: COLORS.surface,
    surfaceVariant: COLORS.surfaceAlt,
    outline: COLORS.border,
    error: COLORS.danger,
    onSurface: COLORS.text,
    onSurfaceVariant: COLORS.textMuted,
  },
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const router = useRouter();
  const segments = useSegments();
  const searchParams = useGlobalSearchParams<{
    mode?: string | string[];
  }>();
  const hydrateStudent = useStudentStore((state) => state.hydrate);
  const hydrateSubjects = useSubjectStore((state) => state.hydrate);
  const hydrateAttendance = useAttendanceStore((state) => state.hydrate);
  const hydrateOD = useODStore((state) => state.hydrate);
  const onboarded = useStudentStore((state) => state.onboarded);
  const student = useStudentStore((state) => state.student);
  const notificationSettings = useStudentStore(
    (state) => state.notificationSettings,
  );
  const subjects = useSubjectStore((state) => state.subjects);
  const dailyLogs = useAttendanceStore((state) => state.dailyLogs);
  const odEvents = useODStore((state) => state.odEvents);
  const studentHydrated = useStudentStore((state) => state.hydrated);
  const subjectHydrated = useSubjectStore((state) => state.hydrated);
  const attendanceHydrated = useAttendanceStore((state) => state.hydrated);
  const odHydrated = useODStore((state) => state.hydrated);
  const notificationsGrantedRef = useRef<boolean | null>(null);

  useEffect(() => {
    void Promise.all([
      hydrateStudent(),
      hydrateSubjects(),
      hydrateAttendance(),
      hydrateOD(),
    ]);
  }, [hydrateAttendance, hydrateOD, hydrateStudent, hydrateSubjects]);

  const ready =
    fontsLoaded &&
    studentHydrated &&
    subjectHydrated &&
    attendanceHydrated &&
    odHydrated;

  useEffect(() => {
    if (!ready) {
      return;
    }

    void SplashScreen.hideAsync();
  }, [ready]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    const inOnboarding = segments[0] === "onboarding";
    const onboardingMode = Array.isArray(searchParams.mode)
      ? searchParams.mode[0]
      : searchParams.mode;
    const isOnboardingEditMode = onboardingMode === "edit";

    if (!onboarded && !inOnboarding) {
      router.replace("/onboarding/welcome");
      return;
    }

    if (onboarded && inOnboarding && !isOnboardingEditMode) {
      router.replace("/(tabs)");
    }
  }, [onboarded, ready, router, searchParams.mode, segments]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    let cancelled = false;

    const syncDailyReminder = async () => {
      if (notificationsGrantedRef.current === null) {
        notificationsGrantedRef.current = await requestNotificationPermissions();
      }

      if (!notificationsGrantedRef.current || cancelled) {
        return;
      }

      await configureNotificationChannel();

      if (notificationSettings.dailyReminderEnabled) {
        await scheduleDailyReminder(notificationSettings.dailyReminderTime);
        return;
      }

      await cancelDailyReminder();
    };

    void syncDailyReminder();

    return () => {
      cancelled = true;
    };
  }, [
    notificationSettings.dailyReminderEnabled,
    notificationSettings.dailyReminderTime,
    ready,
  ]);

  useEffect(() => {
    if (!ready || !student) {
      return;
    }

    let cancelled = false;

    const syncProactiveAlerts = async () => {
      if (notificationsGrantedRef.current === null) {
        notificationsGrantedRef.current = await requestNotificationPermissions();
      }

      if (!notificationsGrantedRef.current || cancelled) {
        return;
      }

      const summaries = calculateAttendanceSummaries({
        student,
        subjects,
        logs: dailyLogs,
        odEvents,
      });

      await runProactiveAlerts({
        notificationSettings,
        summaries,
        subjects,
        odEvents,
      });
    };

    void syncProactiveAlerts();

    return () => {
      cancelled = true;
    };
  }, [
    dailyLogs,
    notificationSettings,
    odEvents,
    ready,
    student,
    subjects,
  ]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={paperTheme}>
        <SafeAreaProvider>
          {ready ? (
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: COLORS.background },
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="subject/[id]" />
              <Stack.Screen name="od/[id]" />
            </Stack>
          ) : (
            <View className="flex-1 items-center justify-center bg-background">
              <ActivityIndicator animating color={COLORS.secondary} size="large" />
            </View>
          )}
        </SafeAreaProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
