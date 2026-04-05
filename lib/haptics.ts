import * as Haptics from "expo-haptics";

const runHaptic = async (task: () => Promise<void>): Promise<void> => {
  try {
    await task();
  } catch {
    // Ignore haptic failures on unsupported platforms/emulators.
  }
};

export const triggerTapHaptic = async (): Promise<void> =>
  runHaptic(() =>
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  );

export const triggerSuccessHaptic = async (): Promise<void> =>
  runHaptic(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  );

export const triggerWarningHaptic = async (): Promise<void> =>
  runHaptic(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  );
