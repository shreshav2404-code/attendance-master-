import { X } from "lucide-react-native";
import { MotiView } from "moti";
import { Modal, Pressable, Text, View, useWindowDimensions } from "react-native";

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
  const { height } = useWindowDimensions();
  const maxSheetHeight = Math.max(420, Math.floor(height * 0.88));

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-black/60" onPress={onClose} />
        <MotiView
          from={{ translateY: 360, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          exit={{ translateY: 360, opacity: 0 }}
          transition={{ type: "spring", damping: 18, stiffness: 180 }}
          className="rounded-t-[32px] border-t border-white/10 bg-surface px-5 pb-10 pt-4"
          style={{ maxHeight: maxSheetHeight, zIndex: 10, elevation: 10 }}
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
              onPress={onClose}
              hitSlop={10}
              className="h-9 w-9 items-center justify-center rounded-full bg-white/5"
            >
              <X color="#f8fafc" size={18} />
            </Pressable>
          </View>
          {children}
        </MotiView>
      </View>
    </Modal>
  );
};
