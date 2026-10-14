import { router } from "expo-router";
import { ArrowLeft, Menu } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CoffeeCard } from "@/components/settings/CoffeeCard";
import { SettingsMenu, type SettingsPageKey } from "@/components/settings/SettingsMenu";
import { Toast } from "@/components/shared/Toast";
import type { ToastController } from "@/hooks/useToast";
import { triggerTapHaptic } from "@/lib/haptics";

interface SettingsPageProps {
  page: SettingsPageKey;
  title: string;
  description?: string;
  toast: ToastController;
  children: ReactNode;
}

/**
 * Shared frame for the Settings tab and its pages: back arrow (pages only),
 * the ☰ menu at the top right, the page content, then the coffee card.
 */
export const SettingsPage = ({
  page,
  title,
  description,
  toast,
  children,
}: SettingsPageProps) => {
  const [menuVisible, setMenuVisible] = useState(false);
  const isSettingsTab = page === "profile";

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Toast
        visible={Boolean(toast.state.message)}
        message={toast.state.message}
        type={toast.state.type}
      />
      <ScrollView
        nestedScrollEnabled
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        <View className="flex-row items-center justify-between">
          {isSettingsTab ? (
            <Text className="font-inter-bold text-3xl text-white">{title}</Text>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={10}
              onPress={() => {
                void triggerTapHaptic();
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace("/settings");
                }
              }}
              className="h-10 w-10 items-center justify-center rounded-full bg-white/5"
            >
              <ArrowLeft color="#f8fafc" size={20} />
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings menu"
            hitSlop={10}
            onPress={() => {
              void triggerTapHaptic();
              setMenuVisible(true);
            }}
            className="h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5"
          >
            <Menu color="#f8fafc" size={20} />
          </Pressable>
        </View>
        {isSettingsTab ? null : (
          <Text className="mt-4 font-inter-bold text-3xl text-white">{title}</Text>
        )}
        {description ? (
          <Text className="mt-2 font-inter text-sm leading-6 text-white/65">
            {description}
          </Text>
        ) : null}

        {children}

        <CoffeeCard toast={toast} />
      </ScrollView>
      <SettingsMenu
        visible={menuVisible}
        current={page}
        onClose={() => setMenuVisible(false)}
      />
    </SafeAreaView>
  );
};
