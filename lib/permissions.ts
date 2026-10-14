import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Runtime permissions AttendX uses. Files, PDFs and photos from the gallery go
// through Android's own pickers, which need no permission; installing an update
// is allowed by Android the first time the installer opens.

export type AppPermissionKey = "notifications" | "camera";

export interface AppPermissionStatus {
  key: AppPermissionKey;
  label: string;
  reason: string;
  granted: boolean;
  /** False once the user picked "Don't allow" too often: only system Settings can change it. */
  canAskAgain: boolean;
}

const DETAILS: Record<AppPermissionKey, { label: string; reason: string }> = {
  notifications: {
    label: "Notifications",
    reason: "Daily attendance reminder, low-attendance and pending-OD alerts.",
  },
  camera: {
    label: "Camera",
    reason: "Photographing a timetable, taking a profile photo and scanning timetable QR codes.",
  },
};

const PROMPTED_KEY = "attendx.permissions_prompted_v1";

const readStatus = async (key: AppPermissionKey) =>
  key === "notifications"
    ? Notifications.getPermissionsAsync()
    : ImagePicker.getCameraPermissionsAsync();

const request = async (key: AppPermissionKey) =>
  key === "notifications"
    ? Notifications.requestPermissionsAsync()
    : ImagePicker.requestCameraPermissionsAsync();

export const getPermissionStatuses = async (): Promise<AppPermissionStatus[]> =>
  Promise.all(
    (Object.keys(DETAILS) as AppPermissionKey[]).map(async (key) => {
      const status = await readStatus(key);
      return { key, ...DETAILS[key], granted: status.granted, canAskAgain: status.canAskAgain };
    }),
  );

// Android shows one permission dialog at a time; a second request made while one
// is open is dropped. Every request goes through this queue.
let queue: Promise<unknown> = Promise.resolve();

export const requestAppPermission = (key: AppPermissionKey): Promise<boolean> => {
  const run = queue.then(async () => {
    const current = await readStatus(key);
    if (current.granted || !current.canAskAgain) {
      return current.granted;
    }
    return (await request(key)).granted;
  });
  queue = run.catch(() => undefined);
  return run;
};

// Startup code asks from several places; share one request per app session, and
// pick up a permission granted later from the Permissions page or system Settings.
let notificationRequest: Promise<boolean> | null = null;

export const ensureNotificationPermission = async (): Promise<boolean> => {
  notificationRequest ??= requestAppPermission("notifications");
  if (await notificationRequest) {
    return true;
  }
  return (await Notifications.getPermissionsAsync()).granted;
};

/** Asks for every permission once, the first time the app runs after setup. */
export const askForAppPermissionsOnce = async (): Promise<void> => {
  if (Platform.OS === "web" || (await AsyncStorage.getItem(PROMPTED_KEY))) {
    return;
  }
  await AsyncStorage.setItem(PROMPTED_KEY, new Date().toISOString());
  await ensureNotificationPermission().catch(() => false);
  await requestAppPermission("camera").catch(() => false);
};
