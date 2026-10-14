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
import { useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  MD3DarkTheme,
  PaperProvider,
  ActivityIndicator,
  Button,
} from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { checkForAppUpdate } from "@/lib/appUpdate";
import { calculateAttendanceSummaries } from "@/lib/calculations";
import { COLORS } from "@/lib/constants";
import {
  cancelDailyReminder,
  configureNotificationChannel,
  runProactiveAlerts,
  scheduleDailyReminder,
} from "@/lib/notifications";
import { useAttendanceStore } from "@/store/attendanceStore";
import { useODStore } from "@/store/odStore";
import { askForAppPermissionsOnce, ensureNotificationPermission } from "@/lib/permissions";
import { useStudentStore } from "@/store/studentStore";
import { useSubjectStore } from "@/store/subjectStore";

void SplashScreen.preventAutoHideAsync();

const paperTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: COLORS.secondary,
    // MD3's default onPrimary is a dark purple meant for a light primary; on this
    // blue it made every filled button's label unreadable.
    onPrimary: COLORS.white,
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
  const officialSyncSnapshotBySubject = useStudentStore(
    (state) => state.officialSyncSnapshotBySubject,
  );
  const subjects = useSubjectStore((state) => state.subjects);
  const dailyLogs = useAttendanceStore((state) => state.dailyLogs);
  const odEvents = useODStore((state) => state.odEvents);
  const studentHydrated = useStudentStore((state) => state.hydrated);
  const subjectHydrated = useSubjectStore((state) => state.hydrated);
  const attendanceHydrated = useAttendanceStore((state) => state.hydrated);
  const odHydrated = useODStore((state) => state.hydrated);
  const [forceUpdateUrl, setForceUpdateUrl] = useState<string | undefined>(
    undefined,
  );
  const [forceUpdateVersion, setForceUpdateVersion] = useState<string | undefined>(
    undefined,
  );

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

  // First run after setup: ask for every permission the app uses, one at a time.
  useEffect(() => {
    if (ready && onboarded) {
      void askForAppPermissionsOnce();
    }
  }, [onboarded, ready]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    let cancelled = false;

    const syncDailyReminder = async () => {
      const notificationsGranted = await ensureNotificationPermission();

      if (!notificationsGranted || cancelled) {
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
      const notificationsGranted = await ensureNotificationPermission();

      if (!notificationsGranted || cancelled) {
        return;
      }

      const summaries = calculateAttendanceSummaries({
        student,
        subjects,
        logs: dailyLogs,
        odEvents,
        officialSyncSnapshotBySubject,
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
    officialSyncSnapshotBySubject,
    ready,
    student,
    subjects,
  ]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    let cancelled = false;

    const runForceUpdateCheck = async () => {
      const result = await checkForAppUpdate();

      if (cancelled) {
        return;
      }

      if (result.isForceUpdate && result.updateUrl) {
        setForceUpdateUrl(result.updateUrl);
        setForceUpdateVersion(result.manifest?.latestVersion);
        return;
      }

      setForceUpdateUrl(undefined);
      setForceUpdateVersion(undefined);
    };

    void runForceUpdateCheck();

    return () => {
      cancelled = true;
    };
  }, [ready]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* SafeAreaProvider wraps PaperProvider: menus and sheets render through
          Paper's Portal (components/shared/Overlay.tsx) and need the insets. */}
      <SafeAreaProvider>
        <PaperProvider theme={paperTheme}>
          {ready ? (
            forceUpdateVersion ? (
              <View className="flex-1 items-center justify-center bg-background px-6">
                <Text className="text-center font-inter-bold text-3xl text-white">
                  Update Required
                </Text>
                <Text className="mt-3 text-center font-inter text-sm leading-6 text-white/70">
                  A mandatory version is available. Please install version{" "}
                  {forceUpdateVersion} to continue using AttendX.
                </Text>
                <Button
                  mode="contained"
                  style={{ marginTop: 22 }}
                  disabled={!forceUpdateUrl}
                  onPress={async () => {
                    if (!forceUpdateUrl) {
                      return;
                    }
                    await Linking.openURL(forceUpdateUrl);
                  }}
                >
                  Download Update
                </Button>
                <Button
                  mode="text"
                  style={{ marginTop: 8 }}
                  onPress={async () => {
                    const result = await checkForAppUpdate();
                    if (!(result.isForceUpdate && result.updateUrl)) {
                      setForceUpdateUrl(undefined);
                      setForceUpdateVersion(undefined);
                    }
                  }}
                >
                  I have updated, retry
                </Button>
              </View>
            ) : (
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: COLORS.background },
                }}
              >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="onboarding" />
                <Stack.Screen name="help/index" />
                <Stack.Screen name="subject/[id]" />
                <Stack.Screen name="od/[id]" />
              </Stack>
            )
          ) : (
            <View className="flex-1 items-center justify-center bg-background">
              <ActivityIndicator animating color={COLORS.secondary} size="large" />
            </View>
          )}
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
