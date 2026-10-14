import { useCallback, useEffect, useRef, useState } from "react";

import { triggerSuccessHaptic, triggerWarningHaptic } from "@/lib/haptics";

export type ToastType = "success" | "warning";

export interface ToastState {
  message: string;
  type: ToastType;
}

export interface ToastController {
  state: ToastState;
  /** Shows a toast without a haptic. */
  show: (message: string, type?: ToastType, durationMs?: number) => void;
  /** Success toast (green tick) plus the success haptic. */
  success: (message: string, durationMs?: number) => Promise<void>;
  /** Error toast (warning icon) plus the warning haptic. */
  warn: (message: string, durationMs?: number) => Promise<void>;
}

export const useToast = (): ToastController => {
  const [state, setState] = useState<ToastState>({ message: "", type: "success" });
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Each toast cancels the previous one's hide timer; otherwise an older timer
  // cleared a newer message early.
  const show = useCallback(
    (message: string, type: ToastType = "success", durationMs = 1800) => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
      setState({ message, type });
      hideTimer.current = setTimeout(() => {
        setState((current) => ({ ...current, message: "" }));
      }, durationMs);
    },
    [],
  );

  const success = useCallback(
    async (message: string, durationMs?: number) => {
      show(message, "success", durationMs);
      await triggerSuccessHaptic();
    },
    [show],
  );

  const warn = useCallback(
    async (message: string, durationMs = 2200) => {
      show(message, "warning", durationMs);
      await triggerWarningHaptic();
    },
    [show],
  );

  useEffect(
    () => () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
    },
    [],
  );

  return { state, show, success, warn };
};
