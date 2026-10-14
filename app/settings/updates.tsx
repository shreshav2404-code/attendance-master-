import Constants from "expo-constants";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useEffect, useMemo, useState } from "react";
import { Linking, Platform, Share, Text, View } from "react-native";
import { Button } from "react-native-paper";

import { SettingsPage } from "@/components/settings/SettingsPage";
import { useToast } from "@/hooks/useToast";
import {
  checkForAppUpdate,
  getConfiguredUpdateUrl,
  getCurrentAppVersion,
  type AppUpdateResult,
} from "@/lib/appUpdate";
import { triggerTapHaptic } from "@/lib/haptics";

export default function UpdatesSettingsScreen() {
  const toast = useToast();
  const { show: showToast } = toast;
  const [updateCheck, setUpdateCheck] = useState<AppUpdateResult | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [downloadingUpdate, setDownloadingUpdate] = useState(false);
  const [updateDownloadProgress, setUpdateDownloadProgress] = useState(0);
  const currentAppVersion = useMemo(() => getCurrentAppVersion(), []);
  const latestReleaseLabel = useMemo(() => {
    if (updateCheck?.manifest?.latestVersion) {
      return updateCheck.manifest.latestVersion;
    }
    if (updateCheck?.updateUrl) {
      return "Direct APK link";
    }
    return "Unknown";
  }, [updateCheck]);

  const refreshUpdateCheck = async ({
    showLatestToast = false,
  }: {
    showLatestToast?: boolean;
  } = {}): Promise<void> => {
    setCheckingUpdates(true);

    try {
      const result = await checkForAppUpdate();
      setUpdateCheck(result);

      if (result.error) {
        await toast.warn(result.error);
        return;
      }

      if (result.isForceUpdate) {
        await toast.warn("Mandatory update available. Please update to continue safely.", 2600);
        return;
      }

      if (!showLatestToast) {
        return;
      }

      if (result.isUpdateAvailable) {
        await toast.success("New update available.");
        return;
      }

      if (result.updateUrl && !result.manifest) {
        await toast.success("Direct APK link is ready.");
        return;
      }

      await toast.success("You are already on the latest version.");
    } finally {
      setCheckingUpdates(false);
    }
  };

  useEffect(() => {
    // Silent check when the page opens; errors still show a toast.
    let cancelled = false;
    void checkForAppUpdate().then((result) => {
      if (cancelled) {
        return;
      }
      setUpdateCheck(result);
      if (result.error) {
        showToast(result.error, "warning", 2200);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const openUpdateDownload = async (): Promise<void> => {
    await triggerTapHaptic();

    const updateUrl = updateCheck?.updateUrl;
    if (!updateUrl) {
      await toast.warn("Update link unavailable. Configure release manifest first.", 2400);
      return;
    }

    if (Platform.OS !== "android") {
      try {
        await Linking.openURL(updateUrl);
        await toast.success("Opening update page.", 2200);
      } catch {
        await toast.warn("Unable to open update link.");
      }
      return;
    }

    try {
      setDownloadingUpdate(true);
      setUpdateDownloadProgress(0);

      const baseDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!baseDirectory) {
        throw new Error("Local storage is unavailable for update download.");
      }

      const targetUri = `${baseDirectory}attendx-update-${Date.now()}.apk`;
      const downloadTask = FileSystem.createDownloadResumable(
        updateUrl,
        targetUri,
        {},
        (progress) => {
          if (progress.totalBytesExpectedToWrite <= 0) {
            return;
          }
          setUpdateDownloadProgress(
            progress.totalBytesWritten / progress.totalBytesExpectedToWrite,
          );
        },
      );

      const result = await downloadTask.downloadAsync();
      if (!result || result.status < 200 || result.status >= 300) {
        throw new Error("APK download failed.");
      }

      let openedInstaller = false;
      try {
        const contentUri = await FileSystem.getContentUriAsync(result.uri);
        await Linking.openURL(contentUri);
        openedInstaller = true;
      } catch {}

      if (!openedInstaller) {
        try {
          await Linking.openURL(result.uri);
          openedInstaller = true;
        } catch {}
      }

      if (!openedInstaller) {
        await Sharing.shareAsync(result.uri, {
          mimeType: "application/vnd.android.package-archive",
          dialogTitle: "Install AttendX update",
        });
      }

      await toast.success("APK downloaded. Continue install from package installer.", 2200);
    } catch (error) {
      await toast.warn(error instanceof Error ? error.message : "Unable to download update.");
    } finally {
      setDownloadingUpdate(false);
      setUpdateDownloadProgress(0);
    }
  };

  return (
    <SettingsPage
      page="updates"
      title="Updates & about"
      description="Check for a newer AttendX build and share the app with friends."
      toast={toast}
    >
      <View className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-4">
        <Text className="font-inter-bold text-lg text-white">App updates</Text>
        <Text className="mt-2 font-inter text-sm text-white/65">
          Current version: {currentAppVersion}
        </Text>
        <Text className="mt-1 font-inter text-sm text-white/65">
          Latest release: {latestReleaseLabel}
        </Text>
        {!updateCheck?.manifest && updateCheck?.updateUrl ? (
          <Text className="mt-2 font-inter text-xs leading-5 text-white/55">
            Release manifest is unavailable, direct APK link mode is active.
          </Text>
        ) : null}
        {updateCheck?.manifest?.notes ? (
          <Text className="mt-2 font-inter text-xs leading-5 text-white/55">
            {updateCheck.manifest.notes}
          </Text>
        ) : null}
        {updateCheck?.isForceUpdate ? (
          <Text className="mt-3 font-inter-semibold text-sm text-[#fca5a5]">
            Mandatory update required. Install latest build before continuing.
          </Text>
        ) : null}
        {updateCheck?.isUpdateAvailable && !updateCheck?.isForceUpdate ? (
          <Text className="mt-3 font-inter-semibold text-sm text-[#93c5fd]">
            New update available.
          </Text>
        ) : null}
        <View className="mt-4 flex-row flex-wrap gap-3">
          <Button
            mode="outlined"
            loading={checkingUpdates}
            disabled={checkingUpdates}
            onPress={() => {
              void triggerTapHaptic();
              void refreshUpdateCheck({ showLatestToast: true });
            }}
          >
            Check for updates
          </Button>
          <Button
            mode="contained-tonal"
            loading={downloadingUpdate}
            disabled={!updateCheck?.updateUrl || downloadingUpdate}
            onPress={() => {
              void openUpdateDownload();
            }}
          >
            {downloadingUpdate
              ? `Downloading ${Math.round(updateDownloadProgress * 100)}%`
              : "Download latest APK"}
          </Button>
        </View>
      </View>

      <View className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-4">
        <Text className="font-inter-bold text-lg text-white">About</Text>
        <Text className="mt-3 font-inter text-sm text-white/65">
          Version {Constants.expoConfig?.version ?? "1.0.0"} · Built with AttendX
        </Text>
        <Text className="mt-2 font-inter text-sm text-white/65">
          Made with love{" "}
          <Text
            className="font-inter-semibold"
            style={{ color: "#60a5fa" }}
            onPress={async () => {
              await triggerTapHaptic();
              await Linking.openURL("https://instagram.com/the_jha_keshav2404");
            }}
          >
            keshav jha
          </Text>
        </Text>
        <Text className="mt-1 font-inter text-sm text-white/65">
          Checkout my portfolio{" "}
          <Text
            className="font-inter-semibold"
            style={{ color: "#60a5fa" }}
            onPress={async () => {
              await triggerTapHaptic();
              await Linking.openURL("https://portfolio-keshav.vercel.app");
            }}
          >
            portfolio-keshav.vercel.app
          </Text>
        </Text>
        <Button
          mode="outlined"
          style={{ marginTop: 16 }}
          onPress={async () => {
            await triggerTapHaptic();
            // The GitHub repo is private, so its releases link 404s for anyone
            // the message is sent to; share the app's own APK download link.
            const downloadUrl = getConfiguredUpdateUrl();
            await Share.share({
              message: [
                "AttendX helps you track physical attendance, official OD, and projected recovery in one place.",
                ...(downloadUrl ? ["", "Download the Android app:", downloadUrl] : []),
                "",
                "Checkout my portfolio:",
                "https://portfolio-keshav.vercel.app",
                "",
                "Instagram:",
                "https://instagram.com/the_jha_keshav2404",
              ].join("\n"),
            });
          }}
        >
          Share app link
        </Button>
      </View>
    </SettingsPage>
  );
}
