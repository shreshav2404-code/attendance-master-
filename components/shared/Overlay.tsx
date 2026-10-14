import { useEffect, type ReactNode } from "react";
import { BackHandler, StyleSheet, View } from "react-native";
import { Portal } from "react-native-paper";

interface OverlayProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A full-screen layer for menus, sheets and dialogs, drawn in the app's own
 * window through Paper's Portal (react-native's Modal opens a separate window).
 *
 * Slide or fade the content in with Reanimated's `entering` animations, never a
 * Moti `from`/`animate` transform: Reanimated runs that transform outside React
 * Native's layout tree, which keeps the starting offset, so a Pressable inside
 * measures itself there (the menu panel 320 dp to the right). Pressability
 * compares every touch move with that measurement, so a real finger tap, which
 * always moves a little, counted as sliding off the button and was cancelled.
 * Taps with no movement still worked, so it showed up as "buttons only work
 * sometimes" (S24+ reports many small moves per tap).
 */
export const Overlay = ({ visible, onClose, children }: OverlayProps) => {
  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose, visible]);

  if (!visible) {
    return null;
  }

  return (
    <Portal>
      <View style={StyleSheet.absoluteFill}>{children}</View>
    </Portal>
  );
};
