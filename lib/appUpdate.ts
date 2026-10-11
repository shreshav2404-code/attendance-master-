import Constants from "expo-constants";
import { Platform } from "react-native";

export interface ReleaseManifest {
  latestVersion: string;
  minimumVersion: string;
  apkUrl?: string;
  iosStoreUrl?: string;
  notes?: string;
  publishedAt?: string;
}

export interface AppUpdateResult {
  currentVersion: string;
  manifestUrl: string;
  manifest?: ReleaseManifest;
  isUpdateAvailable: boolean;
  isForceUpdate: boolean;
  updateUrl?: string;
  error?: string;
}

interface UpdatesExtraConfig {
  releaseManifestUrl?: string;
  androidApkUrl?: string;
  iosStoreUrl?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readTrimmedString = (
  source: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = source[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const getUpdatesExtraConfig = (): UpdatesExtraConfig => {
  const extra = Constants.expoConfig?.extra;

  if (!isRecord(extra)) {
    return {};
  }

  const updates = extra.updates;
  if (!isRecord(updates)) {
    return {};
  }

  return {
    releaseManifestUrl: readTrimmedString(updates, "releaseManifestUrl"),
    androidApkUrl: readTrimmedString(updates, "androidApkUrl"),
    iosStoreUrl: readTrimmedString(updates, "iosStoreUrl"),
  };
};

const normalizeVersionString = (value: string): string =>
  value.trim().split("-")[0] ?? value.trim();

const toVersionParts = (value: string): number[] => {
  const normalized = normalizeVersionString(value);
  return normalized.split(".").map((segment) => {
    const parsed = Number.parseInt(segment, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  });
};

export const compareVersions = (left: string, right: string): number => {
  const leftParts = toVersionParts(left);
  const rightParts = toVersionParts(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;

    if (leftValue > rightValue) {
      return 1;
    }
    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
};

export const getCurrentAppVersion = (): string =>
  Constants.expoConfig?.version?.trim() || "0.0.0";

export const getReleaseManifestUrl = (): string =>
  getUpdatesExtraConfig().releaseManifestUrl ?? "";

export const getConfiguredUpdateUrl = (): string | undefined => {
  const updatesConfig = getUpdatesExtraConfig();

  if (Platform.OS === "android") {
    return updatesConfig.androidApkUrl;
  }

  return updatesConfig.iosStoreUrl;
};

const normalizeManifest = (value: unknown): ReleaseManifest => {
  if (!isRecord(value)) {
    throw new Error("Release manifest is invalid.");
  }

  const latestVersion = readTrimmedString(value, "latestVersion");
  const minimumVersion =
    readTrimmedString(value, "minimumVersion") ?? latestVersion;

  if (!latestVersion || !minimumVersion) {
    throw new Error("Release manifest must include latestVersion.");
  }

  return {
    latestVersion,
    minimumVersion,
    apkUrl: readTrimmedString(value, "apkUrl"),
    iosStoreUrl: readTrimmedString(value, "iosStoreUrl"),
    notes: readTrimmedString(value, "notes"),
    publishedAt: readTrimmedString(value, "publishedAt"),
  };
};

// The release manifest is fetched from a public URL that anyone who knows it can
// overwrite, so only follow download links to hosts the real releases use.
const TRUSTED_UPDATE_HOSTS = ["expo.dev", "github.com", "githubusercontent.com", "apps.apple.com"];

export const isTrustedUpdateUrl = (url: string): boolean => {
  try {
    const { protocol, hostname } = new URL(url);
    return (
      protocol === "https:" &&
      TRUSTED_UPDATE_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))
    );
  } catch {
    return false;
  }
};

export const resolveUpdateUrl = (manifest: ReleaseManifest): string | undefined => {
  const manifestUrl = manifest.apkUrl ?? manifest.iosStoreUrl;

  if (manifestUrl && isTrustedUpdateUrl(manifestUrl)) {
    return manifestUrl;
  }

  return getConfiguredUpdateUrl();
};

const buildDirectDownloadFallbackResult = ({
  currentVersion,
  manifestUrl,
  errorMessage,
}: {
  currentVersion: string;
  manifestUrl: string;
  errorMessage: string;
}): AppUpdateResult => {
  const configuredUpdateUrl = getConfiguredUpdateUrl();

  if (configuredUpdateUrl) {
    return {
      currentVersion,
      manifestUrl,
      isUpdateAvailable: false,
      isForceUpdate: false,
      updateUrl: configuredUpdateUrl,
    };
  }

  return {
    currentVersion,
    manifestUrl,
    isUpdateAvailable: false,
    isForceUpdate: false,
    error: errorMessage,
  };
};

export const checkForAppUpdate = async (): Promise<AppUpdateResult> => {
  const manifestUrl = getReleaseManifestUrl();
  const currentVersion = getCurrentAppVersion();

  if (!manifestUrl) {
    return buildDirectDownloadFallbackResult({
      currentVersion,
      manifestUrl: "",
      errorMessage: "Release manifest URL is not configured.",
    });
  }

  try {
    const response = await fetch(manifestUrl, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return buildDirectDownloadFallbackResult({
        currentVersion,
        manifestUrl,
        errorMessage: `Unable to read release manifest (${response.status})`,
      });
    }

    const manifest = normalizeManifest((await response.json()) as unknown);
    const isUpdateAvailable = compareVersions(currentVersion, manifest.latestVersion) < 0;
    const isForceUpdate = compareVersions(currentVersion, manifest.minimumVersion) < 0;
    const updateUrl = resolveUpdateUrl(manifest);

    return {
      currentVersion,
      manifestUrl,
      manifest,
      isUpdateAvailable,
      isForceUpdate,
      updateUrl,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not check app updates.";

    return buildDirectDownloadFallbackResult({
      currentVersion,
      manifestUrl,
      errorMessage: message,
    });
  }
};
