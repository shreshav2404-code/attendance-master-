import { X } from "lucide-react-native";
import { KeyboardAvoidingView, Pressable, Text, View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";

import { Overlay } from "@/components/shared/Overlay";

interface BottomSheetProps {
  visible: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const BottomSheet = ({
  visible,
  title,
  onClose,
  children,
}: BottomSheetProps) => {
  return (
    <Overlay visible={visible} onClose={onClose}>
      <KeyboardAvoidingView behavior="padding" className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-black/60" onPress={onClose} />
        {/* Reanimated's entering animation, not a Moti transform (see Overlay.tsx). */}
        <Animated.View
          entering={SlideInDown.springify().damping(18).stiffness(180)}
          className="rounded-t-[32px] border-t border-white/10 bg-surface px-5 pb-10 pt-4"
          // A share of the space left above the keyboard, so the title and ✕ stay
          // on screen while typing (a share of the whole screen pushed them off the top).
          style={{ maxHeight: "88%", zIndex: 10, elevation: 10 }}
        >
          <View className="mb-4 flex-row items-center justify-between">
            <View className="h-1.5 w-12 rounded-full bg-white/15" />
            {title ? (
              <Text className="font-inter-semibold text-base text-white">
                {title}
              </Text>
            ) : (
              <View />
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              hitSlop={10}
              className="h-9 w-9 items-center justify-center rounded-full bg-white/5"
            >
              <X color="#f8fafc" size={18} />
            </Pressable>
          </View>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Overlay>
  );
};
