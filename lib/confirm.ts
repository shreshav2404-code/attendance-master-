import { Alert, Platform } from "react-native";

// Alert.alert is a no-op on web, so the web build falls back to window.confirm.
export const confirmAction = ({
  title,
  message,
  confirmLabel = "Delete",
}: {
  title: string;
  message: string;
  confirmLabel?: string;
}): Promise<boolean> => {
  if (Platform.OS === "web") {
    return Promise.resolve(
      typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`),
    );
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: confirmLabel, style: "destructive", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
};
