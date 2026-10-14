import { router, type Href } from "expo-router";
import {
  Bell,
  BookOpen,
  CalendarRange,
  CalendarX2,
  ChevronRight,
  ClipboardList,
  Database,
  Info,
  RefreshCw,
  Table2,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { MotiView } from "moti";
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { triggerTapHaptic } from "@/lib/haptics";

export type SettingsPageKey =
  | "profile"
  | "od"
  | "sync"
  | "timetable"
  | "exam-week"
  | "saturdays"
  | "notifications"
  | "data"
  | "updates"
  | "help";

interface SettingsMenuItem {
  key: SettingsPageKey;
  label: string;
  hint: string;
  href: Href;
  Icon: LucideIcon;
}

// "Profile" is the Settings tab itself; every other page is a stack screen
// under app/settings/. Help & user manual stays last.
export const SETTINGS_MENU_ITEMS: SettingsMenuItem[] = [
  {
    key: "profile",
    label: "Profile",
    hint: "Name, roll number, target %",
    href: "/settings",
    Icon: UserRound,
  },
  {
    key: "od",
    label: "OD",
    hint: "Add or import pending OD",
    href: "/settings/od",
    Icon: ClipboardList,
  },
  {
    key: "sync",
    label: "Official sync",
    hint: "Match the college attendance report",
    href: "/settings/sync",
    Icon: RefreshCw,
  },
  {
    key: "timetable",
    label: "Timetable",
    hint: "Subjects, timings, photo scan, share",
    href: "/settings/timetable",
    Icon: Table2,
  },
  {
    key: "exam-week",
    label: "Exam week",
    hint: "Suspend classes for a date range",
    href: "/settings/exam-week",
    Icon: CalendarX2,
  },
  {
    key: "saturdays",
    label: "Flexible Saturdays",
    hint: "Working day or holiday, per Saturday",
    href: "/settings/saturdays",
    Icon: CalendarRange,
  },
  {
    key: "notifications",
    label: "Notifications",
    hint: "Daily reminder and alerts",
    href: "/settings/notifications",
    Icon: Bell,
  },
  {
    key: "data",
    label: "Data management",
    hint: "Backup, restore, PDF, clear data",
    href: "/settings/data",
    Icon: Database,
  },
  {
    key: "updates",
    label: "Updates & about",
    hint: "App version, updates, share app",
    href: "/settings/updates",
    Icon: Info,
  },
  {
    key: "help",
    label: "Help & user manual",
    hint: "How to use AttendX",
    href: "/help",
    Icon: BookOpen,
  },
];

interface SettingsMenuProps {
  visible: boolean;
  current: SettingsPageKey;
  onClose: () => void;
}

const openSettingsPage = (current: SettingsPageKey, item: SettingsMenuItem) => {
  if (item.key === current) {
    return;
  }

  // Back to the Settings tab: pop the open page instead of stacking another tab screen.
  if (item.key === "profile") {
    router.dismissTo(item.href);
    return;
  }

  // From the tab, push the page. Between pages, replace it so Back always
  // returns to the Settings tab instead of walking through every page opened.
  if (current === "profile") {
    router.push(item.href);
  } else {
    router.replace(item.href);
  }
};

export const SettingsMenu = ({ visible, current, onClose }: SettingsMenuProps) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(320, Math.round(width * 0.82));

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 flex-row justify-end">
        <Pressable
          accessibilityLabel="Close menu"
          className="absolute inset-0 bg-black/60"
          onPress={onClose}
        />
        <MotiView
          from={{ translateX: panelWidth }}
          animate={{ translateX: 0 }}
          transition={{ type: "timing", duration: 220 }}
          className="h-full border-l border-white/10 bg-surface"
          style={{
            width: panelWidth,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
          }}
        >
          <View className="mb-3 flex-row items-center justify-between px-5">
            <Text className="font-inter-bold text-xl text-white">Settings</Text>
            <Pressable
              accessibilityLabel="Close menu"
              onPress={onClose}
              hitSlop={10}
              className="h-9 w-9 items-center justify-center rounded-full bg-white/5"
            >
              <X color="#f8fafc" size={18} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12 }}>
            {SETTINGS_MENU_ITEMS.map((item) => {
              const active = item.key === current;
              const { Icon } = item;

              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    void triggerTapHaptic();
                    onClose();
                    openSettingsPage(current, item);
                  }}
                  className="mb-1 flex-row items-center rounded-2xl px-3 py-3"
                  style={active ? { backgroundColor: "rgba(59,130,246,0.16)" } : undefined}
                >
                  <View
                    className="h-9 w-9 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: active
                        ? "rgba(59,130,246,0.25)"
                        : "rgba(255,255,255,0.06)",
                    }}
                  >
                    <Icon color={active ? "#93c5fd" : "#f8fafc"} size={18} />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text
                      className="font-inter-semibold text-[15px]"
                      style={{ color: active ? "#bfdbfe" : "#f8fafc" }}
                    >
                      {item.label}
                    </Text>
                    <Text className="mt-0.5 font-inter text-xs text-white/50">
                      {item.hint}
                    </Text>
                  </View>
                  {active ? null : (
                    <ChevronRight color="rgba(248,250,252,0.35)" size={16} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </MotiView>
      </View>
    </Modal>
  );
};
